from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any, Optional
import numpy as np
from pydantic import BaseModel

from services.embedding import EmbeddingService
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
        
        # The embeddings are already in the correct format (dict with 'real' and 'synthetic' keys)
        # and already converted to lists for JSON serialization
        return {
            "embeddings": embeddings,
            "metadata": metadata
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 