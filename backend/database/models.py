"""Database models for MAVIS application."""
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid
from datetime import datetime

Base = declarative_base()

class EmbeddingJob(Base):
    """Model for storing embedding job information and results."""
    __tablename__ = "embedding_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Job metadata
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Embedding configuration
    method = Column(String(50), nullable=False)  # 'umap' or 'tsne'
    parameters = Column(JSON, nullable=False)  # Method parameters
    
    # Data information
    real_data_shape = Column(JSON, nullable=False)  # [rows, cols]
    synthetic_data_shape = Column(JSON, nullable=False)  # [rows, cols]
    real_headers = Column(JSON, nullable=True)  # Column names
    synthetic_headers = Column(JSON, nullable=True)  # Column names
    data_hash = Column(String(64), nullable=False, index=True)  # Hash of input data for deduplication
    
    # Results
    embedding_real = Column(JSON, nullable=True)  # Real data embeddings
    embedding_synthetic = Column(JSON, nullable=True)  # Synthetic data embeddings
    
    # Performance metadata
    runtime_seconds = Column(Float, nullable=True)
    preprocessing_info = Column(JSON, nullable=True)
    
    # Status and flags
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    error_message = Column(Text, nullable=True)
    is_favorite = Column(Boolean, default=False)
    
    def to_dict(self):
        """Convert model to dictionary for API responses."""
        return {
            "id": self.id,
            "job_id": self.job_id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "method": self.method,
            "parameters": self.parameters,
            "real_data_shape": self.real_data_shape,
            "synthetic_data_shape": self.synthetic_data_shape,
            "real_headers": self.real_headers,
            "synthetic_headers": self.synthetic_headers,
            "runtime_seconds": self.runtime_seconds,
            "preprocessing_info": self.preprocessing_info,
            "status": self.status,
            "error_message": self.error_message,
            "is_favorite": self.is_favorite,
        }
    
    def to_dict_with_embeddings(self):
        """Convert model to dictionary including embedding data."""
        result = self.to_dict()
        result.update({
            "embedding_real": self.embedding_real,
            "embedding_synthetic": self.embedding_synthetic,
        })
        return result

class JobTag(Base):
    """Model for job tags/labels for organization."""
    __tablename__ = "job_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(36), index=True, nullable=False)
    tag = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        return {
            "id": self.id,
            "job_id": self.job_id,
            "tag": self.tag,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        } 