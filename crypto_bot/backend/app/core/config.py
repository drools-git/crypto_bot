import os
from typing import List
from pydantic_settings import BaseSettings

# Calculate the root path of the bot (crypto_bot directory)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

class Settings(BaseSettings):
    PROJECT_NAME: str = "Crypto Trading Workstation"
    API_V1_STR: str = "/api/v1"
    
    # CORS (Localhost default for Next.js)
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:4000",
        "http://127.0.0.1:4000"
    ]

    # Exchange Keys (to be populated via .env)
    BINANCE_API_KEY: str = ""
    BINANCE_API_SECRET: str = ""
    
    # Data paths relative to backend root
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    LOG_DIR: str = os.path.join(BASE_DIR, "data", "logs")

    class Config:
        case_sensitive = True
        env_file = os.path.join(BASE_DIR, ".env")
        extra = "ignore"

settings = Settings()
