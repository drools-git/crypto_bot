"""
Strategies API
──────────────
Endpoints:
  GET  /strategies/              — list all strategies + status
  GET  /strategies/{id}          — single strategy metadata
  POST /strategies/{id}/enable   — enable a strategy
  POST /strategies/{id}/disable  — disable a strategy
  POST /strategies/{id}/params   — hot-update configurable params
  GET  /strategies/signals       — run all enabled strategies and return signals
  GET  /strategies/consensus     — run all and return aggregated consensus
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Any, Dict, List, Optional

import pandas as pd
import numpy as np

from app.strategies.manager import strategy_manager
from app.strategies.models import Signal
from app.strategies.strategy_logger import strategy_logger
from app.market.market_data_manager import market_data_engine
from app.indicators.engine import indicator_engine

router = APIRouter(prefix="/strategies", tags=["strategies"])


# ── helpers ──────────────────────────────────────────────────────────── #

async def _get_enriched_df(symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
    """Fetch OHLCV from market engine and enrich with indicators."""
    klines = await market_data_engine.get_historical_ohlcv(symbol, timeframe, min(1000, limit + 100))
    if not klines:
        raise HTTPException(status_code=503, detail="No market data available.")

    df = pd.DataFrame([{
        "time": k.time, "open": k.open, "high": k.high,
        "low": k.low, "close": k.close, "volume": k.volume,
    } for k in klines])

    df = indicator_engine.add_indicators(df)
    df = df.replace([np.inf, -np.inf], np.nan)
    return df


# ── endpoints ─────────────────────────────────────────────────────────── #

@router.get("/", summary="List all strategies")
def list_strategies() -> List[Dict[str, Any]]:
    return strategy_manager.list_strategies()


@router.get("/signals", summary="Run all enabled strategies and return individual signals")
async def get_signals(
    symbol: str    = Query("BTC/USDT"),
    timeframe: str = Query("1h"),
    limit: int     = Query(300, ge=50, le=1000),
) -> List[Dict[str, Any]]:
    df      = await _get_enriched_df(symbol, timeframe, limit)
    signals = strategy_manager.run_all(df, symbol, timeframe)
    return [s.model_dump() for s in signals]


@router.get("/consensus", summary="Run all enabled strategies and return consensus signal")
async def get_consensus(
    symbol: str    = Query("BTC/USDT"),
    timeframe: str = Query("1h"),
    limit: int     = Query(300, ge=50, le=1000),
) -> Dict[str, Any]:
    df      = await _get_enriched_df(symbol, timeframe, limit)
    signals = strategy_manager.run_all(df, symbol, timeframe)
    return strategy_manager.get_consensus(signals)


@router.get("/{strategy_id}", summary="Get single strategy metadata")
def get_strategy(strategy_id: str) -> Dict[str, Any]:
    try:
        strats = {s["strategy_id"]: s for s in strategy_manager.list_strategies()}
        if strategy_id not in strats:
            raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found.")
        return strats[strategy_id]
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found.")


@router.post("/{strategy_id}/enable", summary="Enable a strategy")
def enable_strategy(strategy_id: str) -> Dict[str, str]:
    try:
        strategy_manager.enable(strategy_id)
        return {"status": "enabled", "strategy_id": strategy_id}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found.")


@router.post("/{strategy_id}/disable", summary="Disable a strategy")
def disable_strategy(strategy_id: str) -> Dict[str, str]:
    try:
        strategy_manager.disable(strategy_id)
        return {"status": "disabled", "strategy_id": strategy_id}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found.")


@router.post("/{strategy_id}/params", summary="Hot-update strategy parameters")
def update_params(
    strategy_id: str,
    params: Dict[str, Any] = Body(..., example={"adx_threshold": 30, "stop_loss_pct": 0.02}),
) -> Dict[str, Any]:
    try:
        strategy_manager.update_params(strategy_id, params)
        strats = {s["strategy_id"]: s for s in strategy_manager.list_strategies()}
        return strats[strategy_id]
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found.")


@router.get("/log-config", summary="Get current strategy logging configuration")
def get_log_config() -> Dict[str, Any]:
    return {
        "enabled":             strategy_logger.enabled,
        "verbose":             strategy_logger.verbose,
        "per_strategy_files":  strategy_logger.per_strategy_files,
        "log_directory":       str(strategy_logger.__class__.__module__),
    }


@router.post("/log-config", summary="Update strategy logging configuration at runtime")
def set_log_config(
    enabled:            Optional[bool] = Body(None),
    verbose:            Optional[bool] = Body(None),
    per_strategy_files: Optional[bool] = Body(None),
) -> Dict[str, Any]:
    """
    Toggle logging on/off or switch verbose mode without restarting the server.

    Body (all fields optional):
    {
        "enabled": true,       // master switch
        "verbose": false,      // include full indicator snapshot per signal
        "per_strategy_files": true  // write individual strategy log files
    }
    """
    if enabled is not None:
        strategy_logger.enabled = enabled
    if verbose is not None:
        strategy_logger.verbose = verbose
    if per_strategy_files is not None:
        strategy_logger.per_strategy_files = per_strategy_files
    return get_log_config()
