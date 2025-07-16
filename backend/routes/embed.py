from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Any, Dict, Optional
import uuid
from datetime import datetime

from services.embedding import EmbeddingService
from services.job_service import JobService
from services.task_queue import get_task_queue_manager, EmbeddingTask
from utils.validation import validate_data_format
from utils.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)

class EmbeddingRequest(BaseModel):
    real_data: List[List[Any]] = Field(..., description="Real dataset")
    synthetic_data: List[List[Any]] = Field(..., description="Synthetic dataset")
    method: str = Field(..., description="Embedding method (umap, tsne, pca)")
    params: Dict[str, Any] = Field(default_factory=dict, description="Method parameters")
    n_samples: Optional[int] = Field(None, description="Number of samples to use")
    real_headers: Optional[List[str]] = Field(None, description="Real data headers")
    synthetic_headers: Optional[List[str]] = Field(None, description="Synthetic data headers")

@router.post("/embed")
async def compute_embedding(request: EmbeddingRequest):
    """Compute embeddings for real and synthetic data."""
    try:
        # Validate data format
        validate_data_format(request.real_data, request.synthetic_data)
        
        # Generate job and task IDs
        job_id = str(uuid.uuid4())
        task_id = str(uuid.uuid4())
        
        # Create job record
        JobService.create_job(
            job_id=job_id,
            method=request.method,
            params=request.params,
            n_samples=request.n_samples,
            status="queued"
        )
        
        # Create embedding task
        task = EmbeddingTask(
            task_id=task_id,
            job_id=job_id,
            real_data=request.real_data,
            synthetic_data=request.synthetic_data,
            method=request.method,
            params=request.params,
            n_samples=request.n_samples,
            real_headers=request.real_headers,
            synthetic_headers=request.synthetic_headers
        )
        
        # Submit to task queue
        task_queue = get_task_queue_manager()
        task_queue.submit_task(task)
        
        # Get initial queue status
        queue_status = task_queue.get_queue_status()
        task_status = task_queue.get_task_status(task_id)
        
        logger.info(f"Embedding job {job_id} submitted to queue")
        
        # Include original data in response for immediate distribution plot access
        # This ensures the frontend has access to the data even before compression completes
        response_data = {
            "job_id": job_id,
            "task_id": task_id,
            "status": "running",
            "message": "Embedding computation started successfully",
            "queue_position": task_status.queue_position if task_status else None,
            "estimated_wait_time": None,  # Could implement this later
            "queue_info": {
                "total_queued": queue_status["queued_tasks"],
                "currently_processing": queue_status["processing_tasks"],
                "active_workers": queue_status["active_workers"],
                "total_workers": queue_status["total_workers"]
            },
            # Include original data for immediate distribution plot access
            "original_data": {
                "real_data": request.real_data,
                "synthetic_data": request.synthetic_data,
                "real_headers": request.real_headers,
                "synthetic_headers": request.synthetic_headers
            }
        }
        
        return response_data
        
    except ValueError as e:
        # Mark job as failed if it was created
        if 'job_id' in locals():
            JobService.mark_job_failed(job_id, str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Mark job as failed if it was created
        if 'job_id' in locals():
            JobService.mark_job_failed(job_id, str(e))
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 