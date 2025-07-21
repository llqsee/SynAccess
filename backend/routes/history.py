"""API routes for embedding job history management."""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

from services.job_service import JobService
from utils.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)

@router.get("/history")
async def get_job_history(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    method: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get job history with optional filtering."""
    try:
        # Parse date filters
        date_from_dt = None
        date_to_dt = None
        
        if date_from:
            try:
                date_from_dt = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_from format. Use ISO format.")
                
        if date_to:
            try:
                date_to_dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_to format. Use ISO format.")
        
        # Get jobs from database
        jobs = JobService.get_jobs(
            limit=limit,
            offset=offset,
            status=status,
            method=method,
            date_from=date_from_dt,
            date_to=date_to_dt
        )
        
        # Format response
        formatted_jobs = []
        for job in jobs:
            job_dict = {
                "job_id": job.job_id,
                "name": job.name,
                "method": job.method,
                "status": job.status,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "runtime_seconds": job.runtime_seconds,
                "error_message": job.error_message,
                "parameters": job.parameters if isinstance(job.parameters, dict) else json.loads(job.parameters) if job.parameters else {},
                "has_results": job.has_results,
                "has_compressed_data": job.has_compressed_data
            }
            
            # Get processed samples from JobResult if available
            if job.has_results:
                try:
                    results = JobService.get_job_results(job.job_id)
                    if results:
                        job_dict["actual_processed_samples"] = {
                            "real_samples": results.get("real_processed_samples"),
                            "synthetic_samples": results.get("synthetic_processed_samples")
                        }
                except Exception as e:
                    logger.warning(f"Could not get processed samples for job {job.job_id}: {e}")
                    job_dict["actual_processed_samples"] = None
            else:
                job_dict["actual_processed_samples"] = None
            
            formatted_jobs.append(job_dict)
        
        # Get total count for pagination
        total_count = JobService.get_job_count(
            status=status,
            method=method,
            date_from=date_from_dt,
            date_to=date_to_dt
        )
        
        return {
            "jobs": formatted_jobs,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total_count
        }
        
    except Exception as e:
        logger.error(f"Error getting job history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get job history: {str(e)}")

@router.get("/history/{job_id}")
async def get_job_details(job_id: str):
    """Get detailed information about a specific job."""
    try:
        job = JobService.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Get job results if available
        results = None
        if job.has_results:
            results = JobService.get_job_results(job_id)
        
        # Get compressed data if available
        compressed_data = None
        if job.has_compressed_data:
            compressed_data = JobService.get_compressed_data(job_id)
        
        job_dict = {
            "job_id": job.job_id,
            "name": job.name,
            "method": job.method,
            "status": job.status,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "runtime_seconds": job.runtime_seconds,
            "error_message": job.error_message,
            "parameters": job.parameters if isinstance(job.parameters, dict) else json.loads(job.parameters) if job.parameters else {},
            "has_results": job.has_results,
            "has_compressed_data": job.has_compressed_data,
            "results": results,
            "compressed_data": compressed_data
        }
        
        # Get processed samples from JobResult if available
        if job.has_results and results:
            job_dict["actual_processed_samples"] = {
                "real_samples": results.get("real_processed_samples"),
                "synthetic_samples": results.get("synthetic_processed_samples")
            }
        else:
            job_dict["actual_processed_samples"] = None
        
        return job_dict
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job details for {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get job details: {str(e)}")

@router.post("/jobs/{job_id}/load")
async def load_job_embeddings(job_id: str):
    """Load embeddings from a completed job with compressed data for distribution plots."""
    try:
        job = JobService.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Job is not completed")
        
        # Get job results
        results = JobService.get_job_results(job_id)
        if not results:
            raise HTTPException(status_code=400, detail="Job has no embedding data")
        
        # Get compressed data for distribution plots
        compressed_data = JobService.get_compressed_data(job_id)
        
        # Prepare session state with compressed data if available
        session_state = {}
        if compressed_data:
            session_state = {
                "realData": {
                    "data": compressed_data["real_data"],
                    "headers": compressed_data["real_headers"]
                },
                "syntheticData": {
                    "data": compressed_data["synthetic_data"],
                    "headers": compressed_data["synthetic_headers"]
                }
            }
        
        # Return the same format as the embedding computation endpoint
        return {
            "embeddings": {
                "real": results["embedding_real"],
                "synthetic": results["embedding_synthetic"]
            },
            "metadata": {
                "runtime": job.runtime_seconds,
                "method": job.method,
                "params": job.parameters if isinstance(job.parameters, dict) else json.loads(job.parameters) if job.parameters else {},
                "real_samples": results.get("real_processed_samples"),
                "synthetic_samples": results.get("synthetic_processed_samples"),
                "preprocessing": results.get("preprocessing_info"),
                "job_id": job.job_id,
                "job_name": job.name,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "has_compressed_data": job.has_compressed_data
            },
            "session_state": session_state
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading job embeddings for {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load job embeddings: {str(e)}")

@router.delete("/history/{job_id}")
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
        logger.error(f"Error deleting job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete job: {str(e)}")

@router.get("/stats")
async def get_stats():
    """Get job statistics."""
    try:
        stats = JobService.get_job_statistics()
        return stats
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")

@router.get("/history/stats")
async def get_history_stats():
    """Get statistics about job history."""
    try:
        stats = JobService.get_job_statistics()
        return stats
        
    except Exception as e:
        logger.error(f"Error getting history stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get history statistics: {str(e)}") 