"""
API routes for asynchronous task queue management.
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import asyncio
import json
import zmq
import zmq.asyncio

from backend.services.task_queue import get_task_queue_manager, JobStatus
from backend.services.job_service import JobService
from backend.utils.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)

class QueueStatusResponse(BaseModel):
    total_queued: int
    currently_processing: int
    active_workers: int
    total_workers: int
    queue_items: List[Dict[str, Any]]

class JobStatusResponse(BaseModel):
    job_id: str
    task_id: Optional[str]
    status: str
    progress: float
    queue_position: Optional[int]
    worker_id: Optional[str]
    estimated_time_remaining: Optional[float]
    error_message: Optional[str]
    created_at: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]

@router.get("/queue/status", response_model=QueueStatusResponse)
async def get_queue_status():
    """Get current queue status and statistics."""
    try:
        task_queue = get_task_queue_manager()
        
        if not hasattr(task_queue, 'running') or not task_queue.running:
            # Return empty status if queue is not running
            return QueueStatusResponse(
                total_queued=0,
                currently_processing=0,
                active_workers=0,
                total_workers=0,
                queue_items=[]
            )
        
        status = task_queue.get_queue_status()
        
        return QueueStatusResponse(
            total_queued=status["queued_tasks"],
            currently_processing=status["processing_tasks"],
            active_workers=status["active_workers"],
            total_workers=status["total_workers"],
            queue_items=status["queue_items"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get queue status: {str(e)}")

@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get the current status of a specific job."""
    try:
        # Get job from database
        job = JobService.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Get task status from queue if available
        task_queue = get_task_queue_manager()
        task_status = None
        
        if job.task_id and hasattr(task_queue, 'running') and task_queue.running:
            task_status = task_queue.get_task_status(job.task_id)
        
        # Combine database and queue information
        # Convert datetime objects to strings
        created_at = job.created_at
        if created_at and hasattr(created_at, 'isoformat'):
            created_at = created_at.isoformat()
        elif created_at:
            created_at = str(created_at)
            
        started_at_val = task_status.started_at if task_status else job.started_at
        if started_at_val and hasattr(started_at_val, 'isoformat'):
            started_at_val = started_at_val.isoformat()
        elif started_at_val:
            started_at_val = str(started_at_val)
            
        completed_at_val = task_status.completed_at if task_status else None
        if completed_at_val and hasattr(completed_at_val, 'isoformat'):
            completed_at_val = completed_at_val.isoformat()
        elif completed_at_val:
            completed_at_val = str(completed_at_val)
        
        # Determine the most accurate status
        # If database shows completed/failed, trust that over task queue status
        # This prevents race conditions where task completes but queue doesn't update
        if job.status in ["completed", "failed"]:
            final_status = job.status
            final_progress = 1.0 if job.status == "completed" else (job.progress or 0.0)
        else:
            # For any non-terminal status, show as 'running' to simplify UI
            # This includes "queued", "processing", "running", etc.
            final_status = "running"
            final_progress = task_status.progress if task_status else (job.progress or 0.0)
        
        return JobStatusResponse(
            job_id=job_id,
            task_id=job.task_id,
            status=final_status,
            progress=final_progress,
            queue_position=task_status.queue_position if task_status else None,
            worker_id=task_status.worker_id if task_status else job.worker_id,
            estimated_time_remaining=task_status.estimated_time_remaining if task_status else None,
            error_message=task_status.error_message if task_status else job.error_message,
            created_at=created_at,
            started_at=started_at_val,
            completed_at=completed_at_val
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")

@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a queued or processing job."""
    try:
        # Get job from database
        job = JobService.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Check if job can be cancelled
        if job.status in ["completed", "failed"]:
            raise HTTPException(status_code=400, detail=f"Cannot cancel job with status: {job.status}")
        
        # Cancel in task queue if it has a task_id
        task_queue = get_task_queue_manager()
        cancelled_in_queue = False
        
        if job.task_id and hasattr(task_queue, 'running') and task_queue.running:
            cancelled_in_queue = task_queue.cancel_task(job.task_id)
        
        # Update job status in database
        JobService.update_job_async_info(
            job_id=job_id,
            status="failed"
        )
        
        # Also mark it as failed with cancellation message
        JobService.mark_job_failed(job_id, "Job cancelled by user")
        
        return {
            "message": "Job cancelled successfully",
            "job_id": job_id,
            "cancelled_in_queue": cancelled_in_queue
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")

@router.post("/queue/priority/{job_id}")
async def set_job_priority(job_id: str, priority: int = 0):
    """Set the priority of a queued job (higher number = higher priority)."""
    try:
        # Get job from database
        job = JobService.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.status != "queued":
            raise HTTPException(status_code=400, detail="Can only set priority for queued jobs")
        
        # Update priority in database
        JobService.update_job_async_info(
            job_id=job_id,
            priority=priority
        )
        
        # TODO: Update priority in task queue as well
        # This would require implementing priority updates in the task queue
        
        return {
            "message": "Job priority updated successfully",
            "job_id": job_id,
            "new_priority": priority
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set job priority: {str(e)}")

@router.get("/queue/workers")
async def get_worker_status():
    """Get status of all worker processes."""
    try:
        task_queue = get_task_queue_manager()
        
        if not hasattr(task_queue, 'running') or not task_queue.running:
            return {
                "total_workers": 0,
                "active_workers": 0,
                "workers": []
            }
        
        # Get worker status from task queue
        worker_status = getattr(task_queue, 'worker_status', {})
        
        return {
            "total_workers": len(worker_status),
            "active_workers": len([w for w in worker_status.values() if w == "busy"]),
            "workers": [
                {
                    "worker_id": worker_id,
                    "status": status
                }
                for worker_id, status in worker_status.items()
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get worker status: {str(e)}")

@router.websocket("/queue/ws")
async def queue_status_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time queue status updates."""
    await websocket.accept()
    
    # Set up ZeroMQ subscriber for status updates
    context = zmq.asyncio.Context()
    subscriber = context.socket(zmq.SUB)
    
    try:
        # Connect to status publisher
        subscriber.connect("tcp://localhost:5557")
        subscriber.setsockopt(zmq.SUBSCRIBE, b"status")
        
        # Send initial status
        task_queue = get_task_queue_manager()
        if hasattr(task_queue, 'running') and task_queue.running:
            initial_status = task_queue.get_queue_status()
            await websocket.send_text(json.dumps({
                "type": "queue_status",
                "data": initial_status
            }))
        
        # Listen for updates
        while True:
            try:
                # Check for ZeroMQ messages (non-blocking)
                try:
                    topic, message = await subscriber.recv_multipart(zmq.NOBLOCK)
                    
                    if topic == b"status":
                        # Forward status update to WebSocket client
                        update_data = json.loads(message.decode())
                        await websocket.send_text(json.dumps({
                            "type": "status_update",
                            "data": update_data
                        }))
                        
                except zmq.Again:
                    # No message available, continue
                    pass
                
                # Small delay to prevent busy waiting
                await asyncio.sleep(0.1)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": str(e)
                }))
                break
                
    except Exception as e:
        await websocket.send_text(json.dumps({
            "type": "error", 
            "message": f"Failed to connect to status updates: {str(e)}"
        }))
    finally:
        subscriber.close()
        context.term()

