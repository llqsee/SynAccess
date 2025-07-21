#!/usr/bin/env python3
"""
MAVIS Backend Server Startup Script
Ensures proper task queue initialization and provides diagnostics
"""

import sys
import time
import requests
import uvicorn
import multiprocessing as mp
from pathlib import Path

def check_dependencies():
    """Check if all required dependencies are available."""
    try:
        import zmq
        import fastapi
        import sqlalchemy
        print("✅ All dependencies available")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        return False

def check_ports():
    """Check if required ports are available."""
    import socket
    
    ports_to_check = [8000, 5555, 5556, 5557]  # API, ZMQ frontend, backend, status
    
    for port in ports_to_check:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            result = sock.connect_ex(('localhost', port))
            if result == 0:
                print(f"⚠️  Port {port} is already in use")
                sock.close()
                return False
            else:
                print(f"✅ Port {port} is available")
        except Exception as e:
            print(f"❌ Error checking port {port}: {e}")
            return False
        finally:
            sock.close()
    
    return True

def start_server():
    """Start the FastAPI server with proper configuration."""
    print("🚀 Starting MAVIS backend server...")
    
    # Add current directory to Python path
    sys.path.insert(0, str(Path(__file__).parent))
    
    try:
        uvicorn.run(
            "main:app",
            host="0.0.0.0", 
            port=8000,
            log_level="info",
            reload=False  # Disable reload to prevent multiprocessing issues
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
        import traceback
        traceback.print_exc()

def verify_server():
    """Verify server is running and task queue is initialized."""
    print("🔍 Verifying server startup...")
    
    max_attempts = 10
    for attempt in range(max_attempts):
        try:
            # Check health endpoint
            response = requests.get('http://localhost:8000/health', timeout=2)
            if response.status_code == 200:
                print("✅ Server is responding")
                
                # Check task queue status
                response = requests.get('http://localhost:8000/api/v1/queue/status', timeout=2)
                if response.status_code == 200:
                    data = response.json()
                    workers = data.get('total_workers', 0)
                    
                    if workers > 0:
                        print(f"✅ Task queue running with {workers} workers")
                        return True
                    else:
                        print("⚠️  Task queue not running, attempting to start...")
                        # Try to start the queue
                        start_response = requests.post('http://localhost:8000/api/v1/queue/start', timeout=5)
                        if start_response.status_code == 200:
                            print("✅ Task queue started successfully")
                            return True
                        else:
                            print(f"❌ Failed to start task queue: {start_response.text}")
                else:
                    print(f"❌ Queue status check failed: {response.status_code}")
            else:
                print(f"❌ Health check failed: {response.status_code}")
                
        except requests.exceptions.ConnectionError:
            if attempt < max_attempts - 1:
                print(f"⏳ Waiting for server... (attempt {attempt + 1}/{max_attempts})")
                time.sleep(2)
            else:
                print("❌ Server failed to start")
                return False
        except Exception as e:
            print(f"❌ Verification error: {e}")
            return False
    
    return False

def main():
    """Main startup function."""
    print("="*60)
    print("🏗️  MAVIS Backend Server Startup")
    print("="*60)
    
    # Pre-flight checks
    if not check_dependencies():
        print("❌ Dependency check failed")
        return False
    
    if not check_ports():
        print("❌ Port availability check failed")
        print("💡 Try stopping any existing MAVIS processes:")
        print("   - Check Task Manager for python.exe processes")
        print("   - Or restart your terminal/IDE")
        return False
    
    print("✅ Pre-flight checks passed")
    print()
    
    # Start server
    if len(sys.argv) > 1 and sys.argv[1] == "--verify-only":
        return verify_server()
    else:
        # Start server in main process
        start_server()

if __name__ == "__main__":
    # For Windows multiprocessing support
    mp.set_start_method('spawn', force=True)
    main() 