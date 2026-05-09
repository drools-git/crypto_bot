"""
Strategy Execution Logger
──────────────────────────
Writes structured, human-readable logs for strategy analysis and debugging.

Architecture:
  - One shared file:  logs/strategies/consensus.log
  - Per-strategy file: logs/strategies/<strategy_id>.log
  - A global switch  (STRATEGY_LOGGING_ENABLED) and per-call override
  - Each entry is timestamped, contains all inputs, intermediate scores, and final output

Toggle via config or at runtime:
    from app.strategies.strategy_logger import strategy_logger
    strategy_logger.enabled = False        # silence all strategy logs globally
    strategy_logger.verbose = True         # show full indicator snapshot
"""

import os
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from loguru import logger as _sys_logger
from app.core.config import settings
from app.strategies.models import Signal

# ── Directory setup ──────────────────────────────────────────────────── #
STRATEGY_LOG_DIR = os.path.join(settings.LOG_DIR, "strategies")
os.makedirs(STRATEGY_LOG_DIR, exist_ok=True)


class StrategyExecutionLogger:
    """
    Writes rich execution logs for every strategy run.

    Attributes
    ----------
    enabled : bool
        Master switch — set False to silence all strategy logs.
    verbose : bool
        When True, includes the full indicator snapshot for each candle in the log.
        Useful for manual comparison against chart data (ground truth).
    per_strategy_files : bool
        When True, writes one .log file per strategy_id in addition to consensus.log.
    """

    def __init__(
        self,
        enabled: bool = True,
        verbose: bool = False,
        per_strategy_files: bool = True,
    ):
        self.enabled             = enabled
        self.verbose             = verbose
        self.per_strategy_files  = per_strategy_files

        # loguru sinks — keyed by strategy_id
        self._sinks: Dict[str, int] = {}
        self._consensus_sink: Optional[int] = None

        if self.enabled:
            self._setup_consensus_sink()

    # ─────────────────────────────────────────────────────────────────── #
    #  Public API                                                          #
    # ─────────────────────────────────────────────────────────────────── #

    def log_run_start(
        self,
        symbol: str,
        timeframe: str,
        n_candles: int,
        strategies: List[str],
    ):
        """Call once before running all strategies."""
        if not self.enabled:
            return
        msg = (
            f"\n{'═'*70}\n"
            f"  STRATEGY RUN  │  {symbol} {timeframe}  │  {self._ts()}\n"
            f"  Candles: {n_candles}  │  Strategies: {', '.join(strategies)}\n"
            f"{'═'*70}"
        )
        _sys_logger.bind(sink="consensus").info(msg)

    def log_signal(
        self,
        signal: Signal,
        indicator_snapshot: Optional[Dict[str, Any]] = None,
        enabled: Optional[bool] = None,   # per-call override
    ):
        """
        Log the result of a single strategy execution.

        Parameters
        ----------
        signal : Signal
            The output of generate_signal().
        indicator_snapshot : dict, optional
            The last row of the enriched DataFrame converted to dict.
            If verbose=True and this is provided, all indicator values are logged.
        enabled : bool, optional
            Per-call override. If None, uses self.enabled.
        """
        should_log = self.enabled if enabled is None else enabled
        if not should_log:
            return

        sid   = signal.strategy_id
        lines = self._format_signal(signal, indicator_snapshot)

        # Write to shared consensus log
        _sys_logger.bind(sink="consensus").info(lines)

        # Write to per-strategy file
        if self.per_strategy_files:
            self._ensure_strategy_sink(sid)
            _sys_logger.bind(sink=sid).info(lines)

    def log_consensus(
        self,
        consensus: Dict[str, Any],
        enabled: Optional[bool] = None,
    ):
        """Log the aggregated consensus result."""
        should_log = self.enabled if enabled is None else enabled
        if not should_log:
            return

        votes    = consensus.get("votes", {})
        n        = consensus.get("n_signals", 0)
        dominant = consensus.get("direction", "HOLD")
        conf     = consensus.get("confidence", 0.0)

        vote_str = "  ".join(
            f"{k}: {v:.2f}" for k, v in votes.items() if v > 0
        )

        lines = (
            f"\n{'─'*70}\n"
            f"  CONSENSUS  │  {self._ts()}\n"
            f"  Direction : {dominant}  ({conf*100:.1f}% avg confidence)\n"
            f"  Votes     : {vote_str}\n"
            f"  Strategies: {n}\n"
            f"{'─'*70}"
        )
        _sys_logger.bind(sink="consensus").info(lines)

    # ─────────────────────────────────────────────────────────────────── #
    #  Formatting helpers                                                  #
    # ─────────────────────────────────────────────────────────────────── #

    def _format_signal(
        self,
        signal: Signal,
        snapshot: Optional[Dict[str, Any]],
    ) -> str:
        direction = signal.signal.value
        arrow     = {"LONG": "▲", "SHORT": "▼", "EXIT": "◄", "HOLD": "●"}
        a         = arrow.get(direction, "?")

        lines = [
            "",
            f"  {a} [{signal.strategy_id}]  {signal.strategy_name}  │  {signal.symbol} {signal.timeframe}",
            f"  Signal     : {direction}",
            f"  Confidence : {signal.confidence*100:.1f}%",
            f"  Reasoning  : {signal.reasoning}",
            f"  Risk       : SL={signal.risk.get('stop_loss_pct',0)*100:.2f}%  "
                           f"TP={signal.risk.get('take_profit_pct',0)*100:.2f}%  "
                           f"MaxPos={signal.risk.get('max_position_pct',0)*100:.0f}%",
        ]

        if self.verbose and snapshot:
            lines.append("  Indicators :")
            # Only log indicator columns, skip time/ohlcv
            skip = {"time", "open", "high", "low", "close", "volume"}
            for k, v in snapshot.items():
                if k not in skip and v is not None:
                    lines.append(f"    {k:<20} {v:.4f}" if isinstance(v, float) else f"    {k:<20} {v}")

        lines.append(f"  Timestamp  : {self._ts()}")
        return "\n".join(lines)

    @staticmethod
    def _ts() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # ─────────────────────────────────────────────────────────────────── #
    #  Loguru sink management                                              #
    # ─────────────────────────────────────────────────────────────────── #

    def _setup_consensus_sink(self):
        path = os.path.join(STRATEGY_LOG_DIR, "consensus.log")
        self._consensus_sink = _sys_logger.add(
            path,
            format="{message}",
            level="INFO",
            rotation="5 MB",
            retention="2 weeks",
            compression="zip",
            filter=lambda r: r["extra"].get("sink") in ("consensus",),
        )

    def _ensure_strategy_sink(self, strategy_id: str):
        if strategy_id in self._sinks:
            return
        path = os.path.join(STRATEGY_LOG_DIR, f"{strategy_id}.log")
        sink_id = _sys_logger.add(
            path,
            format="{message}",
            level="INFO",
            rotation="5 MB",
            retention="2 weeks",
            compression="zip",
            filter=lambda r, sid=strategy_id: r["extra"].get("sink") == sid,
        )
        self._sinks[strategy_id] = sink_id


# Global singleton
# Change enabled=False to silence all strategy logs.
# Change verbose=True to include full indicator snapshots.
strategy_logger = StrategyExecutionLogger(
    enabled=True,
    verbose=False,
    per_strategy_files=True,
)
