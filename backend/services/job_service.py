"""
Job service for managing embedding computation jobs and results.
Handles job creation, status tracking, and result storage.
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_

from backend.database.connection import get_db
from backend.database.models import Job, JobResult, CompressedData
from backend.utils.logging_config import get_logger

logger = get_logger(__name__)

class JobService:
    """Service for managing embedding computation jobs."""
    
    @staticmethod
    def create_job(
        job_id: str,
        method: str,
        params: Dict[str, Any],
        n_samples: Optional[int] = None,
        status: str = "queued",
        dataset_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new job record."""
        try:
            db = next(get_db())
            
            # Use provided description or default
            job_name = dataset_description if dataset_description else f"{method.upper()} Embedding"
            
            job = Job(
                job_id=job_id,
                name=job_name,
                method=method,
                parameters=json.dumps(params),
                status=status,
                created_at=datetime.utcnow(),
                n_samples=n_samples
            )
            
            db.add(job)
            db.commit()
            db.refresh(job)
            
            logger.info(f"Created job {job_id} with status {status}")
            return {"job_id": job_id, "status": "created"}
            
        except Exception as e:
            logger.error(f"Error creating job {job_id}: {e}")
            raise
    
    @staticmethod
    def get_job(job_id: str) -> Optional[Job]:
        """Get a job by ID."""
        try:
            db = next(get_db())
            return db.query(Job).filter(Job.job_id == job_id).first()
        except Exception as e:
            logger.error(f"Error getting job {job_id}: {e}")
            return None
    
    @staticmethod
    def get_jobs(
        limit: int = 50,
        offset: int = 0,
        status: Optional[str] = None,
        method: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        favorites_only: bool = False
    ) -> List[Job]:
        """Get jobs with optional filtering."""
        try:
            db = next(get_db())
            query = db.query(Job)
            
            if status:
                query = query.filter(Job.status == status)
            if method:
                query = query.filter(Job.method == method)
            if date_from:
                query = query.filter(Job.created_at >= date_from)
            if date_to:
                query = query.filter(Job.created_at <= date_to)
            if favorites_only:
                query = query.filter(Job.is_favorite == True)
            
            return query.order_by(desc(Job.created_at)).offset(offset).limit(limit).all()
            
        except Exception as e:
            logger.error(f"Error getting jobs: {e}")
            return []
    
    @staticmethod
    def get_job_count(
        status: Optional[str] = None,
        method: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        favorites_only: bool = False
    ) -> int:
        """Get total count of jobs with optional filtering."""
        try:
            db = next(get_db())
            query = db.query(Job)
            
            if status:
                query = query.filter(Job.status == status)
            if method:
                query = query.filter(Job.method == method)
            if date_from:
                query = query.filter(Job.created_at >= date_from)
            if date_to:
                query = query.filter(Job.created_at <= date_to)
            if favorites_only:
                query = query.filter(Job.is_favorite == True)
            
            return query.count()
            
        except Exception as e:
            logger.error(f"Error getting job count: {e}")
            return 0
    
    @staticmethod
    def update_job_async_info(
        job_id: str,
        status: Optional[str] = None,
        task_id: Optional[str] = None,
        worker_id: Optional[str] = None,
        started_at: Optional[datetime] = None,
        progress: Optional[float] = None
    ) -> bool:
        """Update job async information."""
        try:
            db = next(get_db())
            job = db.query(Job).filter(Job.job_id == job_id).first()
            
            if not job:
                return False
            
            if status:
                job.status = status
            if task_id:
                job.task_id = task_id
            if worker_id:
                job.worker_id = worker_id
            if started_at:
                job.started_at = started_at
            if progress is not None:
                job.progress = progress
            
            db.commit()
            return True
            
        except Exception as e:
            logger.error(f"Error updating job {job_id}: {e}")
            return False
    
    @staticmethod
    def update_job_results(
        job_id: str,
        embedding_real: List[List[float]],
        embedding_synthetic: List[List[float]],
        runtime_seconds: float,
        preprocessing_info: Dict[str, Any],
        real_processed_samples: Optional[int] = None,
        synthetic_processed_samples: Optional[int] = None,
        model: Optional[object] = None
    ) -> bool:
        """Update job with embedding results."""
        try:
            logger.info(f"Starting to update job results for {job_id}")
            db = next(get_db())
            
            # Update job status
            job = db.query(Job).filter(Job.job_id == job_id).first()
            if not job:
                logger.error(f"Job {job_id} not found in database")
                return False
            
            logger.info(f"Found job {job_id}, updating status to completed")
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            job.runtime_seconds = runtime_seconds
            job.has_results = True
            
            # Create or update job results
            job_result = db.query(JobResult).filter(JobResult.job_id == job_id).first()
            if not job_result:
                logger.info(f"Creating new job result record for {job_id}")
                job_result = JobResult(job_id=job_id)
                db.add(job_result)
            else:
                logger.info(f"Updating existing job result record for {job_id}")
            
            logger.info(f"Saving embeddings for job {job_id} - real: {len(embedding_real)} samples, synthetic: {len(embedding_synthetic)} samples")
            job_result.embedding_real = json.dumps(embedding_real)
            job_result.embedding_synthetic = json.dumps(embedding_synthetic)
            
            # Filter out non-serializable objects from preprocessing_info
            serializable_preprocessing_info = {}
            for key, value in preprocessing_info.items():
                try:
                    # Test if the value can be serialized to JSON
                    json.dumps(value)
                    serializable_preprocessing_info[key] = value
                except (TypeError, ValueError):
                    # Skip non-serializable objects (like model objects)
                    logger.info(f"Skipping non-serializable key '{key}' in preprocessing_info for job {job_id}")
                    continue
            
            job_result.preprocessing_info = json.dumps(serializable_preprocessing_info)
            job_result.real_processed_samples = real_processed_samples
            job_result.synthetic_processed_samples = synthetic_processed_samples
            
            # Store model if provided (re-enabled with proper error handling)
            if model is not None:
                try:
                    import joblib
                    import base64
                    import io
                    import time
                    
                    logger.info(f"Attempting to store model for job {job_id}")
                    logger.info(f"Model type: {type(model).__name__}")
                    logger.info(f"Model attributes: {[attr for attr in dir(model) if not attr.startswith('_')]}")
                    
                    # Special handling for TSNE models with Annoy indices
                    if hasattr(model, 'affinities') and hasattr(model.affinities, 'annoy_index'):
                        logger.info("Detected TSNE model with Annoy index - attempting to close file handles")
                        try:
                            # Try to close the Annoy index file handles
                            if hasattr(model.affinities.annoy_index, 'close'):
                                model.affinities.annoy_index.close()
                            # Also try to delete the temporary file if it exists
                            if hasattr(model.affinities.annoy_index, 'filename'):
                                import os
                                try:
                                    if os.path.exists(model.affinities.annoy_index.filename):
                                        os.remove(model.affinities.annoy_index.filename)
                                except:
                                    pass  # Ignore file deletion errors
                        except Exception as close_error:
                            logger.warning(f"Could not close Annoy index: {close_error}")
                    
                    # Use joblib for all models (more reliable than pickle for complex objects)
                    buffer = io.BytesIO()
                    joblib.dump(model, buffer)
                    model_bytes = buffer.getvalue()
                    buffer.close()
                    
                    logger.info(f"Model serialized with joblib. Size: {len(model_bytes)} bytes")
                    job_result.model_format = 'joblib'
                    
                    model_b64 = base64.b64encode(model_bytes).decode('utf-8')
                    logger.info(f"Model base64 encoded successfully. Size: {len(model_b64)} characters")
                    
                    job_result.model_data = model_b64
                    job.has_model = True
                    
                    logger.info(f"Stored model for job {job_id}")
                except PermissionError as perm_error:
                    logger.warning(f"Permission error storing model for job {job_id}: {perm_error}")
                    logger.warning("This is likely due to file handles being held by the TSNE Annoy index")
                    logger.warning("Attempting to retry after a short delay...")
                    
                    # Retry after a short delay
                    time.sleep(2)
                    try:
                        import joblib
                        import base64
                        import io
                        
                        buffer = io.BytesIO()
                        joblib.dump(model, buffer)
                        model_bytes = buffer.getvalue()
                        buffer.close()
                        
                        job_result.model_format = 'joblib'
                        model_b64 = base64.b64encode(model_bytes).decode('utf-8')
                        job_result.model_data = model_b64
                        job.has_model = True
                        
                        logger.info(f"Successfully stored model for job {job_id} on retry")
                    except Exception as retry_error:
                        logger.warning(f"Retry failed for job {job_id}: {retry_error}")
                        job.has_model = False
                        job_result.model_data = None
                        job_result.model_format = None
                except Exception as model_error:
                    logger.warning(f"Failed to store model for job {job_id}: {model_error}")
                    logger.warning(f"Model error type: {type(model_error)}")
                    # Continue without storing the model - don't fail the entire operation
                    job.has_model = False
                    job_result.model_data = None
                    job_result.model_format = None
            else:
                logger.info(f"No model provided for job {job_id}")
                job.has_model = False
                job_result.model_data = None
                job_result.model_format = None
            
            logger.info(f"About to commit results for job {job_id}")
            db.commit()
            logger.info(f"Successfully committed results for job {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating job results for {job_id}: {e}")
            return False
    
    @staticmethod
    def get_job_results(job_id: str) -> Optional[Dict[str, Any]]:
        """Get job results including embeddings."""
        try:
            db = next(get_db())
            job_result = db.query(JobResult).filter(JobResult.job_id == job_id).first()
            
            if not job_result:
                return None
            
            result = {
                "embedding_real": json.loads(job_result.embedding_real),
                "embedding_synthetic": json.loads(job_result.embedding_synthetic),
                "preprocessing_info": json.loads(job_result.preprocessing_info),
                "real_processed_samples": job_result.real_processed_samples,
                "synthetic_processed_samples": job_result.synthetic_processed_samples,
                "has_model": job_result.model_data is not None,
                "model_format": job_result.model_format
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting job results for {job_id}: {e}")
            return None
    
    @staticmethod
    def mark_job_failed(job_id: str, error_message: str) -> bool:
        """Mark a job as failed with error message."""
        try:
            db = next(get_db())
            job = db.query(Job).filter(Job.job_id == job_id).first()
            
            if not job:
                return False
            
            job.status = "failed"
            job.error_message = error_message
            job.completed_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"Marked job {job_id} as failed: {error_message}")
            return True
            
        except Exception as e:
            logger.error(f"Error marking job {job_id} as failed: {e}")
            return False
    
    @staticmethod
    def delete_job(job_id: str) -> bool:
        """Delete a job and its associated data."""
        try:
            db = next(get_db())
            
            # Delete job results
            db.query(JobResult).filter(JobResult.job_id == job_id).delete()
            
            # Delete compressed data
            db.query(CompressedData).filter(CompressedData.job_id == job_id).delete()
            
            # Delete the job
            job = db.query(Job).filter(Job.job_id == job_id).first()
            if job:
                db.delete(job)
                db.commit()
                logger.info(f"Deleted job {job_id}")
                return True
            else:
                logger.warning(f"Job {job_id} not found for deletion")
                return False
            
        except Exception as e:
            logger.error(f"Error deleting job {job_id}: {e}")
            return False
    
    @staticmethod
    def toggle_job_favorite(job_id: str) -> bool:
        """Toggle the favorite status of a job."""
        try:
            db = next(get_db())
            job = db.query(Job).filter(Job.job_id == job_id).first()
            
            if not job:
                logger.warning(f"Job {job_id} not found for favorite toggle")
                return False
            
            # Toggle the favorite status
            job.is_favorite = not job.is_favorite
            db.commit()
            
            logger.info(f"Toggled favorite status for job {job_id} to {job.is_favorite}")
            return True
                
        except Exception as e:
            logger.error(f"Error toggling favorite for job {job_id}: {e}")
            return False
    
    @staticmethod
    def get_job_statistics() -> Dict[str, Any]:
        """Get job statistics."""
        try:
            db = next(get_db())
            
            total_jobs = db.query(Job).count()
            completed_jobs = db.query(Job).filter(Job.status == "completed").count()
            failed_jobs = db.query(Job).filter(Job.status == "failed").count()
            running_jobs = db.query(Job).filter(Job.status == "running").count()
            queued_jobs = db.query(Job).filter(Job.status == "queued").count()
            
            # Method breakdown
            umap_jobs = db.query(Job).filter(Job.method == "umap").count()
            tsne_jobs = db.query(Job).filter(Job.method == "tsne").count()
            pca_jobs = db.query(Job).filter(Job.method == "pca").count()
            
            # Average runtime for completed jobs
            avg_runtime = db.query(Job.runtime_seconds).filter(
                Job.status == "completed",
                Job.runtime_seconds.isnot(None)
            ).scalar()
            
            return {
                "total_jobs": total_jobs,
                "completed_jobs": completed_jobs,
                "failed_jobs": failed_jobs,
                "running_jobs": running_jobs,
                "queued_jobs": queued_jobs,
                "method_breakdown": {
                    "umap": umap_jobs,
                    "tsne": tsne_jobs,
                    "pca": pca_jobs
                },
                "avg_runtime_seconds": float(avg_runtime) if avg_runtime else None,
                "success_rate": (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting job statistics: {e}")
            return {}
    
    @staticmethod
    def compress_and_store_data_async(
        job_id: str,
        real_data: List[List[Any]],
        synthetic_data: List[List[Any]],
        real_headers: Optional[List[str]] = None,
        synthetic_headers: Optional[List[str]] = None
    ) -> bool:
        """Compress and store original data asynchronously."""
        try:
            from .compression_service import CompressionService
            
            compression_service = CompressionService()
            
            # Compress data
            compressed_data = {
                "real_data": real_data,
                "synthetic_data": synthetic_data,
                "real_headers": real_headers or [],
                "synthetic_headers": synthetic_headers or []
            }
            
            # Store compressed data
            db = next(get_db())
            
            existing_data = db.query(CompressedData).filter(CompressedData.job_id == job_id).first()
            if existing_data:
                existing_data.compressed_data = json.dumps(compressed_data)
                existing_data.updated_at = datetime.utcnow()
            else:
                compressed_record = CompressedData(
                    job_id=job_id,
                    compressed_data=json.dumps(compressed_data),
                    created_at=datetime.utcnow()
                )
                db.add(compressed_record)
            
            # Update job to indicate compressed data is available
            job = db.query(Job).filter(Job.job_id == job_id).first()
            if job:
                job.has_compressed_data = True
            
            db.commit()
            logger.info(f"Compressed and stored data for job {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error compressing data for job {job_id}: {e}")
            return False
    
    @staticmethod
    def get_model(job_id: str) -> Optional[Dict[str, Any]]:
        """Get model data for download."""
        try:
            db = next(get_db())
            job_result = db.query(JobResult).filter(JobResult.job_id == job_id).first()
            
            if not job_result or not job_result.model_data:
                return None
            
            import base64
            
            # Return model data and metadata
            return {
                "model_data": job_result.model_data,
                "model_format": job_result.model_format,
                "job_id": job_id
            }
            
        except Exception as e:
            logger.error(f"Error getting model for {job_id}: {e}")
            return None

    @staticmethod
    def get_compressed_data(job_id: str) -> Optional[Dict[str, Any]]:
        """Get compressed data for a job."""
        try:
            db = next(get_db())
            compressed_record = db.query(CompressedData).filter(CompressedData.job_id == job_id).first()
            
            if not compressed_record:
                return None
            
            return json.loads(compressed_record.compressed_data)
            
        except Exception as e:
            logger.error(f"Error getting compressed data for {job_id}: {e}")
            return None 