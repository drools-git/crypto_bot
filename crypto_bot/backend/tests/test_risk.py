import pytest
from app.execution.risk_manager import RiskManager

def test_risk_manager_daily_dd():
    rm = RiskManager()
    rm.daily_pnl = 0
    rm.kill_switch_active = False
    
    # Simulate a big loss exceeding 3% of 100k equity
    equity = 100000
    loss = -4000 
    rm.update_on_trade_close(loss, equity)
    
    assert rm.kill_switch_active is True
    assert "Daily Drawdown" in rm.kill_switch_reason

def test_risk_manager_consecutive_losses():
    rm = RiskManager()
    rm.consecutive_losses = 0
    rm.kill_switch_active = False
    
    # 5 losses in a row
    for _ in range(5):
        rm.update_on_trade_close(-10, 100000)
        
    assert rm.kill_switch_active is True
    assert "consecutive losses" in rm.kill_switch_reason

def test_validate_new_trade_limits():
    rm = RiskManager()
    rm.kill_switch_active = False
    
    # Test max positions
    ok, reason = rm.validate_new_trade(100000, 3)
    assert ok is False
    assert "Max positions" in reason
