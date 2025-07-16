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

from database.connection import get_db
from database.models import Job, JobResult, CompressedData
from utils.logging_config import get_logger

logger = get_logger(__name__)

class JobService:
    """Service for managing embedding computation jobs."""
    
    @staticmethod
    def create_job(
        job_id: str,
        method: str,
        params: Dict[str, Any],
        n_samples: Optional[int] = None,
        status: str = "queued"
    ) -> Dict[str, Any]:
        """Create a new job record."""
        try:
            db = next(get_db())
            
            job = Job(
                job_id=job_id,
                name=f"{method.upper()} Embedding",
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
        date_to: Optional[datetime] = None
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
            
            return query.order_by(desc(Job.created_at)).offset(offset).limit(limit).all()
            
        except Exception as e:
            logger.error(f"Error getting jobs: {e}")
            return []
    
    @staticmethod
    def get_job_count(
        status: Optional[str] = None,
        method: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
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
        synthetic_processed_samples: Optional[int] = None
    ) -> bool:
        """Update job with embedding results."""
        try:
            db = next(get_db())
            
            # Update job status
            job = db.query(Job).filter(Job.job_id == job_id).first()
            if not job:
                return False
            
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            job.runtime_seconds = runtime_seconds
            job.has_results = True
            
            # Create or update job results
            job_result = db.query(JobResult).filter(JobResult.job_id == job_id).first()
            if not job_result:
                job_result = JobResult(job_id=job_id)
                db.add(job_result)
            
            job_result.embedding_real = json.dumps(embedding_real)
            job_result.embedding_synthetic = json.dumps(embedding_synthetic)
            job_result.preprocessing_info = json.dumps(preprocessing_info)
            job_result.real_processed_samples = real_processed_samples
            job_result.synthetic_processed_samples = synthetic_processed_samples
            
            db.commit()
            logger.info(f"Updated results for job {job_id}")
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
            
            return {
                "embedding_real": json.loads(job_result.embedding_real),
                "embedding_synthetic": json.loads(job_result.embedding_synthetic),
                "preprocessing_info": json.loads(job_result.preprocessing_info),
                "real_processed_samples": job_result.real_processed_samples,
                "synthetic_processed_samples": job_result.synthetic_processed_samples
            }
            
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
            
            # Delete job
            db.query(Job).filter(Job.job_id == job_id).delete()
            
            db.commit()
            logger.info(f"Deleted job {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting job {job_id}: {e}")
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
            from services.compression_service import CompressionService
            
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