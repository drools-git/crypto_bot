import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, List
from loguru import logger
from app.strategies.manager import strategy_manager
from app.indicators.engine import indicator_engine
from datetime import datetime

HISTORY_DIR = Path("data/history")

class BacktestEngine:
    def __init__(self):
        self.fee_rate = 0.001
        self.slippage_pct = 0.0005
        self.progress = 0
        self.is_running = False
        
    async def run(self, filename: str, initial_balance: float = 100000.0) -> Dict[str, Any]:
        self.is_running = True
        self.progress = 0
        try:
            filepath = HISTORY_DIR / filename
            if not filepath.exists():
                raise FileNotFoundError(f"History file {filename} not found")
                
            df = pd.read_csv(filepath)
            if len(df) < 200:
                raise ValueError("Insufficient data for backtesting (need at least 200 candles)")

            df = indicator_engine.add_indicators(df)

            balance = initial_balance
            position = None 
            trades = []
            equity_curve = []
            markers = [] # For the chart
            
            total_steps = len(df) - 150
            
            for i in range(150, len(df)):
                current_row = df.iloc[i]
                timestamp = int(current_row["time"])
                current_price = current_row["close"]
                
                if i % 10 == 0:
                    self.progress = int(((i - 150) / total_steps) * 100)
                    # Small sleep to allow progress bar to be visible in local super-fast execution
                    await asyncio.sleep(0.001)

                # 1. Update Position (Check SL/TP)
                if position:
                    side = position["side"]
                    hit_sl = (side == "LONG" and current_row["low"] <= position["sl"]) or \
                             (side == "SHORT" and current_row["high"] >= position["sl"])
                    hit_tp = (side == "LONG" and current_row["high"] >= position["tp"]) or \
                             (side == "SHORT" and current_row["low"] <= position["tp"])
                    
                    if hit_sl or hit_tp:
                        exit_price = position["sl"] if hit_sl else position["tp"]
                        exec_exit = exit_price * (1 - self.slippage_pct) if side == "LONG" else exit_price * (1 + self.slippage_pct)
                        
                        pnl = (exec_exit - position["entry"]) * position["size"] if side == "LONG" else (position["entry"] - exec_exit) * position["size"]
                        fee = (position["size"] * exec_exit) * self.fee_rate
                        balance += (position["cost"] + pnl - fee)
                        
                        reason = "SL" if hit_sl else "TP"
                        trades.append({
                            "exit_time": datetime.fromtimestamp(timestamp).isoformat(),
                            "side": side, "entry": position["entry"], "exit": exec_exit,
                            "pnl": pnl - fee, "reason": reason
                        })
                        
                        markers.append({
                            "time": timestamp,
                            "position": "aboveBar" if side == "LONG" else "belowBar",
                            "color": "#f59e0b",
                            "shape": "arrowDown" if side == "LONG" else "arrowUp",
                            "text": f"Close {reason}"
                        })
                        position = None

                # 2. Strategy Analysis
                sub_df = df.iloc[:i+1]
                signals = strategy_manager.run_all(sub_df, "BTC/USDT", "1h")
                consensus = strategy_manager.get_consensus(signals)
                
                direction = consensus["direction"]
                confidence = consensus["confidence"]
                
                if direction in ["LONG", "SHORT"] and confidence >= 0.50 and not position:
                    risk_amount = balance * 0.01
                    sl_pct, tp_pct = 0.015, 0.045
                    
                    exec_entry = current_price * (1 + self.slippage_pct) if direction == "LONG" else current_price * (1 - self.slippage_pct)
                    sl_price = exec_entry * (1 - sl_pct) if direction == "LONG" else exec_entry * (1 + sl_pct)
                    tp_price = exec_entry * (1 + tp_pct) if direction == "LONG" else exec_entry * (1 - tp_pct)
                    
                    price_diff = abs(exec_entry - sl_price)
                    size = risk_amount / price_diff
                    cost = size * exec_entry
                    
                    if cost <= balance:
                        fee = cost * self.fee_rate
                        balance -= (cost + fee)
                        position = {"side": direction, "entry": exec_entry, "size": size, "cost": cost, "sl": sl_price, "tp": tp_price}
                        
                        markers.append({
                            "time": timestamp,
                            "position": "belowBar" if direction == "LONG" else "aboveBar",
                            "color": "#10b981" if direction == "LONG" else "#ef4444",
                            "shape": "arrowUp" if direction == "LONG" else "arrowDown",
                            "text": f"Open {direction}"
                        })
                
                elif direction == "EXIT" and position:
                    exec_exit = current_price * (1 - self.slippage_pct) if position["side"] == "LONG" else current_price * (1 + self.slippage_pct)
                    pnl = (exec_exit - position["entry"]) * position["size"] if position["side"] == "LONG" else (position["entry"] - exec_exit) * position["size"]
                    fee = (position["size"] * exec_exit) * self.fee_rate
                    balance += (position["cost"] + pnl - fee)
                    trades.append({
                        "exit_time": datetime.fromtimestamp(timestamp).isoformat(),
                        "side": position["side"], "entry": position["entry"], "exit": exec_exit, "pnl": pnl - fee, "reason": "STRATEGY_EXIT"
                    })
                    markers.append({
                        "time": timestamp,
                        "position": "aboveBar" if position["side"] == "LONG" else "belowBar",
                        "color": "#f59e0b",
                        "shape": "arrowDown" if position["side"] == "LONG" else "arrowUp",
                        "text": "Strategy Exit"
                    })
                    position = None

                current_equity = balance
                if position:
                    unrealized = (current_price - position["entry"]) * position["size"] if position["side"] == "LONG" else (position["entry"] - current_price) * position["size"]
                    current_equity += (position["cost"] + unrealized)
                
                equity_curve.append({"time": timestamp, "equity": current_equity})

            total_pnl = balance - initial_balance
            win_rate = len([t for t in trades if t["pnl"] > 0]) / len(trades) if trades else 0
            
            # Price data for chart (downsampled)
            price_data = df.iloc[150:][::1].copy() # We can send more data now that we have indicators
            ohlc_data = price_data[["time", "open", "high", "low", "close"]].to_dict(orient="records")

            return {
                "summary": {
                    "initial_balance": initial_balance, "final_balance": balance,
                    "total_pnl": total_pnl, "pnl_pct": (total_pnl / initial_balance) * 100,
                    "total_trades": len(trades), "win_rate": win_rate * 100,
                },
                "trades": trades[-50:],
                "equity_curve": equity_curve,
                "price_data": ohlc_data,
                "markers": markers
            }
        finally:
            self.is_running = False
            self.progress = 100
        finally:
            self.is_running = False
            self.progress = 100

backtest_engine = BacktestEngine()
