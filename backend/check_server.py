#!/usr/bin/env python3
"""
Check if backend server and task queue are running
"""

import requests
import time

def main():
    print("Checking backend server status...")
    
    try:
        # Check server health
        response = requests.get('http://localhost:8000/health', timeout=5)
        print(f'✅ Server health check - Status: {response.status_code}')
        
        # Check queue status
        response = requests.get('http://localhost:8000/api/v1/queue/status', timeout=5)
        print(f'✅ Queue endpoint - Status: {response.status_code}')
        
        if response.status_code == 200:
            data = response.json()
            total_workers = data.get('total_workers', 0)
            active_workers = data.get('active_workers', 0)
            queued_tasks = data.get('total_queued', 0)
            processing_tasks = data.get('currently_processing', 0)
            
            print(f'📊 Queue Status:')
            print(f'   Total workers: {total_workers}')
            print(f'   Active workers: {active_workers}')
            print(f'   Queued tasks: {queued_tasks}')
            print(f'   Processing tasks: {processing_tasks}')
            
            if total_workers > 0:
                print('✅ Task queue is RUNNING')
                return True
            else:
                print('❌ Task queue is NOT running')
                return False
        else:
            print(f'❌ Queue status check failed: {response.text}')
            return False
            
    except requests.exceptions.ConnectionError:
        print('❌ Server is NOT running (connection refused)')
        return False
    except Exception as e:
        print(f'❌ Error: {e}')
        return False

if __name__ == "__main__":
    main() 