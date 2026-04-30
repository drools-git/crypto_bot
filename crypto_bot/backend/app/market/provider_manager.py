from typing import List, Dict, Any, Optional
from loguru import logger
from app.market.binance_provider import BinanceProvider
from app.market.coingecko_provider import CoinGeckoProvider
from app.market.fear_greed_provider import FearGreedProvider
from app.market.models import OHLCV, Ticker, MarketHealth

class ProviderManager:
    def __init__(self):
        self.binance = BinanceProvider()
        self.coingecko = CoinGeckoProvider()
        self.fear_greed = FearGreedProvider()
        
        # Abstraction routing
        self.providers = {
            "binance": self.binance,
            "coingecko": self.coingecko,
            "fear_greed": self.fear_greed
        }

    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int = 100) -> List[OHLCV]:
        """Fetch OHLCV primarily from CoinGecko, fallback to Binance on failure."""
        try:
            logger.info(f"Attempting to fetch OHLCV for {symbol} from CoinGecko")
            return await self.coingecko.fetch_ohlcv(symbol, timeframe, limit)
        except Exception as e:
            logger.warning(f"CoinGecko OHLCV failed ({e}), falling back to Binance")
            return await self.binance.fetch_ohlcv(symbol, timeframe, limit)

    async def fetch_ticker(self, symbol: str) -> Optional[Ticker]:
        """Fetch ticker primarily from Binance for execution accuracy."""
        try:
            return await self.binance.fetch_ticker(symbol)
        except Exception as e:
            logger.warning(f"Binance Ticker failed ({e}), falling back to CoinGecko")
            return await self.coingecko.fetch_ticker(symbol)

    async def fetch_fear_greed(self) -> Dict[str, Any]:
        return await self.fear_greed.get_index()

    def get_health_status(self) -> List[MarketHealth]:
        return [p.get_health() for p in self.providers.values()]
        
    async def close(self):
        for provider in self.providers.values():
            await provider.close()
