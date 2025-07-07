from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from routes.embed import router as embed_router
from routes.distribution import router as distribution_router
from routes.history import router as history_router

app = FastAPI(title="MAVIS API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create main API router
api_router = APIRouter(prefix="/api/v1")

@api_router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

# Include all routers
api_router.include_router(embed_router)
api_router.include_router(distribution_router)
api_router.include_router(history_router)
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 