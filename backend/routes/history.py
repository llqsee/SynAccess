"""API routes for embedding job history management."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta
import json

from backend.services.job_service import JobService
from backend.utils.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)

@router.get("/history")
async def get_job_history(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    method: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    favorites_only: bool = False
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
        
        # Adjust status filter for display logic
        # If user selects "running", we need to include "queued" jobs since they display as "running"
        db_status_filter = status
        if status == "running":
            # For "running" filter, we want jobs that are not completed/failed
            # This includes "queued", "processing", "running", etc.
            db_status_filter = None  # Don't filter by status in database
        elif status == "queued":
            # If user specifically wants "queued", we need to exclude jobs that are actually running
            # But since we display all non-completed as "running", this is tricky
            # For now, we'll treat "queued" filter as "running" filter
            db_status_filter = None
        
        # Get jobs from database
        jobs = JobService.get_jobs(
            limit=limit,
            offset=offset,
            status=db_status_filter,
            method=method,
            date_from=date_from_dt,
            date_to=date_to_dt,
            favorites_only=favorites_only
        )
        
        # Format response
        formatted_jobs = []
        for job in jobs:
            # Determine the most accurate status for display
            # If database shows completed/failed, trust that over task queue status
            # For any non-terminal status, show as 'running' to simplify UI
            if job.status in ["completed", "failed"]:
                display_status = job.status
            else:
                # This includes "queued", "processing", "running", etc.
                display_status = "running"
            
            job_dict = {
                "job_id": job.job_id,
                "name": job.name,
                "method": job.method,
                "status": display_status,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "runtime_seconds": job.runtime_seconds,
                "error_message": job.error_message,
                "parameters": job.parameters if isinstance(job.parameters, dict) else json.loads(job.parameters) if job.parameters else {},
                "has_results": job.has_results,
                "has_compressed_data": job.has_compressed_data,
                "has_model": job.has_model,
                "is_favorite": job.is_favorite
            }
            
            # Get processed samples from JobResult if available
            if job.has_results:
                try:
                    results = JobService.get_job_results(job.job_id)
                    if results and isinstance(results, dict):
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
        
        # Post-filter for display status if needed
        if status == "running":
            # Filter to only show jobs that display as "running" (not completed/failed)
            formatted_jobs = [job for job in formatted_jobs if job["status"] == "running"]
        elif status == "queued":
            # Since we display all non-completed as "running", "queued" filter is same as "running"
            formatted_jobs = [job for job in formatted_jobs if job["status"] == "running"]
        
        # Get total count for pagination (using same filter logic)
        total_count = JobService.get_job_count(
            status=db_status_filter,
            method=method,
            date_from=date_from_dt,
            date_to=date_to_dt,
            favorites_only=favorites_only
        )
        
        # Adjust total count for post-filtering
        if status in ["running", "queued"]:
            # We need to recalculate the total count for the filtered results
            # This is a simplified approach - in production you might want to optimize this
            total_count = len(formatted_jobs)
        
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
            "has_model": job.has_model,
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

@router.get("/jobs/{job_id}/model")
async def download_model(job_id: str):
    """Download the trained model for a completed job."""
    try:
        job = JobService.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if not job.has_model:
            raise HTTPException(status_code=404, detail="Job has no model available")
        
        # Get model data
        model_data = JobService.get_model(job_id)
        if not model_data:
            raise HTTPException(status_code=404, detail="Model data not found")
        
        # Return model data for download
        return {
            "model_data": model_data["model_data"],
            "model_format": model_data["model_format"],
            "job_id": job_id,
            "job_name": job.name,
            "method": job.method,
            "parameters": job.parameters if isinstance(job.parameters, dict) else json.loads(job.parameters) if job.parameters else {}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading model for {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download model: {str(e)}")

@router.get("/jobs/{job_id}/model/download")
async def download_model_binary(job_id: str):
    """Download the trained model as a binary file."""
    from fastapi.responses import Response
    
    try:
        job = JobService.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if not job.has_model:
            raise HTTPException(status_code=404, detail="Job has no model available")
        
        # Get model data
        model_data = JobService.get_model(job_id)
        if not model_data:
            raise HTTPException(status_code=404, detail="Model data not found")
        
        # Decode base64 to get raw binary data
        import base64
        binary_data = base64.b64decode(model_data["model_data"])
        
        # Determine file extension based on stored format
        model_format = model_data["model_format"] or "pickle"
        if model_format == "joblib":
            file_extension = "joblib"
        else:
            file_extension = "pkl"
        filename = f"{job.name}_{job.method}_model.{file_extension}"
        
        # Return binary response
        return Response(
            content=binary_data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading model binary for {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download model: {str(e)}")

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

@router.post("/jobs/{job_id}/favorite")
async def toggle_job_favorite(job_id: str):
    """Toggle the favorite status of a job."""
    try:
        success = JobService.toggle_job_favorite(job_id)
        if not success:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {"message": "Favorite status updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling favorite for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle favorite: {str(e)}")

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

@router.get("/available-models")
async def get_available_models():
    """Get list of available models from completed jobs for sidebar selection."""
    try:
        from services.job_service import JobService
        
        # Get all completed jobs with models
        jobs = JobService.get_jobs(
            limit=1000,  # Get all jobs
            status="completed",
            favorites_only=False
        )
        
        # Filter jobs that have models and format for frontend
        available_models = []
        for job in jobs:
            if job.has_model:
                # Get display name based on job parameters
                real_samples = job.parameters.get('n_real_samples') if isinstance(job.parameters, dict) else None
                synth_samples = job.parameters.get('n_synth_samples') if isinstance(job.parameters, dict) else None
                
                # Use processed samples if available - get from JobResult
                if real_samples is None or synth_samples is None:
                    try:
                        results = JobService.get_job_results(job.job_id)
                        if results and isinstance(results, dict):
                            if real_samples is None:
                                real_samples = results.get("real_processed_samples")
                            if synth_samples is None:
                                synth_samples = results.get("synthetic_processed_samples")
                    except Exception:
                        # If we can't get results, continue with what we have
                        pass
                
                # Generate display name
                if real_samples and synth_samples:
                    display_name = f"{job.method.upper()} - {real_samples}R + {synth_samples}S samples"
                else:
                    display_name = job.name
                
                model_info = {
                    "job_id": job.job_id,
                    "name": job.name,  # Include the full job name with dataset information
                    "display_name": display_name,
                    "method": job.method,
                    "created_at": job.created_at.isoformat() if job.created_at else None,
                    "is_favorite": job.is_favorite,
                    "parameters": job.parameters if isinstance(job.parameters, dict) else json.loads(job.parameters) if job.parameters else {},
                    "real_processed_samples": real_samples,
                    "synthetic_processed_samples": synth_samples,
                    "runtime_seconds": job.runtime_seconds
                }
                available_models.append(model_info)
        
        # Sort by creation date (newest first)
        available_models.sort(key=lambda x: x["created_at"] or "", reverse=True)
        
        return {
            "models": available_models,
            "total": len(available_models)
        }
        
    except Exception as e:
        logger.error(f"Error getting available models: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get available models: {str(e)}") 