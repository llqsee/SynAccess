"""
Migration to add model storage fields to jobs and job_results tables.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database.connection import engine

def migrate():
    """Add model storage fields to the database."""
    
    with engine.connect() as conn:
        # Add has_model field to jobs table
        conn.execute(text("""
            ALTER TABLE jobs 
            ADD COLUMN has_model BOOLEAN DEFAULT FALSE
        """))
        
        # Add model storage fields to job_results table
        conn.execute(text("""
            ALTER TABLE job_results 
            ADD COLUMN model_data TEXT
        """))
        
        conn.execute(text("""
            ALTER TABLE job_results 
            ADD COLUMN model_format VARCHAR(10)
        """))
        
        conn.commit()
    
    print("Migration completed: Added model storage fields")

if __name__ == "__main__":
    migrate() 