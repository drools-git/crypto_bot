import pandas as pd
from ta.momentum import RSIIndicator
from ta.trend import MACD
from app.indicators.base import BaseIndicator

class MomentumIndicators(BaseIndicator):
    def calculate(self, df: pd.DataFrame) -> pd.DataFrame:
        if len(df) < 30: return df
        # RSI
        df['rsi'] = RSIIndicator(close=df['close'], window=14).rsi()
        
        # MACD
        macd = MACD(close=df['close'])
        df['macd'] = macd.macd()
        df['macd_signal'] = macd.macd_signal()
        df['macd_hist'] = macd.macd_diff()
        return df
