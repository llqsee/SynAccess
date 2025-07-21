#!/usr/bin/env python3
"""
Database setup script to initialize tables.
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from database.connection import init_db
from database.models import Base
from sqlalchemy import create_engine
from config import DATABASE_URL

def main():
    """Initialize the database with all tables."""
    print("Setting up database...")
    
    try:
        # Create engine
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
        )
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        print("✅ Database initialized successfully!")
        print(f"Database URL: {DATABASE_URL}")
        
    except Exception as e:
        print(f"❌ Failed to initialize database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 