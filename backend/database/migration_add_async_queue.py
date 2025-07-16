"""
Database migration: Add asynchronous queue processing fields
"""

import sqlite3
from typing import List

def get_migration_queries() -> List[str]:
    """Get the SQL queries for adding async queue fields."""
    return [
        # Add task_id field for ZeroMQ task tracking
        "ALTER TABLE embedding_jobs ADD COLUMN task_id TEXT",
        
        # Add queue management fields
        "ALTER TABLE embedding_jobs ADD COLUMN queue_position INTEGER",
        "ALTER TABLE embedding_jobs ADD COLUMN progress REAL DEFAULT 0.0",
        "ALTER TABLE embedding_jobs ADD COLUMN worker_id TEXT",
        "ALTER TABLE embedding_jobs ADD COLUMN priority INTEGER DEFAULT 0",
        
        # Add timing fields for async processing
        "ALTER TABLE embedding_jobs ADD COLUMN started_at DATETIME",
        "ALTER TABLE embedding_jobs ADD COLUMN estimated_completion DATETIME",
        
        # Create index on task_id for faster lookups
        "CREATE INDEX IF NOT EXISTS idx_embedding_jobs_task_id ON embedding_jobs(task_id)",
        
        # Create index on queue_position for queue management
        "CREATE INDEX IF NOT EXISTS idx_embedding_jobs_queue_position ON embedding_jobs(queue_position)",
        
        # Create index on status for filtering
        "CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_jobs(status)",
    ]

def run_migration(db_path: str = "mavis_dev.db") -> bool:
    """
    Run the migration to add async queue fields.
    
    Args:
        db_path: Path to the SQLite database
        
    Returns:
        bool: True if migration was successful
    """
    try:
        print("Starting async queue migration...")
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Check if migration is needed by checking if task_id column exists
            cursor.execute("PRAGMA table_info(embedding_jobs)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'task_id' in columns:
                print("Migration already applied - task_id column exists")
                return True
            
            # Execute migration queries
            queries = get_migration_queries()
            for i, query in enumerate(queries):
                try:
                    print(f"Executing migration step {i+1}/{len(queries)}: {query[:50]}...")
                    cursor.execute(query)
                    conn.commit()
                    print(f"Step {i+1} completed successfully")
                except sqlite3.Error as e:
                    if "duplicate column name" in str(e).lower():
                        print(f"Column already exists, skipping: {e}")
                        continue
                    else:
                        raise e
            
            print("Async queue migration completed successfully")
            return True
            
    except Exception as e:
        print(f"Migration failed: {e}")
        return False

def verify_migration(db_path: str = "mavis_dev.db") -> bool:
    """
    Verify that the migration was applied correctly.
    
    Args:
        db_path: Path to the SQLite database
        
    Returns:
        bool: True if migration is verified
    """
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Check if all new columns exist
            cursor.execute("PRAGMA table_info(embedding_jobs)")
            columns = [row[1] for row in cursor.fetchall()]
            
            expected_columns = [
                'task_id', 'queue_position', 'progress', 'worker_id', 
                'priority', 'started_at', 'estimated_completion'
            ]
            
            missing_columns = [col for col in expected_columns if col not in columns]
            
            if missing_columns:
                print(f"Migration verification failed - missing columns: {missing_columns}")
                return False
            
            # Check if indexes exist
            cursor.execute("PRAGMA index_list(embedding_jobs)")
            indexes = [row[1] for row in cursor.fetchall()]
            
            expected_indexes = [
                'idx_embedding_jobs_task_id',
                'idx_embedding_jobs_queue_position', 
                'idx_embedding_jobs_status'
            ]
            
            missing_indexes = [idx for idx in expected_indexes if idx not in indexes]
            
            if missing_indexes:
                print(f"Some indexes missing: {missing_indexes}")
                # Indexes are not critical, don't fail verification
            
            print("Migration verification passed")
            return True
            
    except Exception as e:
        print(f"Migration verification failed: {e}")
        return False

if __name__ == "__main__":
    import sys
    
    # Allow running migration from command line
    db_path = sys.argv[1] if len(sys.argv) > 1 else "mavis_dev.db"
    
    print(f"Running async queue migration on {db_path}...")
    
    if run_migration(db_path):
        print("Migration completed successfully")
        
        if verify_migration(db_path):
            print("Migration verified successfully")
        else:
            print("Migration verification failed")
            sys.exit(1)
    else:
        print("Migration failed")
        sys.exit(1) 