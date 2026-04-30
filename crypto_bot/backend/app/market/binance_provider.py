import ccxt.async_support as ccxt
from typing import List, Optional
from app.market.base_provider import BaseProvider
from app.market.models import OHLCV, Ticker

class BinanceProvider(BaseProvider):
    def __init__(self):
        super().__init__("binance")
        self.exchange = ccxt.binance({
            'enableRateLimit': True,
        })

    async def _fetch_ohlcv_impl(self, symbol: str, timeframe: str, limit: int) -> List[OHLCV]:
        formatted_symbol = symbol.replace("USDT", "/USDT") if "USDT" in symbol and "/" not in symbol else symbol
        data = await self.exchange.fetch_ohlcv(formatted_symbol, timeframe, limit=limit)
        return [OHLCV(time=c[0]//1000, open=c[1], high=c[2], low=c[3], close=c[4], volume=c[5]) for c in data]

    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[OHLCV]:
        return await self._measure_latency(self._fetch_ohlcv_impl, symbol, timeframe, limit)

    async def _fetch_ticker_impl(self, symbol: str) -> Optional[Ticker]:
        formatted_symbol = symbol.replace("USDT", "/USDT") if "USDT" in symbol and "/" not in symbol else symbol
        data = await self.exchange.fetch_ticker(formatted_symbol)
        return Ticker(
            symbol=symbol,
            price=data.get('last', 0.0) or 0.0,
            bid=data.get('bid', 0.0) or 0.0,
            ask=data.get('ask', 0.0) or 0.0,
            volume=data.get('baseVolume', 0.0) or 0.0,
            timestamp=data.get('timestamp', 0) or 0
        )

    async def fetch_ticker(self, symbol: str) -> Optional[Ticker]:
        return await self._measure_latency(self._fetch_ticker_impl, symbol)
        
    async def close(self):
        await self.exchange.close()
