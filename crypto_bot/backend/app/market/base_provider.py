import time
from abc import ABC, abstractmethod
from typing import List, Optional
from loguru import logger
from app.market.models import OHLCV, Ticker, MarketHealth

class BaseProvider(ABC):
    def __init__(self, name: str):
        self.name = name
        self.is_healthy = True
        self.latency_ms = 0.0
        self.rate_limit_remaining = None

    async def _measure_latency(self, func, *args, **kwargs):
        start = time.time()
        try:
            result = await func(*args, **kwargs)
            self.latency_ms = (time.time() - start) * 1000
            self.is_healthy = True
            return result
        except Exception as e:
            self.is_healthy = False
            logger.error(f"[{self.name}] Error: {e}")
            raise e

    def get_health(self) -> MarketHealth:
        return MarketHealth(
            provider_name=self.name,
            is_healthy=self.is_healthy,
            latency_ms=self.latency_ms,
            rate_limit_remaining=self.rate_limit_remaining
        )

    @abstractmethod
    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[OHLCV]:
        pass

    @abstractmethod
    async def fetch_ticker(self, symbol: str) -> Optional[Ticker]:
        pass
        
    @abstractmethod
    async def close(self):
        pass
