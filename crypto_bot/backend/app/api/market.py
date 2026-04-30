from fastapi import APIRouter, HTTPException
import ccxt.async_support as ccxt
from typing import List, Dict, Any

router = APIRouter(prefix="/market", tags=["market"])

@router.get("/klines")
async def get_klines(symbol: str = "BTC/USDT", timeframe: str = "1h", limit: int = 100):
    """
    Fetch historical klines (candlestick data) from Binance public API.
    """
    exchange = ccxt.binance()
    try:
        # Fetch OHLCV data
        ohlcv = await exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        
        # Format for Lightweight Charts
        formatted_data = []
        for candle in ohlcv:
            formatted_data.append({
                "time": candle[0] // 1000, # Convert ms to s
                "open": candle[1],
                "high": candle[2],
                "low": candle[3],
                "close": candle[4]
            })
        
        return formatted_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await exchange.close()
