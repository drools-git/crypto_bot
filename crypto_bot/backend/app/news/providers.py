import feedparser
import time
from typing import List
from loguru import logger
from app.news.models import NewsArticle
from time import mktime
import asyncio

class RSSNewsProvider:
    def __init__(self, name: str, rss_url: str):
        self.name = name
        self.rss_url = rss_url

    async def fetch_latest_news(self, limit: int = 10) -> List[NewsArticle]:
        try:
            # feedparser runs synchronously, offload to thread to avoid blocking event loop
            import urllib.request
            req = urllib.request.Request(self.rss_url, headers={'User-Agent': 'CryptoBot/1.0'})
            feed = await asyncio.to_thread(
                lambda: feedparser.parse(urllib.request.urlopen(req, timeout=5).read())
            )
            
            articles = []
            for entry in feed.entries[:limit]:
                # Parse timestamp safely
                published_time = int(time.time())
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    published_time = int(mktime(entry.published_parsed))
                
                # Clean up summary
                summary = entry.get('summary', '')
                if '<' in summary:
                    # Very basic strip of HTML tags if present
                    import re
                    summary = re.sub('<[^<]+?>', '', summary)
                
                articles.append(NewsArticle(
                    id=entry.get('id', entry.link),
                    title=entry.title,
                    url=entry.link,
                    source=self.name,
                    published_at=published_time,
                    summary=summary[:300] + "..." if len(summary) > 300 else summary
                ))
            return articles
        except Exception as e:
            logger.error(f"[{self.name}] Error fetching news: {e}")
            return []

class CoinTelegraphProvider(RSSNewsProvider):
    def __init__(self):
        super().__init__("CoinTelegraph", "https://cointelegraph.com/rss")

class CoinDeskProvider(RSSNewsProvider):
    def __init__(self):
        super().__init__("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/")
