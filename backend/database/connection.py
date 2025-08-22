"""
Database connection and session management.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import os
from pathlib import Path

from backend.config import DATABASE_URL, DATABASE_CONFIG

# Create engine
engine = create_engine(
    DATABASE_URL,
    poolclass=StaticPool,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=DATABASE_CONFIG.get("echo", False)
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database tables."""
    from backend.database.models import Base
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    print("Database initialized successfully")

def get_db_session():
    """Get database session context manager."""
    return SessionLocal() 