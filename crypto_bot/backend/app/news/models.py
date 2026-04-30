from pydantic import BaseModel

class NewsArticle(BaseModel):
    id: str
    title: str
    url: str
    source: str
    published_at: int
    summary: str
