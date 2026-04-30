import pandas as pd
from ta.volume import OnBalanceVolumeIndicator
from app.indicators.base import BaseIndicator

class VolumeIndicators(BaseIndicator):
    def calculate(self, df: pd.DataFrame) -> pd.DataFrame:
        if len(df) < 20: return df
        # OBV
        df['obv'] = OnBalanceVolumeIndicator(close=df['close'], volume=df['volume']).on_balance_volume()
        
        # Volume SMA
        df['volume_sma'] = df['volume'].rolling(window=20).mean()
        
        # Volume spikes (volume > 2 * volume_sma)
        df['volume_spike'] = (df['volume'] > (df['volume_sma'] * 2)).astype(int)
        return df
