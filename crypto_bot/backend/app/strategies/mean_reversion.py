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
            rsi_dist = (oversold - rsi) / oversold
            self._last_signal = SignalType.LONG
            self._confidence  = min(0.85, 0.45 + rsi_dist * 0.40)  # cap 85%
            self._reasoning   = (
                f"Sobrevendido: RSI={rsi:.1f} < {oversold}, precio {price:.2f} cerca de BB Low {bb_low:.2f}"
            )
        elif near_high and rsi > overbought:
            rsi_dist = (rsi - overbought) / (100 - overbought)
            self._last_signal = SignalType.SHORT
            self._confidence  = min(0.85, 0.45 + rsi_dist * 0.40)  # cap 85%
            self._reasoning   = (
                f"Sobrecomprado: RSI={rsi:.1f} > {overbought}, precio {price:.2f} cerca de BB High {bb_high:.2f}"
            )
        else:
            # HOLD — report proximity: how close RSI is to its threshold, and price to the band
            rsi_to_low  = max(0.0, (rsi - oversold) / (50 - oversold))   # 1=at oversold, 0=at 50
            rsi_to_high = max(0.0, (overbought - rsi) / (overbought - 50))
            rsi_prox    = 1.0 - min(rsi_to_low, rsi_to_high)              # 0=neutral, 1=at edge
            bb_pos      = (price - bb_low) / (bb_high - bb_low) if bb_high != bb_low else 0.5
            bb_prox     = abs(bb_pos - 0.5) * 2  # 0=center, 1=at band edge
            proximity   = (rsi_prox + bb_prox) / 2
            self._last_signal = SignalType.HOLD
            self._confidence  = round(proximity * 0.38, 3)  # max ~38%
            self._reasoning   = (
                f"Precio dentro de bandas: BB=[{bb_low:.2f}, {bb_high:.2f}], RSI={rsi:.1f} "
                f"(pos={bb_pos*100:.0f}% del ancho, prox. al borde={bb_prox*100:.0f}%)"
            )

    def generate_signal(self) -> Signal:
        symbol    = str(self._metadata.get("symbol", "UNKNOWN"))
        timeframe = str(self._metadata.get("timeframe", "1h"))
        return self._build_signal(symbol, timeframe)
