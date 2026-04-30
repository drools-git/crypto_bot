import httpx
from typing import List, Optional
from app.market.base_provider import BaseProvider
from app.market.models import OHLCV, Ticker
import time

class CoinGeckoProvider(BaseProvider):
    def __init__(self):
        super().__init__("coingecko")
        self.base_url = "https://api.coingecko.com/api/v3"
        self.symbol_map = {
            "BTC": "bitcoin",
            "ETH": "ethereum",
            "SOL": "solana",
            "XRP": "ripple"
        }

    def _get_coin_id(self, symbol: str) -> str:
        base = symbol.split("/")[0].replace("USDT", "") if "/" in symbol else symbol.replace("USDT", "")
        return self.symbol_map.get(base, base.lower())

    async def _fetch_ohlcv_impl(self, symbol: str, timeframe: str, limit: int) -> List[OHLCV]:
        coin_id = self._get_coin_id(symbol)
        # CoinGecko uses days: 1/7/14/30/90/365/max
        days = "1"
        if timeframe in ["1d", "4h"]:
            days = "30"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/coins/{coin_id}/ohlc",
                params={"vs_currency": "usd", "days": days}
            )
            response.raise_for_status()
            data = response.json()
            
            # CoinGecko OHLC data format: [ [time, open, high, low, close] ]
            # Time is in ms, we need to standardize it
            formatted = []
            for c in data[-limit:]:
                formatted.append(OHLCV(
                    time=c[0]//1000, 
                    open=c[1], 
                    high=c[2], 
                    low=c[3], 
                    close=c[4], 
                    volume=0.0 # CoinGecko OHLC doesn't return volume
                ))
            return formatted

    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[OHLCV]:
        return await self._measure_latency(self._fetch_ohlcv_impl, symbol, timeframe, limit)

    async def _fetch_ticker_impl(self, symbol: str) -> Optional[Ticker]:
        coin_id = self._get_coin_id(symbol)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/simple/price",
                params={"ids": coin_id, "vs_currencies": "usd", "include_24hr_vol": "true"}
            )
            response.raise_for_status()
            data = response.json()
            if coin_id in data:
                return Ticker(
                    symbol=symbol,
                    price=data[coin_id].get("usd", 0.0),
                    bid=0.0,
                    ask=0.0,
                    volume=data[coin_id].get("usd_24h_vol", 0.0),
                    timestamp=int(time.time() * 1000)
                )
            return None

    async def fetch_ticker(self, symbol: str) -> Optional[Ticker]:
        return await self._measure_latency(self._fetch_ticker_impl, symbol)

    async def close(self):
        pass
