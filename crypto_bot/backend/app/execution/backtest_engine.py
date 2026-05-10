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
        
    def run(self, filename: str, initial_balance: float = 100000.0) -> Dict[str, Any]:
        self.is_running = True
        self.progress = 0
        try:
            filepath = HISTORY_DIR / filename
            if not filepath.exists():
                raise FileNotFoundError(f"History file {filename} not found")
                
            df = pd.read_csv(filepath)
            if len(df) < 200:
                raise ValueError("Insufficient data for backtesting (need at least 200 candles)")

            balance = initial_balance
            equity = initial_balance
            position = None # None, or {"side": "LONG"|"SHORT", "entry": float, "size": float, "sl": float, "tp": float}
            trades = []
            equity_curve = []
            
            # We start from index 150 to have enough data for indicators
            for i in range(150, len(df)):
                current_row = df.iloc[i]
                timestamp = current_row["time"]
                current_price = current_row["close"]
                
                # 1. Update Position (Check SL/TP)
                if position:
                    side = position["side"]
                    # Check for exit signals or SL/TP
                    hit_sl = (side == "LONG" and current_row["low"] <= position["sl"]) or \
                             (side == "SHORT" and current_row["high"] >= position["sl"])
                    hit_tp = (side == "LONG" and current_row["high"] >= position["tp"]) or \
                             (side == "SHORT" and current_row["low"] <= position["tp"])
                    
                    if hit_sl or hit_tp:
                        exit_price = position["sl"] if hit_sl else position["tp"]
                        # Adjust for slippage on exit
                        exec_exit = exit_price * (1 - self.slippage_pct) if side == "LONG" else exit_price * (1 + self.slippage_pct)
                        
                        # Calculate PNL
                        if side == "LONG":
                            pnl = (exec_exit - position["entry"]) * position["size"]
                        else:
                            pnl = (position["entry"] - exec_exit) * position["size"]
                            
                        fee = (position["size"] * exec_exit) * self.fee_rate
                        balance += (position["cost"] + pnl - fee)
                        
                        trades.append({
                            "exit_time": datetime.fromtimestamp(timestamp).isoformat(),
                            "side": side,
                            "entry": position["entry"],
                            "exit": exec_exit,
                            "pnl": pnl - fee,
                            "reason": "SL" if hit_sl else "TP"
                        })
                        position = None

                # 2. Strategy Analysis (Only if no position or to check reversal)
                # Use data up to current index i
                sub_df = df.iloc[:i+1].copy()
                sub_df = indicator_engine.add_indicators(sub_df)
                
                # Get signals
                symbol = filename.split("_")[0]
                timeframe = "1h" # Assume for now
                signals = strategy_manager.run_all(sub_df, symbol, timeframe)
                consensus = strategy_manager.get_consensus(signals)
                
                direction = consensus["direction"]
                confidence = consensus["confidence"]
                
                if direction in ["LONG", "SHORT"] and confidence >= 0.50 and not position:
                    # Open Position
                    # Risk 1% of current balance
                    risk_amount = balance * 0.01
                    sl_pct = 0.015
                    tp_pct = 0.045
                    
                    exec_entry = current_price * (1 + self.slippage_pct) if direction == "LONG" else current_price * (1 - self.slippage_pct)
                    sl_price = exec_entry * (1 - sl_pct) if direction == "LONG" else exec_entry * (1 + sl_pct)
                    tp_price = exec_entry * (1 + tp_pct) if direction == "LONG" else exec_entry * (1 - tp_pct)
                    
                    price_diff = abs(exec_entry - sl_price)
                    size = risk_amount / price_diff
                    cost = size * exec_entry
                    
                    if cost <= balance:
                        fee = cost * self.fee_rate
                        balance -= (cost + fee)
                        position = {
                            "side": direction,
                            "entry": exec_entry,
                            "size": size,
                            "cost": cost,
                            "sl": sl_price,
                            "tp": tp_price
                        }
                
                elif direction == "EXIT" and position:
                    # Manual Strategy Exit
                    exec_exit = current_price * (1 - self.slippage_pct) if position["side"] == "LONG" else current_price * (1 + self.slippage_pct)
                    if position["side"] == "LONG":
                        pnl = (exec_exit - position["entry"]) * position["size"]
                    else:
                        pnl = (position["entry"] - exec_exit) * position["size"]
                    
                    fee = (position["size"] * exec_exit) * self.fee_rate
                    balance += (position["cost"] + pnl - fee)
                    trades.append({
                        "exit_time": datetime.fromtimestamp(timestamp).isoformat(),
                        "side": position["side"],
                        "entry": position["entry"],
                        "exit": exec_exit,
                        "pnl": pnl - fee,
                        "reason": "STRATEGY_EXIT"
                    })
                    position = None

                # Track Equity
                current_equity = balance
                if position:
                    unrealized = (current_price - position["entry"]) * position["size"] if position["side"] == "LONG" else (position["entry"] - current_price) * position["size"]
                    current_equity += (position["cost"] + unrealized)
                
                equity_curve.append({"time": int(timestamp), "equity": current_equity})

                # Update Progress
                self.progress = int(((i - 150) / (len(df) - 150)) * 100)

            # Final Results
            total_pnl = balance - initial_balance
            win_rate = len([t for t in trades if t["pnl"] > 0]) / len(trades) if trades else 0
            
            return {
                "summary": {
                    "initial_balance": initial_balance,
                    "final_balance": balance,
                    "total_pnl": total_pnl,
                    "pnl_pct": (total_pnl / initial_balance) * 100,
                    "total_trades": len(trades),
                    "win_rate": win_rate * 100,
                },
                "trades": trades[-50:], # last 50
                "equity_curve": equity_curve[::10] # downsample for chart
            }
        finally:
            self.is_running = False
            self.progress = 100

backtest_engine = BacktestEngine()
