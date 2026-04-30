import pytest
from unittest.mock import patch

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@patch('app.market.market_data_manager.market_data_engine.get_historical_ohlcv')
def test_get_klines(mock_get_ohlcv, client):
    mock_get_ohlcv.return_value = [{"time": 1000, "open": 1, "high": 2, "low": 1, "close": 2, "volume": 100}]
    response = client.get("/api/v1/market/klines?symbol=BTCUSDT")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["time"] == 1000

@patch('app.market.market_data_manager.market_data_engine.get_realtime_ticker')
@patch('app.market.market_data_manager.market_data_engine.provider_manager.fetch_ticker')
def test_get_live_ticker_ws_hit(mock_fetch_ticker, mock_get_rt_ticker, client):
    # Test WebSocket hit
    mock_get_rt_ticker.return_value = {"price": 50000}
    response = client.get("/api/v1/market/ticker/live?symbol=BTCUSDT")
    assert response.status_code == 200
    assert response.json()["price"] == 50000

@patch('app.market.market_data_manager.market_data_engine.get_realtime_ticker')
@patch('app.market.market_data_manager.market_data_engine.provider_manager.fetch_ticker')
def test_get_live_ticker_fallback_hit(mock_fetch_ticker, mock_get_rt_ticker, client):
    # Test REST Fallback hit
    mock_get_rt_ticker.return_value = None
    mock_fetch_ticker.return_value = {"symbol": "BTCUSDT", "price": 49000, "bid": 0, "ask": 0, "volume": 0, "timestamp": 0}
    response = client.get("/api/v1/market/ticker/live?symbol=BTCUSDT")
    assert response.status_code == 200
    assert response.json()["price"] == 49000

def test_get_live_orderbook_not_initialized(client):
    response = client.get("/api/v1/market/orderbook/live?symbol=UNKNOWN")
    assert response.status_code == 503
