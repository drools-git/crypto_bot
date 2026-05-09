from fastapi import APIRouter
from typing import List, Dict, Any
from app.execution.signal_engine import signal_engine

router = APIRouter(tags=["Execution"])

@router.get("/signals/history", summary="Get official signal history and quality")
async def get_signal_history() -> List[Dict[str, Any]]:
    """
    Returns the autonomous signal engine's official historical signals,
    including their real-time quality (unrealized PNL).
    """
    return signal_engine.get_history()
