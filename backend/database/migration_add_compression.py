"""Database migration script to add compression and snapshot functionality."""
import sqlite3
from pathlib import Path

def migrate_database(db_path: str = "backend/mavis_dev.db"):
    """Apply migration to add compression and snapshot functionality."""
    
    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Starting database migration...")
        
        # Add new columns to embedding_jobs table
        print("Adding compression fields to embedding_jobs table...")
        
        # Check if columns already exist to avoid errors
        cursor.execute("PRAGMA table_info(embedding_jobs)")
        columns = [column[1] for column in cursor.fetchall()]
        
        migration_queries = []
        
        # Add new columns if they don't exist
        if 'real_data_compressed' not in columns:
            migration_queries.extend([
                "ALTER TABLE embedding_jobs ADD COLUMN real_data_compressed BLOB",
                "ALTER TABLE embedding_jobs ADD COLUMN synthetic_data_compressed BLOB",
                "ALTER TABLE embedding_jobs ADD COLUMN compression_method VARCHAR(50) DEFAULT 'zstd'",
                "ALTER TABLE embedding_jobs ADD COLUMN compression_ratio REAL",
                "ALTER TABLE embedding_jobs ADD COLUMN data_preview TEXT",
                "ALTER TABLE embedding_jobs ADD COLUMN distribution_settings TEXT",
                "ALTER TABLE embedding_jobs ADD COLUMN user_preferences TEXT",
                "ALTER TABLE embedding_jobs ADD COLUMN has_compressed_data BOOLEAN DEFAULT FALSE",
                "ALTER TABLE embedding_jobs ADD COLUMN storage_size_mb REAL",
                "ALTER TABLE embedding_jobs ADD COLUMN compression_status VARCHAR(20) DEFAULT 'pending'"
            ])
        
        # Execute column additions
        for query in migration_queries:
            try:
                cursor.execute(query)
                print(f"✓ Executed: {query}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    print(f"⚠ Column already exists: {query}")
                else:
                    raise
        
        # Create data_snapshots table if it doesn't exist
        print("Creating data_snapshots table...")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS data_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_id VARCHAR(36) UNIQUE NOT NULL,
                job_id VARCHAR(36) NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                compression_algorithm VARCHAR(20) DEFAULT 'zstd',
                compression_level INTEGER DEFAULT 3,
                original_size_mb FLOAT NOT NULL,
                compressed_size_mb FLOAT NOT NULL,
                compression_ratio FLOAT NOT NULL,
                data_format VARCHAR(20) DEFAULT 'parquet',
                chunked_storage BOOLEAN DEFAULT FALSE,
                chunk_count INTEGER,
                ui_state JSON,
                plot_configurations JSON,
                selected_subsets JSON,
                compressed_data BLOB NOT NULL
            )
        """)
        print("✓ Created data_snapshots table")
        
        # Create indexes for better performance
        print("Creating indexes...")
        
        index_queries = [
            "CREATE INDEX IF NOT EXISTS idx_snapshots_job_id ON data_snapshots(job_id)",
            "CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON data_snapshots(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_jobs_has_compressed_data ON embedding_jobs(has_compressed_data)",
            "CREATE INDEX IF NOT EXISTS idx_jobs_storage_size ON embedding_jobs(storage_size_mb)"
        ]
        
        for query in index_queries:
            cursor.execute(query)
            print(f"✓ Created index: {query}")
        
        # Commit the changes
        conn.commit()
        print("✅ Database migration completed successfully!")
        
        # Print migration summary
        cursor.execute("SELECT COUNT(*) FROM embedding_jobs")
        job_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM data_snapshots")
        snapshot_count = cursor.fetchone()[0]
        
        print(f"\n📊 Migration Summary:")
        print(f"   • Existing jobs: {job_count}")
        print(f"   • Existing snapshots: {snapshot_count}")
        print(f"   • Added compression support to embedding_jobs table")
        print(f"   • Created data_snapshots table for advanced session management")
        print(f"   • Added performance indexes")
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()

def verify_migration(db_path: str = "backend/mavis_dev.db"):
    """Verify that the migration was applied correctly."""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Verifying migration...")
        
        # Check embedding_jobs table structure
        cursor.execute("PRAGMA table_info(embedding_jobs)")
        job_columns = [column[1] for column in cursor.fetchall()]
        
        required_columns = [
            'real_data_compressed', 'synthetic_data_compressed', 'compression_method',
            'compression_ratio', 'data_preview', 'distribution_settings', 
            'user_preferences', 'has_compressed_data', 'storage_size_mb'
        ]
        
        missing_columns = [col for col in required_columns if col not in job_columns]
        if missing_columns:
            print(f"❌ Missing columns in embedding_jobs: {missing_columns}")
            return False
        
        # Check data_snapshots table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='data_snapshots'")
        if not cursor.fetchone():
            print("❌ data_snapshots table not found")
            return False
        
        # Check data_snapshots structure
        cursor.execute("PRAGMA table_info(data_snapshots)")
        snapshot_columns = [column[1] for column in cursor.fetchall()]
        
        required_snapshot_columns = [
            'id', 'snapshot_id', 'job_id', 'name', 'compressed_data',
            'compression_algorithm', 'compression_ratio', 'ui_state'
        ]
        
        missing_snapshot_columns = [col for col in required_snapshot_columns if col not in snapshot_columns]
        if missing_snapshot_columns:
            print(f"❌ Missing columns in data_snapshots: {missing_snapshot_columns}")
            return False
        
        print("✅ Migration verification successful!")
        print(f"   • embedding_jobs table has {len(job_columns)} columns")
        print(f"   • data_snapshots table has {len(snapshot_columns)} columns")
        
        return True
        
    except Exception as e:
        print(f"❌ Verification failed: {str(e)}")
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    # Run migration
    db_path = Path(__file__).parent.parent / "mavis_dev.db"
    migrate_database(str(db_path))
    
    # Verify migration
    if verify_migration(str(db_path)):
        print("\n🎉 Database is ready for compressed data storage!")
    else:
        print("\n⚠️  Migration verification failed. Please check the database manually.") 