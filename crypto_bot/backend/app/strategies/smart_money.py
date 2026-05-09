"""
Smart Money Concepts (SMC) Strategy
─────────────────────────────────────
Logic:
  Uses Price Action concepts rather than traditional indicators.
  
  LONG  — Price sweeps a previous swing low (liquidity grab) or breaks a swing high (BOS/CHoCH),
          then leaves a bullish Fair Value Gap (FVG). We enter when price mitigates/pulls back into FVG.
  SHORT — Price sweeps a previous swing high or breaks a swing low,
          leaving a bearish FVG. We enter when price mitigates the FVG.
  EXIT  — Structure changes against the trade.
  HOLD  — No clear SMC setup.
"""
import pandas as pd
from app.strategies.base import BaseStrategy
from app.strategies.models import Signal, SignalType
from app.strategies.registry import registry


@registry.register
class SmartMoneyStrategy(BaseStrategy):
    strategy_id   = "smart_money_concepts"
    strategy_name = "SMC / Price Action"
    version       = "1.0.0"
    description   = "Smart Money Concepts: Trades Fair Value Gaps (FVGs) and Market Structure Shifts (BOS/CHoCH)."

    default_risk_params = {
        "stop_loss_pct":    0.015,
        "take_profit_pct":  0.045, # SMC typically targets 1:3 R:R
        "max_position_pct": 0.10,
    }

    def analyze(self, df: pd.DataFrame) -> None:
        self._last_df = df
        if df is None or len(df) < 5:
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.0
            self._reasoning   = "Insufficient data."
            return

        last = df.iloc[-1]
        prev = df.iloc[-2]

        price = last.get("close", 0)
        
        # FVGs
        fvg_bull     = last.get("fvg_bull", False)
        fvg_bear     = last.get("fvg_bear", False)
        fvg_bull_gap = last.get("fvg_bull_gap", 0)
        fvg_bear_gap = last.get("fvg_bear_gap", 0)

        # Structure
        last_swing_high = last.get("last_swing_high")
        last_swing_low  = last.get("last_swing_low")
        
        # Let's detect a BOS (Break of Structure) or CHoCH (Change of Character)
        # For simplicity, if price closes above the last swing high, it's a bullish BOS
        bullish_bos = pd.notna(last_swing_high) and price > last_swing_high and prev.get("close", 0) <= last_swing_high
        bearish_bos = pd.notna(last_swing_low) and price < last_swing_low and prev.get("close", 0) >= last_swing_low

        self._metadata = {
            "price": price, 
            "fvg_bull": fvg_bull, "fvg_bear": fvg_bear,
            "last_swing_high": last_swing_high, "last_swing_low": last_swing_low
        }

        # LONG Setup: We have a bullish FVG (imbalance) AND we recently broke structure upwards
        # Or price is currently inside an active FVG (mitigation)
        if fvg_bull and fvg_bull_gap > 0 and (price > (last_swing_high or 0)):
            self._last_signal = SignalType.LONG
            self._confidence  = 0.75  # SMC setups are high conviction
            self._reasoning   = (
                f"SMC Alcista: FVG alcista detectado con hueco de {fvg_bull_gap:.2f}. "
                f"Precio rompió el último Swing High ({last_swing_high:.2f})."
            )
        # SHORT Setup: Bearish FVG AND broke structure downwards
        elif fvg_bear and fvg_bear_gap > 0 and (price < (last_swing_low or float('inf'))):
            self._last_signal = SignalType.SHORT
            self._confidence  = 0.75
            self._reasoning   = (
                f"SMC Bajista: FVG bajista detectado con hueco de {fvg_bear_gap:.2f}. "
                f"Precio rompió el último Swing Low ({last_swing_low:.2f})."
            )
        else:
            # HOLD: Report proximity or state
            state_text = []
            if pd.notna(last_swing_high) and pd.notna(last_swing_low):
                # Calculate where price is relative to the current swing range
                swing_range = last_swing_high - last_swing_low
                if swing_range > 0:
                    pos = (price - last_swing_low) / swing_range
                    if pos > 0.8:
                        state_text.append(f"Cerca de resistencia (Swing High {last_swing_high:.2f})")
                    elif pos < 0.2:
                        state_text.append(f"Cerca de soporte (Swing Low {last_swing_low:.2f})")
                    else:
                        state_text.append("En equilibrio estructural (premium/discount)")
            
            if fvg_bull: state_text.append("FVG alcista en formación")
            elif fvg_bear: state_text.append("FVG bajista en formación")

            reason = " | ".join(state_text) if state_text else "Sin desequilibrios (Imbalances) detectados."
            
            self._last_signal = SignalType.HOLD
            self._confidence  = 0.20  # Partial confidence to show it's tracking structure
            self._reasoning   = f"Estructura neutra. {reason}"

    def generate_signal(self) -> Signal:
        symbol    = str(self._metadata.get("symbol", "UNKNOWN"))
        timeframe = str(self._metadata.get("timeframe", "1h"))
        return self._build_signal(symbol, timeframe)
