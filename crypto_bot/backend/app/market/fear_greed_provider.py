import httpx
from typing import Dict, Any, List, Optional
from app.market.base_provider import BaseProvider
from app.market.models import OHLCV, Ticker

class FearGreedProvider(BaseProvider):
    def __init__(self):
        super().__init__("fear_greed")
        self.url = "https://api.alternative.me/fng/"

    async def _fetch_data_impl(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(self.url, params={"limit": 1})
            response.raise_for_status()
            data = response.json()
            if data and data.get("data"):
                return {
                    "value": int(data["data"][0]["value"]),
                    "classification": data["data"][0]["value_classification"],
                    "timestamp": int(data["data"][0]["timestamp"])
                }
            return {}

    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[OHLCV]:
        raise NotImplementedError("Fear and Greed index does not provide OHLCV")

    async def fetch_ticker(self, symbol: str) -> Optional[Ticker]:
        raise NotImplementedError("Fear and Greed index does not provide tickers")

    async def get_index(self) -> Dict[str, Any]:
        return await self._measure_latency(self._fetch_data_impl)
        
    async def close(self):
        pass
