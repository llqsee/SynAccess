from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np

from ..services.embedding import EmbeddingService
from ..utils.validation import validate_input_data

router = APIRouter(prefix="/embed", tags=["embedding"])

class EmbeddingRequest(BaseModel):
    data: List[List[float]]
    method: str = "umap"  # or "tsne"
    params: Optional[dict] = None

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    metadata: dict

@router.post("/", response_model=EmbeddingResponse)
async def create_embedding(request: EmbeddingRequest):
    try:
        # Validate input data
        data = np.array(request.data)
        validate_input_data(data)
        
        # Initialize embedding service
        service = EmbeddingService()
        
        # Compute embeddings
        embeddings, metadata = service.compute_embedding(
            data,
            method=request.method,
            params=request.params or {}
        )
        
        return EmbeddingResponse(
            embeddings=embeddings.tolist(),
            metadata=metadata
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 