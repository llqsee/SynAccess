#!/usr/bin/env python3
"""
Database migration to add processed sample count fields.

This migration adds:
- real_processed_samples: Actual samples used for real data visualization
- synthetic_processed_samples: Actual samples used for synthetic data visualization

Run this script to update existing databases with the new schema.
"""

import sys
import os
from sqlalchemy import text, Integer, Column
from sqlalchemy.exc import SQLAlchemyError

# Add parent directory to path to import modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import get_db_session, engine
from utils.logging_config import get_logger

logger = get_logger("migration_processed_samples")

def add_processed_samples_columns():
    """Add real_processed_samples and synthetic_processed_samples columns to embedding_jobs table."""
    
    migration_sql = [
        "ALTER TABLE embedding_jobs ADD COLUMN real_processed_samples INTEGER;",
        "ALTER TABLE embedding_jobs ADD COLUMN synthetic_processed_samples INTEGER;"
    ]
    
    try:
        with get_db_session() as db:
            for sql in migration_sql:
                try:
                    logger.info(f"Executing: {sql}")
                    db.execute(text(sql))
                    db.commit()
                    logger.info("✓ Column added successfully")
                except SQLAlchemyError as e:
                    if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                        logger.info("Column already exists, skipping...")
                        db.rollback()
                    else:
                        logger.error(f"Failed to add column: {e}")
                        db.rollback()
                        raise
        
        logger.info("✅ Migration completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        return False

def backfill_processed_samples():
    """
    Backfill processed sample counts for existing jobs.
    For existing jobs, set processed samples equal to original data shape.
    """
    
    try:
        with get_db_session() as db:
            # Update existing jobs where processed samples are NULL (SQLite version)
            backfill_sql = """
            UPDATE embedding_jobs 
            SET 
                real_processed_samples = CASE 
                    WHEN real_data_shape IS NOT NULL AND json_extract(real_data_shape, '$[0]') IS NOT NULL
                    THEN CAST(json_extract(real_data_shape, '$[0]') AS INTEGER)
                    ELSE NULL 
                END,
                synthetic_processed_samples = CASE 
                    WHEN synthetic_data_shape IS NOT NULL AND json_extract(synthetic_data_shape, '$[0]') IS NOT NULL
                    THEN CAST(json_extract(synthetic_data_shape, '$[0]') AS INTEGER)
                    ELSE NULL 
                END
            WHERE real_processed_samples IS NULL OR synthetic_processed_samples IS NULL;
            """
            
            logger.info("Backfilling processed sample counts for existing jobs...")
            result = db.execute(text(backfill_sql))
            rows_updated = result.rowcount
            db.commit()
            
            logger.info(f"✅ Backfilled {rows_updated} existing jobs")
            return True
            
    except Exception as e:
        logger.error(f"❌ Backfill failed: {e}")
        return False

def verify_migration():
    """Verify that the migration was successful."""
    
    try:
        with get_db_session() as db:
            # Check if columns exist (SQLite version)
            check_sql = """
            PRAGMA table_info(embedding_jobs);
            """
            
            result = db.execute(text(check_sql))
            columns = [row[1] for row in result.fetchall()]  # column name is at index 1
            
            expected_columns = ['real_processed_samples', 'synthetic_processed_samples']
            missing_columns = [col for col in expected_columns if col not in columns]
            
            if missing_columns:
                logger.error(f"❌ Missing columns: {missing_columns}")
                return False
            
            # Check sample data
            sample_sql = """
            SELECT COUNT(*) as total_jobs,
                   COUNT(real_processed_samples) as jobs_with_real_samples,
                   COUNT(synthetic_processed_samples) as jobs_with_synth_samples
            FROM embedding_jobs;
            """
            
            result = db.execute(text(sample_sql))
            stats = result.fetchone()
            
            logger.info(f"✅ Migration verification:")
            logger.info(f"   - Total jobs: {stats[0]}")
            logger.info(f"   - Jobs with real processed samples: {stats[1]}")
            logger.info(f"   - Jobs with synthetic processed samples: {stats[2]}")
            
            return True
            
    except Exception as e:
        logger.error(f"❌ Verification failed: {e}")
        return False

def main():
    """Run the complete migration process."""
    
    logger.info("🚀 Starting processed samples migration...")
    
    # Step 1: Add new columns
    if not add_processed_samples_columns():
        logger.error("❌ Failed to add columns")
        return False
    
    # Step 2: Backfill existing data
    if not backfill_processed_samples():
        logger.error("❌ Failed to backfill data")
        return False
    
    # Step 3: Verify migration
    if not verify_migration():
        logger.error("❌ Migration verification failed")
        return False
    
    logger.info("🎉 Migration completed successfully!")
    logger.info("📝 New features:")
    logger.info("   - Job names now show actual processed sample counts")
    logger.info("   - History displays visualization sample counts, not total dataset size")
    logger.info("   - More accurate representation of what was actually visualized")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 