"""
Strategy Manager
────────────────
Orchestrates all registered strategies:
  - Instantiates strategies from registry on startup
  - Runs analyze() + generate_signal() across enabled strategies
  - Supports enable/disable and hot-param updates at runtime
  - Returns aggregated signals with consensus metadata
"""
from typing import Any, Dict, List, Optional
import pandas as pd
from loguru import logger

from app.strategies.models import Signal, SignalType, StrategyConfig
from app.strategies.registry import registry

# Force registration of all built-in strategies
import app.strategies.trend_following      # noqa: F401
import app.strategies.mean_reversion       # noqa: F401
import app.strategies.breakout_volume      # noqa: F401
import app.strategies.order_flow           # noqa: F401


class StrategyManager:
    """
    Central engine that runs every enabled strategy against the same
    indicator-enriched DataFrame and collects their signals.
    """

    def __init__(self):
        self._instances: Dict[str, Any] = {}  # strategy_id → BaseStrategy instance
        self._load_all()

    # ------------------------------------------------------------------ #
    #  Lifecycle                                                           #
    # ------------------------------------------------------------------ #

    def _load_all(self):
        """Instantiate every strategy registered in the registry."""
        for sid, cls in registry.list_all().items():
            try:
                self._instances[sid] = cls()
                logger.info(f"[StrategyManager] Loaded '{sid}' ({cls.strategy_name})")
            except Exception as e:
                logger.error(f"[StrategyManager] Failed to load '{sid}': {e}")

    def reload(self):
        """Re-instantiate all strategies (picks up any newly registered ones)."""
        self._instances.clear()
        self._load_all()

    # ------------------------------------------------------------------ #
    #  Runtime control                                                     #
    # ------------------------------------------------------------------ #

    def enable(self, strategy_id: str):
        self._get(strategy_id).enable()

    def disable(self, strategy_id: str):
        self._get(strategy_id).disable()

    def update_params(self, strategy_id: str, params: Dict[str, Any]):
        self._get(strategy_id).update_params(params)

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

        Args:
            df: Indicator-enriched OHLCV DataFrame (from IndicatorEngine).
            symbol: e.g. "BTC/USDT"
            timeframe: e.g. "1h"

        Returns:
            List of Signal objects, one per enabled strategy.
        """
        signals: List[Signal] = []

        for sid, strategy in self._instances.items():
            if not strategy.enabled:
                logger.debug(f"[StrategyManager] Skipping disabled strategy '{sid}'")
                continue
            try:
                # Inject context into metadata before analyze
                strategy._metadata["symbol"]    = symbol
                strategy._metadata["timeframe"] = timeframe
                strategy.analyze(df)
                signal = strategy.generate_signal()
                # Ensure symbol/timeframe are on the signal
                signal.symbol    = symbol
                signal.timeframe = timeframe
                signals.append(signal)
                logger.debug(
                    f"[{sid}] {signal.signal} | conf={signal.confidence:.2f} | {signal.reasoning[:80]}"
                )
            except Exception as e:
                logger.error(f"[StrategyManager] Error in strategy '{sid}': {e}")

        return signals

    def get_consensus(self, signals: List[Signal]) -> Dict[str, Any]:
        """
        Aggregate signals from all strategies into a simple consensus.
        Returns: direction, avg_confidence, vote_breakdown, dominant_signal
        """
        if not signals:
            return {"direction": SignalType.HOLD, "confidence": 0.0, "votes": {}, "signals": []}

        votes: Dict[str, float] = {s.value: 0.0 for s in SignalType}
        for sig in signals:
            votes[sig.signal.value] += sig.confidence

        dominant = max(votes, key=lambda k: votes[k])
        total    = sum(votes.values()) or 1.0
        avg_conf = votes[dominant] / len(signals)

        return {
            "direction":   dominant,
            "confidence":  round(avg_conf, 4),
            "votes":       {k: round(v, 4) for k, v in votes.items()},
            "n_signals":   len(signals),
            "signals":     [s.model_dump() for s in signals],
        }

    # ------------------------------------------------------------------ #
    #  Private                                                             #
    # ------------------------------------------------------------------ #

    def _get(self, strategy_id: str):
        if strategy_id not in self._instances:
            raise KeyError(f"Strategy '{strategy_id}' not found in manager.")
        return self._instances[strategy_id]


# Singleton
strategy_manager = StrategyManager()
