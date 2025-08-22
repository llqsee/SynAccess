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
    """Application lifespan manager for startup and shutdown."""
    
    # Startup phase
    print("Starting MAVIS backend services...")
    try:
        # Setup logging
        setup_logging(log_file="logs/mavis.log", log_level="DEBUG")
        print("✓ Logging system initialized")
        
        # Start background task queue
        task_queue = get_task_queue_manager()
        try:
            task_queue.start()
            print("✓ Background task queue started")
        except Exception as e:
            print(f"⚠ Task queue startup failed (this is normal in test environments): {e}")
            # Continue without task queue for testing
        
        # Initialize AI analysis if configured
        if settings.anthropic_api_key and settings.enable_ai_analysis:
            try:
                ai_agent = initialize_ai_agent(settings.anthropic_api_key)
                if ai_agent and ai_agent.is_service_available():
                    print("✓ AI analysis service ready")
                else:
                    print("⚠ AI analysis service unavailable")
            except Exception as e:
                print(f"⚠ Failed to initialize AI service: {e}")
        else:
            print("ℹ AI analysis disabled (no API key)")
            
    except Exception as e:
        print(f"✗ Startup failed: {e}")
        raise
    
    yield
    
    # Shutdown phase
    print("Shutting down MAVIS services...")
    try:
        # Stop background tasks
        task_queue = get_task_queue_manager()
        if hasattr(task_queue, 'running') and task_queue.running:
            print("Stopping background tasks...")
            task_queue.stop()
            print("✓ Background tasks stopped")
        else:
            print("ℹ No background tasks to stop")
        
        # Brief pause for cleanup
        import asyncio
        await asyncio.sleep(0.1)
        
        print("✓ Shutdown complete")
    except Exception as e:
        print(f"⚠ Shutdown error: {e}")

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
    import signal
    import sys
    
    # Configure graceful shutdown
    def signal_handler(sig, frame):
        print("\nReceived shutdown signal, shutting down gracefully...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the server with better shutdown handling
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        access_log=False,  # Reduce logging noise during shutdown
        log_level="info"
    ) 