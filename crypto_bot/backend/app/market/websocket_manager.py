import asyncio
import json
import websockets
from typing import Dict, Any, Callable, List
from loguru import logger

class BinanceWebSocketManager:
    def __init__(self):
        self.base_url = "wss://stream.binance.com:9443/ws"
        self.connections: Dict[str, websockets.WebSocketClientProtocol] = {}
        self.callbacks: Dict[str, List[Callable]] = {}
        self.running_tasks: Dict[str, asyncio.Task] = {}
        self.reconnect_delays: Dict[str, int] = {}
        
    def add_callback(self, stream_name: str, callback: Callable):
        if stream_name not in self.callbacks:
            self.callbacks[stream_name] = []
        self.callbacks[stream_name].append(callback)

    async def _stream_handler(self, stream_name: str):
        url = f"{self.base_url}/{stream_name}"
        self.reconnect_delays[stream_name] = 1

        while True:
            try:
                logger.info(f"Connecting to WS stream: {stream_name}")
                async with websockets.connect(url) as ws:
                    self.connections[stream_name] = ws
                    self.reconnect_delays[stream_name] = 1 # Reset delay on successful connect
                    
                    while True:
                        msg = await ws.recv()
                        data = json.loads(msg)
                        
                        # Dispatch to callbacks
                        if stream_name in self.callbacks:
                            for cb in self.callbacks[stream_name]:
                                asyncio.create_task(cb(stream_name, data))
                                
            except websockets.exceptions.ConnectionClosed as e:
                logger.warning(f"WS {stream_name} connection closed: {e}")
            except Exception as e:
                logger.error(f"WS {stream_name} encountered error: {e}")
            
            # Reconnection logic with exponential backoff
            delay = self.reconnect_delays[stream_name]
            logger.info(f"Reconnecting {stream_name} in {delay} seconds...")
            await asyncio.sleep(delay)
            self.reconnect_delays[stream_name] = min(delay * 2, 60)

    def start_stream(self, stream_name: str):
        if stream_name not in self.running_tasks or self.running_tasks[stream_name].done():
            task = asyncio.create_task(self._stream_handler(stream_name))
            self.running_tasks[stream_name] = task
            
    async def close_all(self):
        for task in self.running_tasks.values():
            task.cancel()
        for ws in self.connections.values():
            await ws.close()
