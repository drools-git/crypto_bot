"""
Trend Following Strategy
────────────────────────
Logic:
  LONG  — price > EMA20 > EMA50 > EMA200, ADX > threshold (strong trend up)
  SHORT — price < EMA20 < EMA50 < EMA200, ADX > threshold (strong trend down)
  EXIT  — trend reversal detected (cross below/above EMA20)
  HOLD  — everything else

Confidence is scaled by ADX strength and MACD alignment.
"""
import pandas as pd
from app.strategies.base import BaseStrategy
from app.strategies.models import Signal, SignalType
from app.strategies.registry import registry


@registry.register
class TrendFollowingStrategy(BaseStrategy):
    strategy_id   = "trend_following"
    strategy_name = "Trend Following"
    version       = "1.0.0"
    description   = "Rides established trends using EMA stack alignment and ADX strength filter."

    default_risk_params = {
        "stop_loss_pct":    0.025,
        "take_profit_pct":  0.05,
        "max_position_pct": 0.15,
        "adx_threshold":    25.0,   # minimum ADX to confirm trend
        "ema_short":        20,
        "ema_long":         50,
        "ema_vlong":        200,
    }

    def analyze(self, df: pd.DataFrame) -> None:
        self._last_df = df
        if df is None or len(df) < 5:
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = "Insufficient data."
            return

        last    = df.iloc[-1]
        prev    = df.iloc[-2]
        price   = last.get("close", 0)
        ema20   = last.get("ema_20")
        ema50   = last.get("ema_50")
        ema200  = last.get("ema_200")
        adx     = last.get("adx", 0) or 0
        macd    = last.get("macd", 0) or 0
        macd_h  = last.get("macd_hist", 0) or 0

        adx_thr = self._params.get("adx_threshold", 25.0)
        self._metadata = {
            "price": price, "ema20": ema20, "ema50": ema50,
            "ema200": ema200, "adx": adx, "macd": macd,
        }

        # Check all indicator values are available
        if any(v is None for v in [ema20, ema50, ema200]):
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = "EMA values not yet available."
            return

        strong_trend = adx > adx_thr

        # LONG: full bullish stack
        if price > ema20 > ema50 > ema200 and strong_trend and macd > 0:
            self._last_signal = SignalType.LONG
            # Confidence: scale by how far ADX is above threshold (max 60 pts above → 1.0)
            self._confidence  = min(1.0, 0.5 + ((adx - adx_thr) / 60))
            if macd_h > 0:
                self._confidence = min(1.0, self._confidence + 0.1)
            self._reasoning = (
                f"Bullish EMA stack: price {price:.2f} > EMA20 {ema20:.2f} > "
                f"EMA50 {ema50:.2f} > EMA200 {ema200:.2f}. ADX={adx:.1f}, MACD={macd:.2f}"
            )
        # SHORT: full bearish stack
        elif price < ema20 < ema50 < ema200 and strong_trend and macd < 0:
            self._last_signal = SignalType.SHORT
            self._confidence  = min(1.0, 0.5 + ((adx - adx_thr) / 60))
            if macd_h < 0:
                self._confidence = min(1.0, self._confidence + 0.1)
            self._reasoning = (
                f"Bearish EMA stack: price {price:.2f} < EMA20 {ema20:.2f} < "
                f"EMA50 {ema50:.2f} < EMA200 {ema200:.2f}. ADX={adx:.1f}, MACD={macd:.2f}"
            )
        # EXIT: trend started to flip
        elif prev.get("close", 0) > prev.get("ema_20", 0) and price < ema20:
            self._last_signal = SignalType.EXIT
            self._confidence  = 0.65
            self._reasoning   = "Price crossed below EMA20 — potential trend reversal."
        elif prev.get("close", 0) < prev.get("ema_20", 0) and price > ema20:
            self._last_signal = SignalType.EXIT
            self._confidence  = 0.65
            self._reasoning   = "Price crossed above EMA20 — potential short-side reversal."
        else:
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = f"No clear trend signal. ADX={adx:.1f} (threshold={adx_thr})"

    def generate_signal(self) -> Signal:
        symbol    = str(self._metadata.get("symbol", "UNKNOWN"))
        timeframe = str(self._metadata.get("timeframe", "1h"))
        return self._build_signal(symbol, timeframe)
