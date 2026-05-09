import pandas as pd
from app.indicators.base import BaseIndicator

class StructureIndicators(BaseIndicator):
    def calculate(self, df: pd.DataFrame) -> pd.DataFrame:
        window = 20
        # 1. Basic Support & Resistance
        df['support'] = df['low'].rolling(window=window, min_periods=1).min()
        df['resistance'] = df['high'].rolling(window=window, min_periods=1).max()
        
        # Breakout detection (1 for bull breakout, -1 for bear breakout, 0 otherwise)
        df['breakout_bull'] = (df['close'] > df['resistance'].shift(1)).astype(int)
        df['breakout_bear'] = (df['close'] < df['support'].shift(1)).astype(int)

        # 2. Fair Value Gaps (FVG) / Imbalances
        # Bullish FVG: Low of candle[i] > High of candle[i-2]
        df['fvg_bull'] = df['low'] > df['high'].shift(2)
        df['fvg_bull_gap'] = (df['low'] - df['high'].shift(2)).clip(lower=0)

        # Bearish FVG: High of candle[i] < Low of candle[i-2]
        df['fvg_bear'] = df['high'] < df['low'].shift(2)
        df['fvg_bear_gap'] = (df['low'].shift(2) - df['high']).clip(lower=0)

        # 3. Swing Highs / Lows (Fractals - confirmed 2 candles later)
        # We assign the swing value to the current row when it is CONFIRMED (i.e. we are at i, and i-2 was the swing)
        is_swing_high = (df['high'].shift(2) > df['high'].shift(3)) & (df['high'].shift(2) > df['high'].shift(4)) & \
                        (df['high'].shift(2) > df['high'].shift(1)) & (df['high'].shift(2) > df['high'])
        df['swing_high'] = df['high'].shift(2).where(is_swing_high, None)

        is_swing_low = (df['low'].shift(2) < df['low'].shift(3)) & (df['low'].shift(2) < df['low'].shift(4)) & \
                       (df['low'].shift(2) < df['low'].shift(1)) & (df['low'].shift(2) < df['low'])
        df['swing_low'] = df['low'].shift(2).where(is_swing_low, None)

        # Forward fill the last known swing levels to track structure
        df['last_swing_high'] = df['swing_high'].ffill()
        df['last_swing_low'] = df['swing_low'].ffill()
        
        return df