@router.post("/queue/start")
async def start_queue():
    """Start the task queue manager."""
    try:
        task_queue = get_task_queue_manager()
        
        if hasattr(task_queue, 'running') and task_queue.running:
            return {"message": "Task queue is already running"}
        
        task_queue.start()
        
        return {
            "message": "Task queue started successfully",
            "max_workers": task_queue.max_workers
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start task queue: {str(e)}")

@router.post("/queue/stop")
async def stop_queue():
    """Stop the task queue manager."""
    try:
        task_queue = get_task_queue_manager()
        
        if not hasattr(task_queue, 'running') or not task_queue.running:
            return {"message": "Task queue is not running"}
        
        task_queue.stop()
        
        return {"message": "Task queue stopped successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop task queue: {str(e)}")

@router.get("/queue/health")
async def queue_health_check():
    """Health check for the task queue system."""
    try:
        task_queue = get_task_queue_manager()
        
        is_running = hasattr(task_queue, 'running') and task_queue.running
        
        if is_running:
            status = task_queue.get_queue_status()
            return {
                "status": "healthy",
                "queue_running": True,
                "total_workers": status["total_workers"],
                "active_workers": status["active_workers"],
                "queued_tasks": status["queued_tasks"],
                "processing_tasks": status["processing_tasks"]
            }
        else:
            return {
                "status": "stopped",
                "queue_running": False,
                "message": "Task queue is not running"
            }
            
    except Exception as e:
        return {
            "status": "error",
            "queue_running": False,
            "error": str(e)
        } 