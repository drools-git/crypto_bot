from abc import ABC, abstractmethod
import pandas as pd

class BaseIndicator(ABC):
    @abstractmethod
    def calculate(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Takes a OHLCV DataFrame and appends indicator columns.
        Required columns in df: 'time', 'open', 'high', 'low', 'close', 'volume'
        """
        pass
