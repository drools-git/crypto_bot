import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.api.market import router as market_router
from loguru import logger

# Initialize global logging
setup_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Local-first Cryptocurrency Algorithmic Trading Workstation API"
)

# Include API Routers
app.include_router(market_router, prefix=settings.API_V1_STR)

# Configure CORS for local Next.js instance
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting up {settings.PROJECT_NAME} backend...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info(f"Shutting down {settings.PROJECT_NAME} backend...")

@app.get("/health")
def health_check():
    """Health check endpoint to verify backend status."""
    return {"status": "ok", "app": settings.PROJECT_NAME}

if __name__ == "__main__":
    logger.info("Initializing uvicorn server...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
