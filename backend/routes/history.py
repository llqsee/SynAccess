"""API routes for embedding job history management."""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from services.job_service import JobService

router = APIRouter()

class JobHistoryResponse(BaseModel):
    jobs: List[Dict[str, Any]]
    total: int
    page: int
    limit: int

class JobDetailResponse(BaseModel):
    job: Dict[str, Any]
    tags: List[str]

class CreateJobRequest(BaseModel):
    name: str
    description: Optional[str] = None

class AddTagRequest(BaseModel):
    tag: str

@router.get("/history", response_model=JobHistoryResponse)
async def get_job_history(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status"),
    method: Optional[str] = Query(None, description="Filter by method"),
    favorites_only: bool = Query(False, description="Show only favorites")
):
    """Get paginated job history with optional filters."""
    
    try:
        offset = (page - 1) * limit
        jobs, total = JobService.get_job_history(
            limit=limit,
            offset=offset,
            status_filter=status,
            method_filter=method,
            favorites_only=favorites_only
        )
        
        return JobHistoryResponse(
            jobs=jobs,  # jobs are already dictionaries
            total=total,
            page=page,
            limit=limit
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job history: {str(e)}")

@router.get("/jobs/{job_id}", response_model=JobDetailResponse)
async def get_job_detail(job_id: str):
    """Get detailed job information including embeddings."""
    
    try:
        job = JobService.get_job_by_id(job_id, include_embeddings=True)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        tags = JobService.get_job_tags(job_id)
        
        return JobDetailResponse(
            job=job,  # job is already a dictionary with embeddings
            tags=tags
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job detail: {str(e)}")

@router.post("/jobs/{job_id}/favorite")
async def toggle_job_favorite(job_id: str):
    """Toggle favorite status of a job."""
    
    try:
        success = JobService.toggle_favorite(job_id)
        if not success:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {"message": "Favorite status toggled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle favorite: {str(e)}")

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its associated data."""
    
    try:
        success = JobService.delete_job(job_id)
        if not success:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {"message": "Job deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete job: {str(e)}")

@router.post("/jobs/{job_id}/tags")
async def add_job_tag(job_id: str, request: AddTagRequest):
    """Add a tag to a job."""
    
    try:
        success = JobService.add_job_tag(job_id, request.tag)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to add tag or tag already exists")
        
        return {"message": "Tag added successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add tag: {str(e)}")

@router.get("/jobs/{job_id}/tags")
async def get_job_tags(job_id: str):
    """Get all tags for a job."""
    
    try:
        tags = JobService.get_job_tags(job_id)
        return {"tags": tags}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job tags: {str(e)}")

@router.post("/jobs/{job_id}/load")
async def load_job_embeddings(job_id: str):
    """Load embeddings from a completed job."""
    
    try:
        job = JobService.get_job_by_id(job_id, include_embeddings=True)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job["status"] != "completed":
            raise HTTPException(status_code=400, detail="Job is not completed")
        
        if not job.get("embedding_real") or not job.get("embedding_synthetic"):
            raise HTTPException(status_code=400, detail="Job has no embedding data")
        
        # Return the same format as the embedding computation endpoint
        return {
            "embeddings": {
                "real": job["embedding_real"],
                "synthetic": job["embedding_synthetic"]
            },
            "metadata": {
                "runtime": job["runtime_seconds"],
                "method": job["method"],
                "params": job["parameters"],
                "real_samples": job["real_data_shape"][0] if job["real_data_shape"] else 0,
                "synthetic_samples": job["synthetic_data_shape"][0] if job["synthetic_data_shape"] else 0,
                "preprocessing": job["preprocessing_info"],
                "job_id": job["job_id"],
                "job_name": job["name"],
                "created_at": job["created_at"].isoformat() if job["created_at"] else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load job embeddings: {str(e)}")

@router.get("/stats")
async def get_job_stats():
    """Get overall job statistics."""
    
    try:
        stats = JobService.get_job_stats()
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job stats: {str(e)}")

@router.post("/cleanup")
async def cleanup_stuck_jobs():
    """Clean up jobs that have been stuck in 'running' status for too long."""
    
    try:
        count = JobService.cleanup_stuck_jobs()
        return {"message": f"Cleaned up {count} stuck jobs"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup stuck jobs: {str(e)}") 