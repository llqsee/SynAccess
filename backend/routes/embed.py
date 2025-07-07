from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any, Optional
import numpy as np
from pydantic import BaseModel
import uuid

from services.embedding import EmbeddingService
from services.job_service import JobService
from utils.validation import validate_embedding_params

router = APIRouter()
embedding_service = EmbeddingService()

class EmbeddingRequest(BaseModel):
    real_data: List[List[Any]]  # Allow mixed data types (strings, numbers)
    synthetic_data: List[List[Any]]  # Allow mixed data types (strings, numbers)
    method: str = "umap"
    params: Dict[str, Any] = {}
    n_samples: Optional[int] = None
    real_headers: Optional[List[str]] = None
    synthetic_headers: Optional[List[str]] = None

@router.post("/embed")
async def compute_embedding(request: EmbeddingRequest):
    """
    Compute embeddings for real and synthetic data with one-hot encoding support.
    
    Args:
        request: EmbeddingRequest containing:
            - real_data: Real dataset
            - synthetic_data: Synthetic dataset
            - method: Embedding method ('umap' or 'tsne')
            - params: Method-specific parameters
            - n_samples: Optional number of samples to use
            - real_headers: Optional list of real data headers
            - synthetic_headers: Optional list of synthetic data headers
            
    Returns:
        dict: Contains embeddings and metadata
    """
    try:
        # Validate input
        validate_embedding_params(request.method, request.params)
        
        # Create job for history tracking
        job_name = f"{request.method.upper()} Embedding - {len(request.real_data)}R + {len(request.synthetic_data)}S samples"
        job_result = JobService.create_job(
            name=job_name,
            method=request.method,
            parameters=request.params or {},
            real_data=request.real_data,
            synthetic_data=request.synthetic_data,
            real_headers=request.real_headers,
            synthetic_headers=request.synthetic_headers,
            description="Direct embedding computation"
        )
        job_id = job_result["job_id"]
        
        # Pass raw data to embedding service for preprocessing
        # The service will handle mixed data types and convert to proper format
        embeddings, metadata = embedding_service.compute_embedding(
            real_data=request.real_data,
            synthetic_data=request.synthetic_data,
            method=request.method,
            params=request.params,
            n_samples=request.n_samples,
            real_headers=request.real_headers,
            synthetic_headers=request.synthetic_headers
        )
        
        # Save results to job for history
        JobService.update_job_results(
            job_id,
            embeddings["real"],
            embeddings["synthetic"],
            metadata["runtime"],
            metadata
        )
        
        # Return the embeddings and metadata in the expected format (same as before)
        return {
            "embeddings": embeddings,
            "metadata": {
                **metadata,
                "job_id": job_id  # Include job_id for potential future use
            }
        }
        
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