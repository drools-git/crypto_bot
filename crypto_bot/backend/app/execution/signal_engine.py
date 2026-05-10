import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

from loguru import logger
import pandas as pd
from app.strategies.manager import strategy_manager
from app.market.market_data_manager import market_data_engine
from app.indicators.engine import indicator_engine
from app.strategies.models import SignalType
from app.execution.paper_trading import paper_trading_engine
from app.execution.risk_manager import risk_manager

DATA_DIR = Path("data/records")
SIGNAL_FILE = DATA_DIR / "signal_history.json"

class SignalEngine:
    """
    Autonomous background engine that continuously polls data, runs strategies,
    computes consensus, and logs official trading signals.
    """
    def __init__(self):
        self._running = False
        self._task = None
        self._last_direction = SignalType.HOLD.value
        self._poll_interval = 60 # seconds

        # Ensure directory
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not SIGNAL_FILE.exists():
            with open(SIGNAL_FILE, "w", encoding="utf-8") as f:
                json.dump([], f)
        
        # Restore last direction
        history = self.get_history()
        if history:
            self._last_direction = history[0].get("direction", "HOLD")

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("[SignalEngine] Autonomous signal engine started.")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        logger.info("[SignalEngine] Autonomous signal engine stopped.")

    def get_history(self) -> List[Dict[str, Any]]:
        try:
            with open(SIGNAL_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_history(self, data: List[Dict[str, Any]]):
        with open(SIGNAL_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def _evaluate_quality(self, history: List[Dict[str, Any]], current_price: float) -> List[Dict[str, Any]]:
        """
        Calculates signal quality (unrealized PNL % based on current price).
        """
        for sig in history:
            if sig.get("status") == "CLOSED":
                continue

            entry = sig.get("price", 0)
            if entry <= 0:
                continue

            direction = sig.get("direction")
            if direction == "LONG":
                pnl = (current_price - entry) / entry
            elif direction == "SHORT":
                pnl = (entry - current_price) / entry
            else:
                pnl = 0.0

            sig["unrealized_pnl"] = round(pnl * 100, 2)
            sig["current_price"] = current_price
            
            # Simple take profit / stop loss check based on strategy params could be added here
            
        return history

    async def _loop(self):
        symbol = "BTC/USDT"
        timeframe = "1h"
        
        while self._running:
            try:
                # 1. Fetch data
                klines = await market_data_engine.get_historical_ohlcv(symbol, timeframe, 150)
                if not klines:
                    await asyncio.sleep(self._poll_interval)
                    continue

                df = pd.DataFrame([{
                    "time": k.time, "open": k.open, "high": k.high,
                    "low": k.low, "close": k.close, "volume": k.volume,
                } for k in klines])

                # 2. Enrich with indicators
                df = indicator_engine.add_indicators(df)

                # 2b. Abnormal Volatility Check (Kill Switch)
                if len(df) > 20:
                    current_atr = df.iloc[-1]["atr"]
                    avg_atr = df.iloc[-20:-1]["atr"].mean()
                    if current_atr > avg_atr * 3.0:
                        risk_manager.activate_kill_switch(f"Abnormal Volatility (ATR {current_atr:.2f} > 3x avg)")

                # 2c. Connectivity Guard (Kill Switch)
                # Check if market data engine is updating (heartbeat)
                last_update = getattr(market_data_engine, 'last_update_time', None)
                if last_update:
                    elapsed = (datetime.now(timezone.utc) - last_update).total_seconds()
                    if elapsed > 30:
                         risk_manager.activate_kill_switch("WebSocket Connectivity Failure")

                # 3. Get Consensus
                signals = strategy_manager.run_all(df, symbol, timeframe)
                consensus = strategy_manager.get_consensus(signals)

                current_price = df.iloc[-1]["close"]
                direction = consensus["direction"]
                confidence = consensus["confidence"]
                
                # Update history quality with current price
                history = self.get_history()
                history = self._evaluate_quality(history, current_price)

                # 4. Emit Official Signal if high confidence and changed direction
                # For paper trading, we might only act on LONG/SHORT/EXIT if conf > 0.50
                if direction in ["LONG", "SHORT", "EXIT"] and confidence >= 0.50:
                    if direction != self._last_direction:
                        logger.info(f"[SignalEngine] NEW OFFICIAL SIGNAL: {direction} ({confidence*100:.1f}%) @ {current_price}")
                        
                        new_signal = {
                            "id": datetime.now(timezone.utc).isoformat(),
                            "symbol": symbol,
                            "direction": direction,
                            "confidence": confidence,
                            "price": current_price,
                            "reasoning": [s["strategy_name"] for s in consensus["signals"] if s["signal"] == direction],
                            "unrealized_pnl": 0.0,
                            "status": "OPEN" if direction in ["LONG", "SHORT"] else "CLOSED"
                        }
                        
                        # If EXIT, close previous open signals
                        if direction == "EXIT":
                            for h in history:
                                if h["status"] == "OPEN":
                                    h["status"] = "CLOSED"
                                    h["exit_price"] = current_price
                        
                        history.insert(0, new_signal)
                        # Keep only last 100 to avoid bloat
                        history = history[:100]
                        self._last_direction = direction
                        
                        # Process official signal in Paper Trading Engine
                        paper_trading_engine.process_signal(new_signal)

                # 5. Dynamic Risk: Check SL / TP for open positions
                paper_trading_engine.update_trailing_stops({symbol: current_price})
                
                for sym, pos in list(paper_trading_engine.positions.items()):
                    sl = pos.get("stop_loss")
                    tp = pos.get("take_profit")
                    if sl and tp:
                        hit_sl = (pos["side"] == "LONG" and current_price <= sl) or (pos["side"] == "SHORT" and current_price >= sl)
                        hit_tp = (pos["side"] == "LONG" and current_price >= tp) or (pos["side"] == "SHORT" and current_price <= tp)
                        
                        if hit_sl or hit_tp:
                            reason = "Stop Loss hit" if hit_sl else "Take Profit hit"
                            paper_trading_engine.close_position(sym, current_price, reason)
                            logger.info(f"[SignalEngine] {reason} for {sym} at {current_price}")
                            self._last_direction = "HOLD" # reset

                self._save_history(history)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[SignalEngine] Error in loop: {e}")

            await asyncio.sleep(self._poll_interval)

signal_engine = SignalEngine()
