from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import pandas as pd
from loguru import logger

from app.strategies.models import Signal, SignalType, StrategyConfig


class BaseStrategy(ABC):
    """
    Abstract base class for all trading strategies.

    Subclass this and implement:
      - analyze(df)        — compute internal state from enriched OHLCV data
      - generate_signal()  — return a Signal after analyze() has run

    The framework calls them in order:
        df = indicator_engine.add_indicators(df)
        strategy.analyze(df)
        signal = strategy.generate_signal()
    """

    # --- Class-level metadata (override in subclass) ---
    strategy_id:   str = "base"
    strategy_name: str = "Base Strategy"
    version:       str = "1.0.0"
    description:   str = ""

    # Default risk parameters (override in subclass or via config)
    default_risk_params: Dict[str, Any] = {
        "stop_loss_pct":  0.02,   # 2 %
        "take_profit_pct": 0.04,  # 4 %
        "max_position_pct": 0.10, # 10 % of portfolio
    }

    def __init__(self, config: Optional[StrategyConfig] = None):
        self.config   = config or StrategyConfig()
        self._enabled = self.config.enabled
        self._params  = {**self.default_risk_params, **self.config.params}

        # Internal state set by analyze()
        self._last_df:     Optional[pd.DataFrame] = None
        self._last_signal: SignalType = SignalType.HOLD
        self._confidence:  float = 0.0
        self._reasoning:   str   = ""
        self._metadata:    Dict[str, Any] = {}

    # ------------------------------------------------------------------ #
    #  Public interface                                                    #
    # ------------------------------------------------------------------ #

    @property
    def enabled(self) -> bool:
        return self._enabled

    def enable(self):
        self._enabled = True
        logger.info(f"[{self.strategy_id}] Strategy enabled.")

    def disable(self):
        self._enabled = False
        logger.info(f"[{self.strategy_id}] Strategy disabled.")

    def update_params(self, params: Dict[str, Any]):
        """Hot-update configurable parameters without restarting."""
        self._params.update(params)
        logger.info(f"[{self.strategy_id}] Params updated: {params}")

    @property
    def risk_params(self) -> Dict[str, Any]:
        return self._params

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "strategy_id":   self.strategy_id,
            "strategy_name": self.strategy_name,
            "version":       self.version,
            "description":   self.description,
            "enabled":       self._enabled,
            "params":        self._params,
        }

    # ------------------------------------------------------------------ #
    #  Abstract methods — must be implemented by each strategy             #
    # ------------------------------------------------------------------ #

    @abstractmethod
    def analyze(self, df: pd.DataFrame) -> None:
        """
        Process the enriched OHLCV DataFrame and update internal state.
        Called before generate_signal().
        df is guaranteed to have indicator columns from IndicatorEngine.
        """

    @abstractmethod
    def generate_signal(self) -> Signal:
        """
        Return a Signal object based on the last analyze() run.
        Must not mutate the DataFrame; reads internal state only.
        """

    # ------------------------------------------------------------------ #
    #  Helper — build a Signal from current state                         #
    # ------------------------------------------------------------------ #

    def _build_signal(self, symbol: str, timeframe: str) -> Signal:
        return Signal(
            strategy_id=self.strategy_id,
            strategy_name=self.strategy_name,
            signal=self._last_signal,
            confidence=round(self._confidence, 4),
            symbol=symbol,
            timeframe=timeframe,
            reasoning=self._reasoning,
            risk=self._params,
            metadata=self._metadata,
        )
