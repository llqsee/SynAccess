from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Any, Dict, Optional
import uuid
from datetime import datetime
import base64
import pickle

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

class PreTrainedModelRequest(BaseModel):
    real_data: List[List[Any]] = Field(..., description="Real dataset")
    synthetic_data: List[List[Any]] = Field(..., description="Synthetic dataset")
    model_data: str = Field(..., description="Base64 encoded pickled model")
    model_format: str = Field(..., description="Model format (pickle, joblib)")
    method: str = Field(..., description="Embedding method (umap, tsne)")
    real_headers: Optional[List[str]] = Field(None, description="Real data headers")
    synthetic_headers: Optional[List[str]] = Field(None, description="Synthetic data headers")
    fine_tune: bool = Field(False, description="Whether to fine-tune the model on real data")

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

@router.post("/embed-pretrained")
async def compute_embedding_with_pretrained_model(request: PreTrainedModelRequest):
    """Compute embeddings using a pre-trained model."""
    try:
        # Validate data format
        validate_data_format(request.real_data, request.synthetic_data)
        
        # Decode the model
        try:
            model_bytes = base64.b64decode(request.model_data)
            if request.model_format == 'pickle':
                try:
                    model = pickle.loads(model_bytes)
                except (pickle.UnpicklingError, ValueError, EOFError) as e:
                    raise ValueError(f"Invalid pickle file: {str(e)}")
            elif request.model_format == 'joblib':
                import joblib
                try:
                    model = joblib.loads(model_bytes)
                except Exception as e:
                    raise ValueError(f"Invalid joblib file: {str(e)}")
            else:
                raise ValueError(f"Unsupported model format: {request.model_format}")
            
            # Validate that it's a UMAP or t-SNE model
            if not hasattr(model, 'fit') and not hasattr(model, 'transform'):
                raise ValueError("Uploaded file does not appear to be a valid UMAP or t-SNE model")
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to load model: {str(e)}")
        
        # Generate job and task IDs
        job_id = str(uuid.uuid4())
        task_id = str(uuid.uuid4())
        
        # Create job record
        JobService.create_job(
            job_id=job_id,
            method=request.method,
            params={
                "pretrained_model": True, 
                "model_format": request.model_format,
                "n_real_samples": len(request.real_data),
                "n_synth_samples": len(request.synthetic_data),
                "fine_tune": request.fine_tune
            },
            n_samples=None,
            status="queued"
        )
        
        # Create embedding task with pre-trained model
        task = EmbeddingTask(
            task_id=task_id,
            job_id=job_id,
            real_data=request.real_data,
            synthetic_data=request.synthetic_data,
            method=request.method,
            params={
                "pretrained_model": True, 
                "model_format": request.model_format,
                "n_real_samples": len(request.real_data),
                "n_synth_samples": len(request.synthetic_data),
                "fine_tune": request.fine_tune
            },
            n_samples=None,
            real_headers=request.real_headers,
            synthetic_headers=request.synthetic_headers,
            pretrained_model=model
        )
        
        # Submit to task queue
        task_queue = get_task_queue_manager()
        task_queue.submit_task(task)
        
        # Get initial queue status
        queue_status = task_queue.get_queue_status()
        task_status = task_queue.get_task_status(task_id)
        
        logger.info(f"Pre-trained model embedding job {job_id} submitted to queue")
        
        response_data = {
            "job_id": job_id,
            "task_id": task_id,
            "status": "running",
            "message": "Pre-trained model embedding computation started successfully",
            "queue_position": task_status.queue_position if task_status else None,
            "estimated_wait_time": None,
            "queue_info": {
                "total_queued": queue_status["queued_tasks"],
                "currently_processing": queue_status["processing_tasks"],
                "active_workers": queue_status["active_workers"],
                "total_workers": queue_status["total_workers"]
            },
            "original_data": {
                "real_data": request.real_data,
                "synthetic_data": request.synthetic_data,
                "real_headers": request.real_headers,
                "synthetic_headers": request.synthetic_headers
            }
        }
        
        return response_data
        
    except ValueError as e:
        if 'job_id' in locals():
            JobService.mark_job_failed(job_id, str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if 'job_id' in locals():
            JobService.mark_job_failed(job_id, str(e))
        logger.error(f"Error in pre-trained model embedding: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 