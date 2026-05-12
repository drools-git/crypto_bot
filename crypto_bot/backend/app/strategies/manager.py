import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
from loguru import logger

from app.strategies.models import Signal, SignalType, StrategyConfig
from app.strategies.registry import registry
from app.strategies.strategy_logger import strategy_logger

# Force registration of all built-in strategies
import app.strategies.trend_following      # noqa: F401
import app.strategies.mean_reversion       # noqa: F401
import app.strategies.breakout_volume      # noqa: F401
import app.strategies.order_flow           # noqa: F401
import app.strategies.smart_money          # noqa: F401

DATA_DIR = Path("data/records")
CONFIG_FILE = DATA_DIR / "strategies_config.json"


class StrategyManager:
    """
    Central engine that runs every enabled strategy against the same
    indicator-enriched DataFrame and collects their signals.
    """

    def __init__(self):
        self._instances: Dict[str, Any] = {}  # strategy_id → BaseStrategy instance
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._load_all()

    # ------------------------------------------------------------------ #
    #  Lifecycle                                                           #
    # ------------------------------------------------------------------ #

    def _load_all(self):
        """Instantiate every strategy registered in the registry."""
        persisted_config = self._load_persisted_config()
        
        for sid, cls in registry.list_all().items():
            try:
                config = persisted_config.get(sid, {})
                strat_config = StrategyConfig(
                    enabled=config.get("enabled", True),
                    weight=config.get("weight", 50),
                    params=config.get("params", {})
                )
                self._instances[sid] = cls(config=strat_config)
                logger.info(f"[StrategyManager] Loaded '{sid}' ({cls.strategy_name}) | enabled={strat_config.enabled}, weight={strat_config.weight}")
            except Exception as e:
                logger.error(f"[StrategyManager] Failed to load '{sid}': {e}")

    def _load_persisted_config(self) -> Dict[str, Any]:
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"[StrategyManager] Error loading config file: {e}")
        return {}

    def _save_config(self):
        config = {}
        for sid, inst in self._instances.items():
            config[sid] = {
                "enabled": inst.enabled,
                "weight": inst.weight,
                "params": inst.risk_params
            }
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump(config, f, indent=4)
        except Exception as e:
            logger.error(f"[StrategyManager] Error saving config file: {e}")

    def reload(self):
        """Re-instantiate all strategies (picks up any newly registered ones)."""
        self._instances.clear()
        self._load_all()

    # ------------------------------------------------------------------ #
    #  Runtime control                                                     #
    # ------------------------------------------------------------------ #

    def enable(self, strategy_id: str):
        self._get(strategy_id).enable()
        self._save_config()

    def disable(self, strategy_id: str):
        self._get(strategy_id).disable()
        self._save_config()

    def update_weight(self, strategy_id: str, weight: int):
        self._get(strategy_id).update_weight(weight)
        self._save_config()

    def update_params(self, strategy_id: str, params: Dict[str, Any]):
        self._get(strategy_id).update_params(params)
        self._save_config()

    def list_strategies(self) -> List[Dict[str, Any]]:
        return [inst.get_metadata() for inst in self._instances.values()]

    # ------------------------------------------------------------------ #
    #  Core execution                                                      #
    # ------------------------------------------------------------------ #

    def run_all(
        self,
        df: pd.DataFrame,
        symbol: str,
        timeframe: str,
    ) -> List[Signal]:
        """
        Run every enabled strategy against the enriched DataFrame.
        """
        signals: List[Signal] = []
        enabled_ids = [sid for sid, s in self._instances.items() if s.enabled]

        strategy_logger.log_run_start(
            symbol=symbol,
            timeframe=timeframe,
            n_candles=len(df),
            strategies=enabled_ids,
        )

        # Last candle snapshot for verbose logging
        snapshot = df.iloc[-1].to_dict() if len(df) > 0 else {}

        for sid, strategy in self._instances.items():
            if not strategy.enabled:
                continue
            try:
                strategy._metadata["symbol"]    = symbol
                strategy._metadata["timeframe"] = timeframe
                strategy.analyze(df)
                signal = strategy.generate_signal()
                signal.symbol    = symbol
                signal.timeframe = timeframe
                # Inject weight into signal metadata for consensus calculation
                signal.metadata["weight"] = strategy.weight
                signals.append(signal)

                strategy_logger.log_signal(signal, indicator_snapshot=snapshot)

                logger.debug(
                    f"[{sid}] {signal.signal} | conf={signal.confidence:.2f} | weight={strategy.weight}"
                )
            except Exception as e:
                logger.error(f"[StrategyManager] Error in strategy '{sid}': {e}")

        return signals

    def get_consensus(self, signals: List[Signal]) -> Dict[str, Any]:
        """
        Aggregate signals using weights. Confidence is weighted by the strategy's weight.
        """
        if not signals:
            return {"direction": SignalType.HOLD, "confidence": 0.0, "votes": {}, "signals": []}

        # Weighted votes per direction
        votes: Dict[str, float] = {s.value: 0.0 for s in SignalType}
        total_weight_per_dir: Dict[str, float] = {s.value: 0.0 for s in SignalType}
        
        for sig in signals:
            weight = sig.metadata.get("weight", 50)
            # score = confidence (0-1) * weight (1-100)
            weighted_score = sig.confidence * (weight / 100.0)
            votes[sig.signal.value] += weighted_score
            total_weight_per_dir[sig.signal.value] += (weight / 100.0)

        dominant = max(votes, key=lambda k: votes[k])

        # Calculate average weighted confidence for the dominant direction
        if total_weight_per_dir[dominant] > 0:
            avg_conf = votes[dominant] / total_weight_per_dir[dominant]
        else:
            avg_conf = 0.0

        result = {
            "direction":       dominant,
            "confidence":      round(avg_conf, 4),
            "votes":           {k: round(v, 4) for k, v in votes.items()},
            "n_signals":       len(signals),
            "signals":         [s.model_dump() for s in signals],
        }

        strategy_logger.log_consensus(result)
        return result

    # ------------------------------------------------------------------ #
    #  Private                                                             #
    # ------------------------------------------------------------------ #

    def _get(self, strategy_id: str):
        if strategy_id not in self._instances:
            raise KeyError(f"Strategy '{strategy_id}' not found in manager.")
        return self._instances[strategy_id]


# Singleton
strategy_manager = StrategyManager()
