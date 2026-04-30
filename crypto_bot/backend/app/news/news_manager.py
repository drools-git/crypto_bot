from typing import List
import asyncio
from loguru import logger
from app.news.providers import CoinTelegraphProvider, CoinDeskProvider
from app.news.models import NewsArticle

class NewsManager:
    def __init__(self):
        self.providers = [
            CoinTelegraphProvider(),
            CoinDeskProvider()
        ]

    async def get_aggregated_news(self, limit: int = 20) -> List[NewsArticle]:
        """Fetch news concurrently from all providers and sort by time."""
        tasks = [provider.fetch_latest_news(limit) for provider in self.providers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        aggregated = []
        for res in results:
            if isinstance(res, list):
                aggregated.extend(res)
            else:
                logger.error(f"News fetch failed: {res}")
                
        # Sort by published_at descending (newest first)
        aggregated.sort(key=lambda x: x.published_at, reverse=True)
        return aggregated[:limit]

# Singleton
news_engine = NewsManager()
