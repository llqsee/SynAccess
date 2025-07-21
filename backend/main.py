from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from contextlib import asynccontextmanager

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from routes.embed import router as embed_router
from routes.distribution import router as distribution_router
from routes.history import router as history_router
from routes.queue import router as queue_router
from services.task_queue import get_task_queue_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        task_queue = get_task_queue_manager()
        task_queue.start()
        print("Task queue started successfully")
    except Exception as e:
        print(f"Failed to start task queue: {e}")
    
    yield
    
    # Shutdown
    try:
        task_queue = get_task_queue_manager()
        if hasattr(task_queue, 'running') and task_queue.running:
            task_queue.stop()
        print("Task queue stopped successfully")
    except Exception as e:
        print(f"Failed to stop task queue: {e}")

app = FastAPI(title="MAVIS API", lifespan=lifespan)

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
api_router.include_router(queue_router)
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 