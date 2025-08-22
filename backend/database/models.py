"""
Database models for storing job information and results.

These models define the database tables used to track embedding jobs,
store results, and manage user preferences.
"""

from sqlalchemy import Column, String, DateTime, Float, Integer, Boolean, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

class Job(Base):
    """Tracks embedding computation jobs and their status."""
    
    __tablename__ = "jobs"
    
    job_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    method = Column(String, nullable=False)  # umap, tsne, pca
    parameters = Column(Text, nullable=True)  # JSON string of parameters
    status = Column(String, nullable=False, default="queued")  # queued, running, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    runtime_seconds = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    n_samples = Column(Integer, nullable=True)
    
    # Background processing info
    task_id = Column(String, nullable=True)
    worker_id = Column(String, nullable=True)
    progress = Column(Float, default=0.0)
    
    # What data we have stored
    has_results = Column(Boolean, default=False)
    has_compressed_data = Column(Boolean, default=False)
    has_model = Column(Boolean, default=False)  # Whether we saved the model

    # User settings
    is_favorite = Column(Boolean, default=False)

class JobResult(Base):
    """Job results model for storing embedding results."""
    
    __tablename__ = "job_results"
    
    job_id = Column(String, primary_key=True, index=True)
    embedding_real = Column(Text, nullable=True)  # JSON string of real embeddings
    embedding_synthetic = Column(Text, nullable=True)  # JSON string of synthetic embeddings
    preprocessing_info = Column(Text, nullable=True)  # JSON string of preprocessing info
    model_data = Column(Text, nullable=True)  # Base64 encoded pickled model
    model_format = Column(String, nullable=True)  # 'pickle' or 'joblib'
    real_processed_samples = Column(Integer, nullable=True)
    synthetic_processed_samples = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CompressedData(Base):
    """Compressed data model for storing original datasets."""
    
    __tablename__ = "compressed_data"
    
    job_id = Column(String, primary_key=True, index=True)
    compressed_data = Column(Text, nullable=False)  # JSON string of compressed data
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow) 