"""Service for managing embedding jobs and history."""
import hashlib
import json
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_

from database.models import EmbeddingJob, JobTag
from database.connection import get_db_session
from utils.logging_config import get_logger

class JobService:
    logger = get_logger("job_service")
    
    @staticmethod
    def _compute_data_hash(real_data: List[List[Any]], synthetic_data: List[List[Any]]) -> str:
        data_str = json.dumps({"real": real_data, "synthetic": synthetic_data}, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()
    
    @staticmethod
    def _job_to_dict(job: EmbeddingJob, include_embeddings: bool = False) -> Dict[str, Any]:
        job_dict = {
            "job_id": job.job_id,
            "name": job.name,
            "description": job.description,
            "method": job.method,
            "parameters": job.parameters,
            "status": job.status,
            "real_data_shape": job.real_data_shape,
            "synthetic_data_shape": job.synthetic_data_shape,
            "real_headers": job.real_headers,
            "synthetic_headers": job.synthetic_headers,
            "runtime_seconds": job.runtime_seconds,
            "preprocessing_info": job.preprocessing_info,
            "is_favorite": job.is_favorite,
            "error_message": job.error_message,
            "created_at": job.created_at,
            "updated_at": job.updated_at
        }
        
        if include_embeddings:
            job_dict.update({
                "embedding_real": job.embedding_real,
                "embedding_synthetic": job.embedding_synthetic
            })
        
        return job_dict
    
    @staticmethod
    def create_job(name: str, method: str, parameters: Dict[str, Any],
                   real_data: List[List[Any]], synthetic_data: List[List[Any]],
                   real_headers: Optional[List[str]] = None,
                   synthetic_headers: Optional[List[str]] = None,
                   description: Optional[str] = None) -> Dict[str, Any]:
        JobService.logger.info(f"Creating job: {name}")
        
        data_hash = JobService._compute_data_hash(real_data, synthetic_data)
        
        with get_db_session() as db:
            job = EmbeddingJob(
                name=name,
                description=description,
                method=method,
                parameters=parameters,
                real_data_shape=[len(real_data), len(real_data[0]) if real_data else 0],
                synthetic_data_shape=[len(synthetic_data), len(synthetic_data[0]) if synthetic_data else 0],
                real_headers=real_headers,
                synthetic_headers=synthetic_headers,
                data_hash=data_hash,
                status="running"
            )
            
            db.add(job)
            db.flush()
            
            return {
                "job_id": job.job_id,
                "name": job.name,
                "status": job.status,
                "created_at": job.created_at
            }
    
    @staticmethod
    def update_job_results(job_id: str, embedding_real: List[List[float]],
                          embedding_synthetic: List[List[float]], runtime_seconds: float,
                          preprocessing_info: Optional[Dict[str, Any]] = None) -> bool:
        with get_db_session() as db:
            job = db.query(EmbeddingJob).filter(EmbeddingJob.job_id == job_id).first()
            if not job:
                return False
            
            job.embedding_real = embedding_real
            job.embedding_synthetic = embedding_synthetic
            job.runtime_seconds = runtime_seconds
            job.preprocessing_info = preprocessing_info
            job.status = "completed"
            job.updated_at = datetime.utcnow()
            
            JobService.logger.info(f"Job {job_id} completed in {runtime_seconds:.2f}s")
            return True
    
    @staticmethod
    def mark_job_failed(job_id: str, error_message: str) -> bool:
        with get_db_session() as db:
            job = db.query(EmbeddingJob).filter(EmbeddingJob.job_id == job_id).first()
            if not job:
                return False
            
            job.status = "failed"
            job.error_message = error_message
            job.updated_at = datetime.utcnow()
            
            JobService.logger.error(f"Job {job_id} failed: {error_message}")
            return True
    
    @staticmethod
    def get_job_by_id(job_id: str, include_embeddings: bool = False) -> Optional[Dict[str, Any]]:
        with get_db_session() as db:
            job = db.query(EmbeddingJob).filter(EmbeddingJob.job_id == job_id).first()
            return JobService._job_to_dict(job, include_embeddings) if job else None
    
    @staticmethod
    def get_job_history(limit: int = 50, offset: int = 0,
                       status_filter: Optional[str] = None,
                       method_filter: Optional[str] = None,
                       favorites_only: bool = False) -> Tuple[List[Dict[str, Any]], int]:
        with get_db_session() as db:
            query = db.query(EmbeddingJob)
            
            if status_filter:
                query = query.filter(EmbeddingJob.status == status_filter)
            if method_filter:
                query = query.filter(EmbeddingJob.method == method_filter)
            if favorites_only:
                query = query.filter(EmbeddingJob.is_favorite == True)
            
            total = query.count()
            jobs = query.order_by(desc(EmbeddingJob.created_at)).offset(offset).limit(limit).all()
            
            return [JobService._job_to_dict(job) for job in jobs], total
    
    @staticmethod
    def toggle_favorite(job_id: str) -> bool:
        with get_db_session() as db:
            job = db.query(EmbeddingJob).filter(EmbeddingJob.job_id == job_id).first()
            if not job:
                return False
            
            job.is_favorite = not job.is_favorite
            job.updated_at = datetime.utcnow()
            return True
    
    @staticmethod
    def delete_job(job_id: str) -> bool:
        with get_db_session() as db:
            db.query(JobTag).filter(JobTag.job_id == job_id).delete()
            job = db.query(EmbeddingJob).filter(EmbeddingJob.job_id == job_id).first()
            if not job:
                return False
            
            db.delete(job)
            return True
    
    @staticmethod
    def find_similar_job(real_data: List[List[Any]], synthetic_data: List[List[Any]],
                        method: str, parameters: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        data_hash = JobService._compute_data_hash(real_data, synthetic_data)
        
        with get_db_session() as db:
            job = db.query(EmbeddingJob).filter(
                and_(
                    EmbeddingJob.data_hash == data_hash,
                    EmbeddingJob.method == method,
                    EmbeddingJob.status == "completed"
                )
            ).first()
            
            if job:
                return {
                    "embedding_real": job.embedding_real,
                    "embedding_synthetic": job.embedding_synthetic,
                    "runtime_seconds": job.runtime_seconds,
                    "method": job.method,
                    "parameters": job.parameters,
                    "real_data_shape": job.real_data_shape,
                    "synthetic_data_shape": job.synthetic_data_shape,
                    "preprocessing_info": job.preprocessing_info,
                    "job_id": job.job_id,
                    "name": job.name,
                    "created_at": job.created_at
                }
            
            return None
    
    @staticmethod
    def add_job_tag(job_id: str, tag: str) -> bool:
        with get_db_session() as db:
            job = db.query(EmbeddingJob).filter(EmbeddingJob.job_id == job_id).first()
            if not job:
                return False
            
            existing_tag = db.query(JobTag).filter(
                and_(JobTag.job_id == job_id, JobTag.tag == tag)
            ).first()
            
            if existing_tag:
                return False
            
            db.add(JobTag(job_id=job_id, tag=tag))
            return True
    
    @staticmethod
    def get_job_tags(job_id: str) -> List[str]:
        with get_db_session() as db:
            tags = db.query(JobTag).filter(JobTag.job_id == job_id).all()
            return [tag.tag for tag in tags]
    
    @staticmethod
    def cleanup_old_jobs(days: int = 30) -> int:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        with get_db_session() as db:
            old_jobs = db.query(EmbeddingJob).filter(EmbeddingJob.created_at < cutoff_date).all()
            count = len(old_jobs)
            
            if count > 0:
                for job in old_jobs:
                    db.query(JobTag).filter(JobTag.job_id == job.job_id).delete()
                
                db.query(EmbeddingJob).filter(EmbeddingJob.created_at < cutoff_date).delete()
                JobService.logger.info(f"Deleted {count} old jobs")
            
            return count
    
    @staticmethod
    def cleanup_stuck_jobs(max_runtime_minutes: int = 60) -> int:
        """Clean up jobs that have been stuck in 'running' status for too long."""
        cutoff_time = datetime.utcnow() - timedelta(minutes=max_runtime_minutes)
        
        with get_db_session() as db:
            stuck_jobs = db.query(EmbeddingJob).filter(
                and_(
                    EmbeddingJob.status == "running",
                    EmbeddingJob.created_at < cutoff_time
                )
            ).all()
            
            count = len(stuck_jobs)
            for job in stuck_jobs:
                job.status = "failed"
                job.error_message = f"Job timed out after {max_runtime_minutes} minutes"
                job.updated_at = datetime.utcnow()
            
            JobService.logger.info(f"Cleaned up {count} stuck jobs")
            return count

    @staticmethod
    def get_job_stats() -> Dict[str, Any]:
        """Get comprehensive statistics about jobs."""
        with get_db_session() as db:
            total_jobs = db.query(EmbeddingJob).count()
            completed_jobs = db.query(EmbeddingJob).filter(EmbeddingJob.status == "completed").count()
            failed_jobs = db.query(EmbeddingJob).filter(EmbeddingJob.status == "failed").count()
            running_jobs = db.query(EmbeddingJob).filter(EmbeddingJob.status == "running").count()
            favorite_jobs = db.query(EmbeddingJob).filter(EmbeddingJob.is_favorite == True).count()
            
            # Method breakdown
            umap_jobs = db.query(EmbeddingJob).filter(EmbeddingJob.method == "umap").count()
            tsne_jobs = db.query(EmbeddingJob).filter(EmbeddingJob.method == "tsne").count()
            
            # Average runtime for completed jobs
            avg_runtime_query = db.query(EmbeddingJob.runtime_seconds).filter(
                and_(
                    EmbeddingJob.status == "completed",
                    EmbeddingJob.runtime_seconds.isnot(None)
                )
            ).all()
            
            avg_runtime = None
            if avg_runtime_query:
                runtimes = [r[0] for r in avg_runtime_query if r[0] is not None]
                avg_runtime = sum(runtimes) / len(runtimes) if runtimes else None
            
            return {
                "total_jobs": total_jobs,
                "completed_jobs": completed_jobs,
                "failed_jobs": failed_jobs,
                "running_jobs": running_jobs,
                "favorite_jobs": favorite_jobs,
                "umap_jobs": umap_jobs,
                "tsne_jobs": tsne_jobs,
                "avg_runtime_seconds": avg_runtime,
                "success_rate": (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0
            } 