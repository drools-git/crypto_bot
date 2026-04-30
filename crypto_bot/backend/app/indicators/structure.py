import pandas as pd
from app.indicators.base import BaseIndicator

class StructureIndicators(BaseIndicator):
    def calculate(self, df: pd.DataFrame) -> pd.DataFrame:
        window = 20
        df['support'] = df['low'].rolling(window=window, min_periods=1).min()
        df['resistance'] = df['high'].rolling(window=window, min_periods=1).max()
        
        # Breakout detection (1 for bull breakout, -1 for bear breakout, 0 otherwise)
        df['breakout_bull'] = (df['close'] > df['resistance'].shift(1)).astype(int)
        df['breakout_bear'] = (df['close'] < df['support'].shift(1)).astype(int)
        
        return df
