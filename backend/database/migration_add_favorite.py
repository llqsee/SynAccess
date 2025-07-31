"""
Migration to add is_favorite column to jobs table.
"""

import sqlite3
import os
from pathlib import Path

def migrate():
    """Add is_favorite column to jobs table."""
    db_path = Path(__file__).parent.parent / "mavis_dev.db"
    
    if not db_path.exists():
        print("Database file not found. Skipping migration.")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if the column already exists
        cursor.execute("PRAGMA table_info(jobs)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'is_favorite' not in columns:
            print("Adding is_favorite column to jobs table...")
            cursor.execute("ALTER TABLE jobs ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE")
            conn.commit()
            print("Successfully added is_favorite column to jobs table.")
        else:
            print("is_favorite column already exists in jobs table.")
        
        conn.close()
        
    except Exception as e:
        print(f"Error during migration: {e}")
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    migrate() 