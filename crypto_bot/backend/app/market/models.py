from pydantic import BaseModel
from typing import List, Optional

class OHLCV(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float

class Ticker(BaseModel):
    symbol: str
    price: float
    bid: float
    ask: float
    volume: float
    timestamp: int

class OrderBook(BaseModel):
    symbol: str
    bids: List[List[float]] # [price, quantity]
    asks: List[List[float]]
    timestamp: int

class MarketHealth(BaseModel):
    provider_name: str
    is_healthy: bool
    latency_ms: float
    rate_limit_remaining: Optional[int]
