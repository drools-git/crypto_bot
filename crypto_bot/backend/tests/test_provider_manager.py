import pytest
from unittest.mock import AsyncMock
from app.market.provider_manager import ProviderManager

@pytest.mark.asyncio
async def test_fetch_ohlcv_failover():
    manager = ProviderManager()
    
    # Mock coingecko to fail
    manager.coingecko.fetch_ohlcv = AsyncMock(side_effect=Exception("API limit"))
    # Mock binance to succeed
    manager.binance.fetch_ohlcv = AsyncMock(return_value=[{"time": 123, "open": 1}])
    
    # It should fall back to binance
    result = await manager.fetch_ohlcv("BTC/USDT", "1h", 100)
    assert len(result) == 1
    assert result[0]["open"] == 1
    manager.binance.fetch_ohlcv.assert_called_once()
    
    await manager.close()

@pytest.mark.asyncio
async def test_health_status():
    manager = ProviderManager()
    health = manager.get_health_status()
    
    assert len(health) == 3 # Binance, Coingecko, FearGreed
    assert health[0].is_healthy == True
    
    await manager.close()
