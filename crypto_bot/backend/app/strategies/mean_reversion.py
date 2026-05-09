"""
Mean Reversion Strategy
────────────────────────
Logic:
  LONG  — price touches/crosses below BB Lower AND RSI < oversold level
  SHORT — price touches/crosses above BB Upper AND RSI > overbought level
  EXIT  — price returns to BB Mid (mean)
  HOLD  — everything else

Confidence scales with distance of RSI from 50 and BB width.
"""
import pandas as pd
from app.strategies.base import BaseStrategy
from app.strategies.models import Signal, SignalType
from app.strategies.registry import registry


@registry.register
class MeanReversionStrategy(BaseStrategy):
    strategy_id   = "mean_reversion"
    strategy_name = "Mean Reversion"
    version       = "1.0.0"
    description   = "Fades extremes using Bollinger Bands and RSI overbought/oversold levels."

    default_risk_params = {
        "stop_loss_pct":    0.015,
        "take_profit_pct":  0.03,
        "max_position_pct": 0.10,
        "rsi_oversold":     30.0,
        "rsi_overbought":   70.0,
        "bb_touch_pct":     0.005,   # within 0.5 % of band edge to count as a touch
    }

    def analyze(self, df: pd.DataFrame) -> None:
        self._last_df = df
        if df is None or len(df) < 3:
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = "Insufficient data."
            return

        last  = df.iloc[-1]
        prev  = df.iloc[-2]

        price   = last.get("close", 0)
        rsi     = last.get("rsi") or 50.0
        bb_high = last.get("bb_high")
        bb_low  = last.get("bb_low")
        bb_mid  = last.get("bb_mid")

        oversold   = self._params.get("rsi_oversold",   30.0)
        overbought = self._params.get("rsi_overbought", 70.0)
        touch_pct  = self._params.get("bb_touch_pct",  0.005)

        self._metadata = {
            "price": price, "rsi": rsi, "bb_high": bb_high,
            "bb_low": bb_low, "bb_mid": bb_mid,
        }

        if any(v is None for v in [bb_high, bb_low, bb_mid]):
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = "Bollinger Band values not yet available."
            return

        bb_width = bb_high - bb_low  # noqa: E501 — volatility context
        near_low  = price <= bb_low  * (1 + touch_pct)
        near_high = price >= bb_high * (1 - touch_pct)

        # Exit: price returned to the mean from either direction
        prev_price = prev.get("close", price)
        if prev_price < prev.get("bb_low", price) and price >= bb_mid:
            self._last_signal = SignalType.EXIT
            self._confidence  = 0.70
            self._reasoning   = f"Price reverted to BB Mid ({bb_mid:.2f}) from below."
            return
        if prev_price > prev.get("bb_high", price) and price <= bb_mid:
            self._last_signal = SignalType.EXIT
            self._confidence  = 0.70
            self._reasoning   = f"Price reverted to BB Mid ({bb_mid:.2f}) from above."
            return

        # LONG: oversold + at lower band
        if near_low and rsi < oversold:
            rsi_dist = (oversold - rsi) / oversold          # 0→1 as RSI drops
            self._last_signal = SignalType.LONG
            self._confidence  = min(1.0, 0.45 + rsi_dist * 0.55)
            self._reasoning   = (
                f"Oversold: RSI={rsi:.1f} < {oversold}, price {price:.2f} near BB Low {bb_low:.2f}"
            )
        # SHORT: overbought + at upper band
        elif near_high and rsi > overbought:
            rsi_dist = (rsi - overbought) / (100 - overbought)
            self._last_signal = SignalType.SHORT
            self._confidence  = min(1.0, 0.45 + rsi_dist * 0.55)
            self._reasoning   = (
                f"Overbought: RSI={rsi:.1f} > {overbought}, price {price:.2f} near BB High {bb_high:.2f}"
            )
        else:
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = (
                f"Price inside bands: BB=[{bb_low:.2f}, {bb_high:.2f}], RSI={rsi:.1f}"
            )

    def generate_signal(self) -> Signal:
        symbol    = str(self._metadata.get("symbol", "UNKNOWN"))
        timeframe = str(self._metadata.get("timeframe", "1h"))
        return self._build_signal(symbol, timeframe)
