"""
Order Flow Confirmation Strategy
──────────────────────────────────
Logic:
  Combines multiple momentum / flow signals to confirm directional bias:
    - MACD cross direction
    - RSI momentum (above/below 50)
    - ADX D+/D- spread (directional pressure)
    - VWAP relationship (institutional anchor)

  LONG  — majority of flow indicators agree bullish  (score ≥ long_threshold)
  SHORT — majority of flow indicators agree bearish  (score ≤ short_threshold)
  EXIT  — a previously active direction loses confirmation  (score crosses 0)
  HOLD  — signals are mixed / flat

Confidence is the normalised score magnitude.
"""
import pandas as pd
from app.strategies.base import BaseStrategy
from app.strategies.models import Signal, SignalType
from app.strategies.registry import registry


@registry.register
class OrderFlowConfirmationStrategy(BaseStrategy):
    strategy_id   = "order_flow"
    strategy_name = "Order Flow Confirmation"
    version       = "1.0.0"
    description   = (
        "Consensus model: combines MACD cross, RSI bias, ADX D+/D- spread, "
        "and VWAP deviation to confirm directional order flow."
    )

    default_risk_params = {
        "stop_loss_pct":    0.018,
        "take_profit_pct":  0.04,
        "max_position_pct": 0.10,
        "long_threshold":   3,    # number of bullish sub-signals needed (out of 4)
        "short_threshold": -3,    # number of bearish sub-signals needed
    }

    def _score_signals(self, last: pd.Series, prev: pd.Series) -> int:
        """
        Each sub-signal contributes +1 (bullish) or -1 (bearish) or 0 (neutral).
        Max total: +4, Min: -4.
        """
        score = 0

        # 1. MACD cross
        macd      = last.get("macd", 0)   or 0
        sig       = last.get("macd_signal", 0) or 0
        p_macd    = prev.get("macd", 0)   or 0
        p_sig     = prev.get("macd_signal", 0) or 0
        if p_macd < p_sig and macd > sig:   # bullish cross
            score += 1
        elif p_macd > p_sig and macd < sig: # bearish cross
            score -= 1
        elif macd > sig:                    # already above — sustained bull
            score += 1
        elif macd < sig:
            score -= 1

        # 2. RSI bias
        rsi = last.get("rsi", 50) or 50
        if rsi > 55:
            score += 1
        elif rsi < 45:
            score -= 1

        # 3. ADX directional pressure
        adx_pos = last.get("adx_pos", 0) or 0
        adx_neg = last.get("adx_neg", 0) or 0
        spread  = adx_pos - adx_neg
        if spread > 5:
            score += 1
        elif spread < -5:
            score -= 1

        # 4. VWAP relationship
        price = last.get("close", 0)
        vwap  = last.get("vwap")
        if vwap:
            if price > vwap * 1.002:
                score += 1
            elif price < vwap * 0.998:
                score -= 1

        return score

    def analyze(self, df: pd.DataFrame) -> None:
        self._last_df = df
        if df is None or len(df) < 3:
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = "Insufficient data."
            return

        last  = df.iloc[-1]
        prev  = df.iloc[-2]

        score = self._score_signals(last, prev)

        long_thr  = int(self._params.get("long_threshold",  3))
        short_thr = int(self._params.get("short_threshold", -3))

        self._metadata = {
            "score":    score,
            "rsi":      last.get("rsi"),
            "macd":     last.get("macd"),
            "adx_pos":  last.get("adx_pos"),
            "adx_neg":  last.get("adx_neg"),
            "vwap":     last.get("vwap"),
            "price":    last.get("close"),
        }

        # normalise to 0→1
        confidence = abs(score) / 4.0

        if score >= long_thr:
            self._last_signal = SignalType.LONG
            self._confidence  = min(1.0, confidence)
            self._reasoning   = (
                f"Bullish flow consensus: score={score}/{4}. "
                f"RSI={last.get('rsi', 0):.1f}, MACD={last.get('macd', 0):.2f}"
            )
        elif score <= short_thr:
            self._last_signal = SignalType.SHORT
            self._confidence  = min(1.0, confidence)
            self._reasoning   = (
                f"Bearish flow consensus: score={score}/{4}. "
                f"RSI={last.get('rsi', 0):.1f}, MACD={last.get('macd', 0):.2f}"
            )
        elif score == 0 and abs(prev.get("score", 0) if hasattr(prev, 'get') else 0) > 0:
            self._last_signal = SignalType.EXIT
            self._confidence  = 0.55
            self._reasoning   = f"Flow consensus collapsed to neutral (score={score})."
        else:
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = f"Mixed signals: score={score} (threshold: ±{long_thr})"

    def generate_signal(self) -> Signal:
        symbol    = str(self._metadata.get("symbol", "UNKNOWN"))
        timeframe = str(self._metadata.get("timeframe", "1h"))
        return self._build_signal(symbol, timeframe)
