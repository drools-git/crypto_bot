from fastapi import APIRouter, Query
from typing import List
from app.news.news_manager import news_engine
from app.news.models import NewsArticle

router = APIRouter(prefix="/news", tags=["news"])

@router.get("/latest", response_model=List[NewsArticle])
async def get_latest_news(limit: int = Query(20, description="Max number of articles to return")):
    """Get the latest aggregated news from all configured sources."""
    return await news_engine.get_aggregated_news(limit)
