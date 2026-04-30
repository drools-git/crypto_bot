import sys
import os
from loguru import logger
from app.core.config import settings

def setup_logging():
    """Initialize system-wide logging configuration with formatting and rotation."""
    # Ensure log directory exists
    os.makedirs(settings.LOG_DIR, exist_ok=True)
    
    logger.remove()  # Remove default handler
    
    # Add console handler
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="INFO"
    )
    
    # Add root file handler
    log_file = os.path.join(settings.LOG_DIR, "trading_bot.log")
    logger.add(
        log_file,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="DEBUG",
        rotation="10 MB",
        retention="1 month",
        compression="zip"
    )
    
    logger.info("Logging configured successfully.")
