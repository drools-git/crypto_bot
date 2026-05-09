"""
Breakout + Volume Strategy
───────────────────────────
Logic:
  LONG  — price breaks above resistance level with a volume spike (OBV rising)
  SHORT — price breaks below support level with a volume spike (OBV falling)
  EXIT  — price fails to hold the breakout level on next bar
  HOLD  — no confirmed breakout

Confidence scales with volume multiple vs. SMA and distance of breakout from level.
"""
import pandas as pd
from app.strategies.base import BaseStrategy
from app.strategies.models import Signal, SignalType
from app.strategies.registry import registry


@registry.register
class BreakoutVolumeStrategy(BaseStrategy):
    strategy_id   = "breakout_volume"
    strategy_name = "Breakout Volume"
    version       = "1.0.0"
    description   = "Detects price breakouts above resistance / below support confirmed by volume spikes."

    default_risk_params = {
        "stop_loss_pct":      0.02,
        "take_profit_pct":    0.06,
        "max_position_pct":   0.12,
        "volume_spike_mult":  1.5,   # volume must be ≥ 1.5× its SMA
        "breakout_pct":       0.002, # price must clear the level by 0.2 %
        "lookback":           20,    # bars for S/R detection
    }

    def analyze(self, df: pd.DataFrame) -> None:
        self._last_df = df
        lb = int(self._params.get("lookback", 20))

        if df is None or len(df) < lb + 2:
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = "Insufficient data for breakout lookback."
            return

        last = df.iloc[-1]
        prev = df.iloc[-2]

        price      = last.get("close", 0)
        volume     = last.get("volume", 0) or 0
        vol_sma    = last.get("volume_sma", 0) or 0
        obv        = last.get("obv", 0) or 0
        obv_prev   = prev.get("obv", 0) or 0
        resistance = last.get("resistance")
        support    = last.get("support")

        spike_mult  = self._params.get("volume_spike_mult", 1.5)
        breakout_pct = self._params.get("breakout_pct", 0.002)

        self._metadata = {
            "price": price, "volume": volume, "vol_sma": vol_sma,
            "obv": obv, "resistance": resistance, "support": support,
        }

        if vol_sma == 0:
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = "Volume SMA not yet available."
            return

        vol_multiple = volume / vol_sma if vol_sma else 1.0
        has_spike    = vol_multiple >= spike_mult

        # EXIT: failed breakout (price pulled back inside)
        if prev.get("close", 0) > prev.get("resistance", float("inf")) and price < resistance:
            self._last_signal = SignalType.EXIT
            self._confidence  = 0.72
            self._reasoning   = "Failed breakout above resistance; price pulled back."
            return
        if prev.get("close", 0) < prev.get("support", 0) and price > support:
            self._last_signal = SignalType.EXIT
            self._confidence  = 0.72
            self._reasoning   = "Failed breakdown below support; price recovered."
            return

        # LONG breakout
        if (resistance is not None
                and price > resistance * (1 + breakout_pct)
                and has_spike
                and obv > obv_prev):
            self._last_signal = SignalType.LONG
            self._confidence  = min(1.0, 0.5 + (vol_multiple - spike_mult) * 0.15)
            self._reasoning   = (
                f"Breakout above resistance {resistance:.2f} with volume spike "
                f"({vol_multiple:.1f}× SMA). OBV rising."
            )
        # SHORT breakdown
        elif (support is not None
                and price < support * (1 - breakout_pct)
                and has_spike
                and obv < obv_prev):
            self._last_signal = SignalType.SHORT
            self._confidence  = min(1.0, 0.5 + (vol_multiple - spike_mult) * 0.15)
            self._reasoning   = (
                f"Breakdown below support {support:.2f} with volume spike "
                f"({vol_multiple:.1f}× SMA). OBV falling."
            )
        else:
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = (
                f"No breakout: price={price:.2f}, "
                f"S={support}, R={resistance}, vol×={vol_multiple:.2f}"
            )

    def generate_signal(self) -> Signal:
        symbol    = str(self._metadata.get("symbol", "UNKNOWN"))
        timeframe = str(self._metadata.get("timeframe", "1h"))
        return self._build_signal(symbol, timeframe)
