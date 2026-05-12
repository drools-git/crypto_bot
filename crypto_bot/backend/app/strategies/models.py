from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class SignalType(str, Enum):
    LONG  = "LONG"
    SHORT = "SHORT"
    EXIT  = "EXIT"
    HOLD  = "HOLD"


class StrategyConfig(BaseModel):
    """Configurable parameters for any strategy. Extended per-strategy via extra fields."""
    enabled: bool = True
    weight: int = 50  # 1 to 100
    params: Dict[str, Any] = Field(default_factory=dict)


class Signal(BaseModel):
    """Output produced by a strategy's generate_signal()."""
    strategy_id: str
    strategy_name: str
    signal: SignalType
    confidence: float = Field(..., ge=0.0, le=1.0, description="0 = no confidence, 1 = full confidence")
    symbol: str
    timeframe: str
    reasoning: str = ""
    risk: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
