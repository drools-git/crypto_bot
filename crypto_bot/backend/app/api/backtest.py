# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException, Query
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from typing import List, Dict, Any
from app.market.history_downloader import history_downloader
from app.execution.backtest_engine import backtest_engine

router = APIRouter(prefix="/backtest", tags=["Backtest"])

class DownloadRequest(BaseModel):
    symbol: str
    timeframe: str
    days: int

class RunRequest(BaseModel):
    filename: str
    initial_balance: float = 100000.0

@router.get("/files")
async def list_history_files():
    return history_downloader.list_files()

@router.post("/download")
async def download_history(req: DownloadRequest):
    try:
        filename = await history_downloader.download_range(req.symbol, req.timeframe, req.days)
        return {"status": "success", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/run")
async def run_backtest(req: RunRequest):
    try:
        results = await backtest_engine.run(req.filename, req.initial_balance)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/progress")
async def get_backtest_progress():
    return {
        "progress": backtest_engine.progress,
        "is_running": backtest_engine.is_running
    }
