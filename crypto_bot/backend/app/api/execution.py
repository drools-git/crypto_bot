from fastapi import APIRouter
from typing import List, Dict, Any
from app.execution.signal_engine import signal_engine
from app.execution.paper_trading import paper_trading_engine
from app.market.market_data_manager import market_data_engine

router = APIRouter(tags=["Execution"])

@router.get("/signals/history", summary="Get official signal history and quality")
async def get_signal_history() -> List[Dict[str, Any]]:
    """
    Returns the autonomous signal engine's official historical signals,
    including their real-time quality (unrealized PNL).
    """
    return signal_engine.get_history()

@router.get("/portfolio", summary="Get paper trading portfolio state")
async def get_portfolio() -> Dict[str, Any]:
    """Returns balance, equity, and open positions."""
    # We should fetch current prices to calculate unrealized PNL
    # For now, we will just use latest cached price or let the engine use entry price if missing
    try:
        klines = await market_data_engine.get_historical_ohlcv("BTC/USDT", "1m", 1)
        current_price = klines[-1].close if klines else None
        prices = {"BTC/USDT": current_price} if current_price else {}
    except Exception:
        prices = {}
        
    return paper_trading_engine.get_portfolio(prices)

@router.get("/trades", summary="Get recent simulated trades")
async def get_recent_trades(limit: int = 10) -> List[Dict[str, Any]]:
    """Returns recent paper trades."""
    return paper_trading_engine.get_recent_trades(limit)
