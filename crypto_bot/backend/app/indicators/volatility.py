import pandas as pd
from ta.volatility import AverageTrueRange, BollingerBands
from app.indicators.base import BaseIndicator

class VolatilityIndicators(BaseIndicator):
    def calculate(self, df: pd.DataFrame) -> pd.DataFrame:
        if len(df) < 20: return df
        # ATR
        df['atr'] = AverageTrueRange(high=df['high'], low=df['low'], close=df['close'], window=14).average_true_range()
        
        # Bollinger Bands
        bb = BollingerBands(close=df['close'], window=20, window_dev=2)
        df['bb_high'] = bb.bollinger_hband()
        df['bb_low'] = bb.bollinger_lband()
        df['bb_mid'] = bb.bollinger_mavg()
        return df
