from typing import Dict, Any, List
from loguru import logger
from app.market.provider_manager import ProviderManager
from app.market.websocket_manager import BinanceWebSocketManager
from app.market.models import OHLCV

class MarketDataManager:
    def __init__(self):
        self.provider_manager = ProviderManager()
        self.ws_manager = BinanceWebSocketManager()
        
        # In-memory storage for latest real-time execution data
        self.latest_tickers: Dict[str, Any] = {}
        self.latest_orderbooks: Dict[str, Any] = {}
        self.latest_trades: Dict[str, List[Any]] = {}
        
    def setup_streams(self, symbols: List[str]):
        """Initialize Binance WebSockets for specific execution symbols."""
        for symbol in symbols:
            # Format to lowercase for binance streams (e.g., btcusdt)
            stream_symbol = symbol.lower().replace("/", "")
            
            # Ticker stream
            ticker_stream = f"{stream_symbol}@ticker"
            self.ws_manager.add_callback(ticker_stream, self._handle_ws_message)
            self.ws_manager.start_stream(ticker_stream)
            
            # Depth (Orderbook) stream
            depth_stream = f"{stream_symbol}@depth20@100ms"
            self.ws_manager.add_callback(depth_stream, self._handle_ws_message)
            self.ws_manager.start_stream(depth_stream)
            
            # Trade stream
            trade_stream = f"{stream_symbol}@trade"
            self.ws_manager.add_callback(trade_stream, self._handle_ws_message)
            self.ws_manager.start_stream(trade_stream)

    async def _handle_ws_message(self, stream_name: str, data: Dict[str, Any]):
        """Central demux for incoming websocket messages based on stream_name."""
        try:
            if "@ticker" in stream_name:
                symbol = data.get("s", "")
                if symbol:
                    self.latest_tickers[symbol] = data
            elif "@depth" in stream_name:
                # stream_name looks like btcusdt@depth20@100ms
                symbol = stream_name.split("@")[0].upper()
                self.latest_orderbooks[symbol] = data
            elif "@trade" in stream_name:
                symbol = data.get("s", "")
                if symbol:
                    if symbol not in self.latest_trades:
                        self.latest_trades[symbol] = []
                    self.latest_trades[symbol].append(data)
                    self.latest_trades[symbol] = self.latest_trades[symbol][-100:] # Keep last 100
        except Exception as e:
            logger.error(f"Error handling WS message for {stream_name}: {e}")

    async def get_historical_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[OHLCV]:
        return await self.provider_manager.fetch_ohlcv(symbol, timeframe, limit)

    def get_realtime_ticker(self, symbol: str) -> Dict[str, Any]:
        formatted_symbol = symbol.replace("/", "").upper()
        return self.latest_tickers.get(formatted_symbol, {})
        
    def get_orderbook(self, symbol: str) -> Dict[str, Any]:
        formatted_symbol = symbol.replace("/", "").upper()
        return self.latest_orderbooks.get(formatted_symbol, {})

    async def close(self):
        await self.provider_manager.close()
        await self.ws_manager.close_all()

# Singleton instance
market_data_engine = MarketDataManager()
