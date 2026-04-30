import pandas as pd
from typing import List
from app.indicators.base import BaseIndicator
from app.indicators.trend import TrendIndicators
from app.indicators.momentum import MomentumIndicators
from app.indicators.volatility import VolatilityIndicators
from app.indicators.volume import VolumeIndicators
from app.indicators.structure import StructureIndicators

class IndicatorEngine:
    def __init__(self):
        self.indicators: List[BaseIndicator] = [
            TrendIndicators(),
            MomentumIndicators(),
            VolatilityIndicators(),
            VolumeIndicators(),
            StructureIndicators()
        ]
        
    def add_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        required = ['time', 'open', 'high', 'low', 'close', 'volume']
        if not all(col in df.columns for col in required):
            return df
            
        for ind in self.indicators:
            df = ind.calculate(df)
            
        # Clean up NaNs created by rolling windows (fill with 0 or drop)
        df.fillna(0, inplace=True)
        return df

indicator_engine = IndicatorEngine()
