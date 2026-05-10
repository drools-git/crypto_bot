import json
from datetime import datetime, timezone, date
from pathlib import Path
from typing import Dict, Any, List
from loguru import logger

DATA_DIR = Path("data/records")
RISK_FILE = DATA_DIR / "risk_state.json"

class RiskManager:
    """
    Handles institutional-grade risk controls.
    - Tracks daily drawdown
    - Tracks consecutive losses
    - Manages the system Kill Switch
    """
    def __init__(self):
        self.max_daily_dd = 0.03    # 3% max loss per day
        self.max_cons_losses = 5    # Halt after 5 losses
        self.risk_per_trade = 0.01  # 1% equity risk per trade
        self.max_positions = 3
        
        self.kill_switch_active = False
        self.kill_switch_reason = ""
        
        self.daily_pnl = 0.0
        self.consecutive_losses = 0
        self.last_reset_date = date.today().isoformat()
        
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self):
        if RISK_FILE.exists():
            try:
                with open(RISK_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.kill_switch_active = data.get("kill_switch_active", False)
                    self.kill_switch_reason = data.get("kill_switch_reason", "")
                    self.daily_pnl = data.get("daily_pnl", 0.0)
                    self.consecutive_losses = data.get("consecutive_losses", 0)
                    self.last_reset_date = data.get("last_reset_date", date.today().isoformat())
                    
                # Reset daily if date changed
                if self.last_reset_date != date.today().isoformat():
                    self._reset_daily()
            except Exception as e:
                logger.error(f"[RiskManager] Load error: {e}")

    def _save(self):
        with open(RISK_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "kill_switch_active": self.kill_switch_active,
                "kill_switch_reason": self.kill_switch_reason,
                "daily_pnl": self.daily_pnl,
                "consecutive_losses": self.consecutive_losses,
                "last_reset_date": self.last_reset_date,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }, f, indent=2)

    def _reset_daily(self):
        logger.info("[RiskManager] Resetting daily risk metrics.")
        self.daily_pnl = 0.0
        self.last_reset_date = date.today().isoformat()
        # We don't necessarily reset kill_switch_active unless manually cleared or conditions met
        if "Daily Drawdown exceeded" in self.kill_switch_reason:
            self.kill_switch_active = False
            self.kill_switch_reason = ""
        self._save()

    def validate_new_trade(self, current_equity: float, active_positions_count: int) -> tuple[bool, str]:
        """Checks if a new trade can be opened based on risk rules."""
        if self.kill_switch_active:
            return False, f"KILL SWITCH ACTIVE: {self.kill_switch_reason}"
        
        if active_positions_count >= self.max_positions:
            return False, f"Max positions reached ({self.max_positions})"
            
        if self.daily_pnl <= -(current_equity * self.max_daily_dd):
            self.activate_kill_switch("Daily Drawdown exceeded")
            return False, "Daily Drawdown exceeded"
            
        if self.consecutive_losses >= self.max_cons_losses:
            self.activate_kill_switch(f"{self.max_cons_losses} consecutive losses")
            return False, "Max consecutive losses reached"
            
        return True, "OK"

    def update_on_trade_close(self, realized_pnl: float, equity_before: float):
        """Update metrics when a trade is closed."""
        self.daily_pnl += realized_pnl
        
        if realized_pnl < 0:
            self.consecutive_losses += 1
        else:
            self.consecutive_losses = 0
            
        # Check for immediate kill switch trigger
        if self.daily_pnl <= -(equity_before * self.max_daily_dd):
            self.activate_kill_switch("Daily Drawdown exceeded")
            
        if self.consecutive_losses >= self.max_cons_losses:
            self.activate_kill_switch(f"{self.max_cons_losses} consecutive losses")
            
        self._save()

    def activate_kill_switch(self, reason: str):
        if not self.kill_switch_active:
            self.kill_switch_active = True
            self.kill_switch_reason = reason
            logger.critical(f"[RiskManager] KILL SWITCH ACTIVATED: {reason}")
            self._save()

    def get_status(self) -> Dict[str, Any]:
        return {
            "kill_switch_active": self.kill_switch_active,
            "kill_switch_reason": self.kill_switch_reason,
            "daily_pnl": round(self.daily_pnl, 2),
            "consecutive_losses": self.consecutive_losses,
            "max_daily_dd_limit": round(self.max_daily_dd * 100, 1)
        }

risk_manager = RiskManager()
