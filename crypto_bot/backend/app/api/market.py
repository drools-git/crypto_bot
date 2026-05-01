from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any
from app.market.market_data_manager import market_data_engine
from app.indicators.engine import indicator_engine
import pandas as pd
from app.market.models import OHLCV, MarketHealth

router = APIRouter(prefix="/market", tags=["market"])

@router.get("/klines", response_model=List[OHLCV])
async def get_klines(
    symbol: str = Query("BTC/USDT"), 
    timeframe: str = Query("1h"), 
    limit: int = Query(100)
):
    """Fetch OHLCV primarily from CoinGecko, fallback to Binance."""
    try:
        return await market_data_engine.get_historical_ohlcv(symbol, timeframe, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ticker/live")
async def get_live_ticker(symbol: str = Query("BTCUSDT")):
    """Get live ticker data powered by Binance WebSocket with REST fallback."""
    ticker = market_data_engine.get_realtime_ticker(symbol)
    if not ticker:
        # Fallback to REST if WS hasn't populated yet
        try:
            return await market_data_engine.provider_manager.fetch_ticker(symbol)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Ticker not available yet via WS or REST.")
    return ticker
    
@router.get("/orderbook/live")
async def get_live_orderbook(symbol: str = Query("BTCUSDT")):
    """Get order book depth data powered by Binance WebSocket."""
    ob = market_data_engine.get_orderbook(symbol)
    if not ob:
        raise HTTPException(status_code=503, detail="Orderbook stream is still initializing.")
    return ob

@router.get("/health", response_model=List[MarketHealth])
async def get_market_health():
    """Source health monitoring and latency logging."""
    return market_data_engine.provider_manager.get_health_status()

@router.get("/fear-and-greed")
async def get_fear_and_greed():
    """Get Fear and Greed Index from Alternative.me."""
    try:
        return await market_data_engine.provider_manager.fetch_fear_greed()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/indicators", response_model=List[Dict[str, Any]])
async def get_klines_with_indicators(
    symbol: str = Query(..., example="BTC/USDT"),
    timeframe: str = Query("1h", example="1h"),
    limit: int = Query(200, ge=1, le=1000)
):
    """Get historical OHLCV data enriched with all technical indicators."""
    klines = await market_data_engine.get_historical_ohlcv(symbol, timeframe, limit)
    if not klines:
        return []
        
    df = pd.DataFrame([{
        "time": k.time,
        "open": k.open,
        "high": k.high,
        "low": k.low,
        "close": k.close,
        "volume": k.volume
    } for k in klines])
    
    # CoinGecko OHLC does not return volume. Supplement from Binance klines.
    if df['volume'].sum() == 0:
        try:
            from app.market.market_data_manager import market_data_engine as mde
            binance = mde.provider_manager.providers.get("binance")
            if binance:
                bin_klines = await binance.fetch_ohlcv(symbol, timeframe, limit)
                if bin_klines:
                    vol_map = {k.time: k.volume for k in bin_klines}
                    df['volume'] = df['time'].map(vol_map).fillna(0.0)
        except Exception:
            pass  # Volume stays 0 if Binance fails
    
    df = indicator_engine.add_indicators(df)
    
    # We must convert float NaNs and Infs to None to be JSON compliant
    import numpy as np
    df = df.replace([np.inf, -np.inf, np.nan], None)
    
    return df.to_dict(orient='records')
