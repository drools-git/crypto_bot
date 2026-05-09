import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from loguru import logger
from typing import Dict, Any, List

DATA_DIR = Path("data/records")
PORTFOLIO_FILE = DATA_DIR / "portfolio.json"
TRADES_FILE = DATA_DIR / "trades.csv"

class PaperTradingEngine:
    def __init__(self, initial_balance: float = 100000.0, fee_rate: float = 0.001, slippage_pct: float = 0.0005):
        self.initial_balance = initial_balance
        self.fee_rate = fee_rate
        self.slippage_pct = slippage_pct
        
        self.balance = initial_balance
        self.positions: Dict[str, Dict[str, Any]] = {}
        self.equity_curve: List[Dict[str, Any]] = []
        
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self):
        if PORTFOLIO_FILE.exists():
            try:
                with open(PORTFOLIO_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.balance = data.get("balance", self.initial_balance)
                    self.positions = data.get("positions", {})
                    self.equity_curve = data.get("equity_curve", [])
            except Exception as e:
                logger.error(f"Failed to load portfolio: {e}")

        # If no CSV, initialize it
        if not TRADES_FILE.exists():
            with open(TRADES_FILE, "w", encoding="utf-8") as f:
                f.write("trade_id,timestamp,symbol,side,type,price,size_base,size_quote,fee,realized_pnl,reasoning\n")

    def _save(self, current_price: float = None):
        with open(PORTFOLIO_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "balance": self.balance,
                "positions": self.positions,
                "equity_curve": self.equity_curve[-500:],  # keep last 500
                "last_updated": datetime.now(timezone.utc).isoformat()
            }, f, indent=2)

    def _append_trade_csv(self, trade: Dict[str, Any]):
        with open(TRADES_FILE, "a", encoding="utf-8") as f:
            f.write(f"{trade['trade_id']},{trade['timestamp']},{trade['symbol']},{trade['side']},{trade['type']},"
                    f"{trade['price']},{trade['size_base']},{trade['size_quote']},{trade['fee']},"
                    f"{trade['realized_pnl']},{trade['reasoning']}\n")

    def get_portfolio(self, current_prices: Dict[str, float] = None) -> Dict[str, Any]:
        """Calculate real-time equity based on current market prices."""
        if current_prices is None:
            current_prices = {}

        unrealized_pnl = 0.0
        enriched_positions = []

        for sym, pos in self.positions.items():
            price = current_prices.get(sym, pos["entry_price"])
            pnl = 0.0
            if pos["side"] == "LONG":
                pnl = (price - pos["entry_price"]) * pos["size_base"]
            elif pos["side"] == "SHORT":
                pnl = (pos["entry_price"] - price) * pos["size_base"]
            
            pnl_pct = (pnl / pos["cost"]) * 100 if pos["cost"] > 0 else 0
            unrealized_pnl += pnl

            enriched_pos = pos.copy()
            enriched_pos["current_price"] = price
            enriched_pos["unrealized_pnl"] = pnl
            enriched_pos["unrealized_pnl_pct"] = pnl_pct
            enriched_positions.append(enriched_pos)

        total_equity = self.balance + sum(p["cost"] for p in self.positions.values()) + unrealized_pnl
        
        # Track equity curve
        if len(self.equity_curve) == 0 or (datetime.now(timezone.utc).timestamp() - datetime.fromisoformat(self.equity_curve[-1]["timestamp"]).timestamp() > 3600):
             self.equity_curve.append({
                 "timestamp": datetime.now(timezone.utc).isoformat(),
                 "equity": total_equity
             })
             self._save()

        return {
            "balance": self.balance,
            "total_equity": total_equity,
            "unrealized_pnl": unrealized_pnl,
            "realized_pnl": total_equity - self.initial_balance - unrealized_pnl,
            "positions": enriched_positions
        }

    def process_signal(self, signal: Dict[str, Any]):
        """Executes trading logic based on autonomous signal."""
        direction = signal["direction"]
        symbol = signal["symbol"]
        price = signal["price"]
        reasoning = " | ".join(signal["reasoning"]) if isinstance(signal["reasoning"], list) else str(signal["reasoning"])

        if direction == "EXIT":
            self.close_position(symbol, price, reasoning)
        elif direction in ["LONG", "SHORT"]:
            self.open_position(symbol, direction, price, reasoning)

    def open_position(self, symbol: str, side: str, price: float, reasoning: str, risk_pct: float = 0.10):
        """Open a new position. Uses risk_pct of current equity."""
        # 1. Close existing opposite position
        if symbol in self.positions and self.positions[symbol]["side"] != side:
            self.close_position(symbol, price, f"Reversing to {side}")

        # If already in the same direction, ignore or add (for now, ignore)
        if symbol in self.positions and self.positions[symbol]["side"] == side:
            return

        # 2. Calculate sizing
        equity = self.get_portfolio({symbol: price})["total_equity"]
        alloc_quote = equity * risk_pct
        
        if alloc_quote > self.balance:
            alloc_quote = self.balance # cap at available balance

        if alloc_quote < 10.0:
            logger.warning(f"[PaperTrading] Insufficient balance to open {side} on {symbol}")
            return

        # Apply slippage
        exec_price = price * (1 + self.slippage_pct) if side == "LONG" else price * (1 - self.slippage_pct)
        size_base = alloc_quote / exec_price
        
        # Apply fee
        fee = alloc_quote * self.fee_rate
        cost = alloc_quote
        self.balance -= (cost + fee)

        trade_id = str(uuid.uuid4())[:8]
        self.positions[symbol] = {
            "id": trade_id,
            "symbol": symbol,
            "side": side,
            "entry_price": exec_price,
            "size_base": size_base,
            "cost": cost,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        trade = {
            "trade_id": trade_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "symbol": symbol,
            "side": side,
            "type": "MARKET_OPEN",
            "price": exec_price,
            "size_base": size_base,
            "size_quote": cost,
            "fee": fee,
            "realized_pnl": 0.0,
            "reasoning": reasoning
        }
        self._append_trade_csv(trade)
        self._save()
        logger.success(f"[PaperTrading] OPEN {side} {symbol} @ {exec_price:.2f} (Size: {size_base:.4f})")

    def close_position(self, symbol: str, price: float, reasoning: str):
        if symbol not in self.positions:
            return

        pos = self.positions.pop(symbol)
        side = pos["side"]
        
        # Apply slippage
        exec_price = price * (1 - self.slippage_pct) if side == "LONG" else price * (1 + self.slippage_pct)
        
        # Calculate return
        value_quote = 0.0
        if side == "LONG":
            value_quote = pos["size_base"] * exec_price
        else:
            pnl_base = (pos["entry_price"] - exec_price) * pos["size_base"]
            value_quote = pos["cost"] + pnl_base

        fee = value_quote * self.fee_rate
        net_return = value_quote - fee
        self.balance += net_return

        realized_pnl = net_return - pos["cost"]

        trade = {
            "trade_id": pos["id"] + "-CLOSE",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "symbol": symbol,
            "side": side,
            "type": "MARKET_CLOSE",
            "price": exec_price,
            "size_base": pos["size_base"],
            "size_quote": value_quote,
            "fee": fee,
            "realized_pnl": realized_pnl,
            "reasoning": reasoning
        }
        self._append_trade_csv(trade)
        self._save()
        logger.info(f"[PaperTrading] CLOSED {side} {symbol} @ {exec_price:.2f} | PNL: {realized_pnl:.2f} USDT")

    def get_recent_trades(self, limit: int = 10) -> List[Dict[str, Any]]:
        trades = []
        if not TRADES_FILE.exists():
            return trades
            
        with open(TRADES_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()[1:] # skip header
            for line in reversed(lines): # read backwards
                if not line.strip(): continue
                parts = line.strip().split(",", 10)
                if len(parts) < 11: continue
                trades.append({
                    "trade_id": parts[0],
                    "timestamp": parts[1],
                    "symbol": parts[2],
                    "side": parts[3],
                    "type": parts[4],
                    "price": float(parts[5]),
                    "size_base": float(parts[6]),
                    "size_quote": float(parts[7]),
                    "fee": float(parts[8]),
                    "realized_pnl": float(parts[9]),
                    "reasoning": parts[10]
                })
                if len(trades) >= limit:
                    break
        return trades

paper_trading_engine = PaperTradingEngine()
