from loguru import logger
from app.market.market_data_manager import market_data_engine

async def start_market_streams():
    logger.info("Initializing multi-source market data streams...")
    symbols = ["BTCUSDT", "ETHUSDT"]
    market_data_engine.setup_streams(symbols)
    
async def stop_market_streams():
    logger.info("Stopping market data streams...")
    await market_data_engine.close()
