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
            
        # Trim warm-up rows: drop leading rows where key indicators are still NaN.
        # This ensures ALL series (candles + indicators) start at the same timestamp,
        # preventing visual misalignment in the frontend charts.
        key_cols = [c for c in ['rsi', 'macd', 'adx', 'atr', 'bb_mid'] if c in df.columns]
        if key_cols:
            # Find the first row where ALL key indicators have values
            valid_mask = df[key_cols].notna().all(axis=1)
            first_valid_idx = valid_mask.idxmax() if valid_mask.any() else None
            if first_valid_idx is not None:
                df = df.loc[first_valid_idx:].reset_index(drop=True)
            
        return df

indicator_engine = IndicatorEngine()
