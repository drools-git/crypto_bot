import pandas as pd
from ta.trend import EMAIndicator, ADXIndicator
from ta.volume import VolumeWeightedAveragePrice
from app.indicators.base import BaseIndicator

class TrendIndicators(BaseIndicator):
    def calculate(self, df: pd.DataFrame) -> pd.DataFrame:
        if len(df) < 20:
            return df  # Need at least some data
            
        # EMAs
        df['ema_20'] = EMAIndicator(close=df['close'], window=20).ema_indicator()
        df['ema_50'] = EMAIndicator(close=df['close'], window=50).ema_indicator()
        df['ema_200'] = EMAIndicator(close=df['close'], window=200).ema_indicator()
        
        # ADX
        adx = ADXIndicator(high=df['high'], low=df['low'], close=df['close'], window=14)
        df['adx'] = adx.adx()
        df['adx_pos'] = adx.adx_pos()
        df['adx_neg'] = adx.adx_neg()
        
        # VWAP (Rolling approximation for continuous markets)
        vwap = VolumeWeightedAveragePrice(high=df['high'], low=df['low'], close=df['close'], volume=df['volume'], window=14)
        df['vwap'] = vwap.volume_weighted_average_price()
        
        return df
