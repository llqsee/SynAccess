#!/usr/bin/env python3
"""
Setup script for MAVIS database initialization.
This script helps set up the SQLite database for persistent job history.
"""

import sys
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are installed."""
    required_packages = {
        'sqlalchemy': 'sqlalchemy',
        'fastapi': 'fastapi',
        'uvicorn': 'uvicorn'
    }
    
    missing_packages = []
    
    for package_name, import_name in required_packages.items():
        try:
            __import__(import_name)
            print(f"✓ {package_name} is installed")
        except ImportError:
            missing_packages.append(package_name)
            print(f"✗ {package_name} is missing")
    
    if missing_packages:
        print(f"\nMissing packages: {', '.join(missing_packages)}")
        print("Please install missing packages using:")
        print("conda env update -f environment.yml")
        return False
    
    return True

def initialize_database():
    """Initialize the SQLite database tables."""
    try:
        # Add backend directory to Python path
        backend_dir = Path(__file__).parent / 'backend'
        sys.path.insert(0, str(backend_dir))
        
        from database.connection import init_database
        
        print("Initializing SQLite database...")
        init_database()
        
        # Check if database file was created
        db_file = backend_dir / 'mavis_dev.db'
        if db_file.exists():
            file_size = db_file.stat().st_size
            print(f"✓ Database file created: {db_file} ({file_size} bytes)")
        
        print("✓ Database tables initialized successfully")
        return True
        
    except Exception as e:
        print(f"✗ Error initializing database: {e}")
        return False

def main():
    """Main setup function."""
    print("MAVIS Database Setup (SQLite)")
    print("=" * 50)
    
    # Check dependencies
    print("\n1. Checking dependencies...")
    if not check_dependencies():
        return False
    
    # Initialize database
    print("\n2. Initializing SQLite database...")
    if not initialize_database():
        return False
    
    print("\n" + "=" * 50)
    print("Setup completed successfully!")
    print("\nSQLite database is ready for use.")
    print("Database file: backend/mavis_dev.db")
    print("\nTo start the application:")
    print("1. Backend: cd backend && python main.py")
    print("2. Frontend: cd frontend && npm start")
    print("\nThe application now supports persistent job history!")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 