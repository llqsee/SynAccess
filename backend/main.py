from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from contextlib import asynccontextmanager

import sys
import os
from pathlib import Path

# Add the parent directory to Python path so we can import from backend
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
sys.path.insert(0, str(parent_dir))

from backend.routes.embed import router as embed_router
from backend.routes.distribution import router as distribution_router
from backend.routes.history import router as history_router
from backend.routes.queue import router as queue_router
from backend.routes.ai_analysis import router as ai_analysis_router
from backend.routes.anomaly_detection import router as anomaly_detection_router
from backend.routes.validation import router as validation_router
from backend.routes.gpu import router as gpu_router
from backend.services.task_queue import get_task_queue_manager
from backend.services.ai_analysis_service import initialize_ai_agent
from backend.config import settings
from backend.utils.logging_config import setup_logging

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        # Setup logging to file
        setup_logging(log_file="logs/mavis.log", log_level="DEBUG")
        print("Logging configured to logs/mavis.log")
        
        # Initialize task queue
        task_queue = get_task_queue_manager()
        task_queue.start()
        print("Task queue started successfully")
        
        # Initialize AI agent if API key is available
        if settings.anthropic_api_key and settings.enable_ai_analysis:
            try:
                ai_agent = initialize_ai_agent(settings.anthropic_api_key)
                if ai_agent and ai_agent.is_service_available():
                    print("AI Statistician agent initialized successfully")
                else:
                    print("AI Statistician agent initialization failed")
            except Exception as e:
                print(f"Failed to initialize AI agent: {e}")
        else:
            print("AI analysis disabled or API key not configured")
            
    except Exception as e:
        print(f"Failed to start services: {e}")
    
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
api_router.include_router(ai_analysis_router)
api_router.include_router(anomaly_detection_router)
api_router.include_router(validation_router)
api_router.include_router(gpu_router)
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 