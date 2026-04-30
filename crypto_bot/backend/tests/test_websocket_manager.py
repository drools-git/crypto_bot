import pytest
from app.market.websocket_manager import BinanceWebSocketManager

@pytest.mark.asyncio
async def test_add_callback():
    ws_manager = BinanceWebSocketManager()
    
    async def dummy_callback(stream_name, data):
        pass
        
    ws_manager.add_callback("btcusdt@ticker", dummy_callback)
    
    assert "btcusdt@ticker" in ws_manager.callbacks
    assert len(ws_manager.callbacks["btcusdt@ticker"]) == 1
    
    await ws_manager.close_all()
