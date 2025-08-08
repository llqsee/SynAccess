#!/usr/bin/env python3
"""
Comprehensive API endpoint testing script
Tests all backend endpoints to ensure they're working properly
"""

import requests
import json
import numpy as np
import time
from pathlib import Path
import sys

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

def test_validation_endpoints():
    """Test validation API endpoints."""
    base_url = "http://localhost:8000/api/v1"
    
    print("Testing Validation API Endpoints")
    print("=" * 50)
    
    # Test 1: Status endpoint
    try:
        response = requests.get(f"{base_url}/validation/status")
        if response.status_code == 200:
            status_data = response.json()
            print("Validation status endpoint working")
            print(f"   Service: {status_data.get('service', 'unknown')}")
            print(f"   Status: {status_data.get('status', 'unknown')}")
            print(f"   Capabilities: {len(status_data.get('capabilities', {}))} available")
        else:
            print(f"Validation status failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"Validation status test failed: {e}")
        return False
    
    # Test 2: Compute statistics endpoint
    try:
        # Create sample data
        np.random.seed(42)
        n_samples = 50
        
        real_data = {
            'data': [[float(np.random.normal(0, 1)) for _ in range(3)] for _ in range(n_samples)],
            'headers': ['feature1', 'feature2', 'feature3']
        }
        
        synthetic_data = {
            'data': [[float(np.random.normal(0.1, 1.1)) for _ in range(3)] for _ in range(n_samples)],
            'headers': ['feature1', 'feature2', 'feature3']
        }
        
        payload = {
            'real_data': real_data,
            'synthetic_data': synthetic_data,
            'options': {}
        }
        
        response = requests.post(
            f"{base_url}/validation/compute-statistics",
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            results = response.json()
            print("Validation compute-statistics endpoint working")
            print(f"   Processing time: {results.get('processingTime', 0):.2f}s")
            print(f"   Total tests: {results.get('summary', {}).get('totalTests', 0)}")
            print(f"   Test categories: {len(results.get('results', {}))}")
            
            # Check for FDR correction
            if 'fdrCorrection' in results:
                print("FDR correction applied")
                fdr_results = results['fdrCorrection']
                for test_type, info in fdr_results.items():
                    if 'totalTests' in info:
                        print(f"   {test_type}: {info['totalTests']} tests")
        else:
            print(f"Validation compute-statistics failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"Validation compute-statistics test failed: {e}")
        return False
    
    return True

def test_embedding_endpoints():
    """Test embedding API endpoints."""
    base_url = "http://localhost:8000/api/v1"
    
    print("\nTesting Embedding API Endpoints")
    print("=" * 50)
    
    # Test 1: Submit embedding job
    try:
        # Create sample data
        np.random.seed(42)
        n_samples = 100
        
        data = {
            'data': [[float(np.random.normal(0, 1)) for _ in range(5)] for _ in range(n_samples)],
            'headers': ['feature1', 'feature2', 'feature3', 'feature4', 'feature5']
        }
        
        payload = {
            'data': data,
            'method': 'umap',
            'parameters': {
                'n_components': 2,
                'n_neighbors': 15,
                'min_dist': 0.1,
                'random_state': 42
            }
        }
        
        response = requests.post(
            f"{base_url}/embedding/submit",
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            job_data = response.json()
            print("Embedding submit endpoint working")
            print(f"   Job ID: {job_data.get('job_id', 'unknown')}")
            print(f"   Status: {job_data.get('status', 'unknown')}")
            
            # Test 2: Get job status
            job_id = job_data.get('job_id')
            if job_id:
                time.sleep(2)  # Wait a bit for processing
                
                status_response = requests.get(f"{base_url}/embedding/status/{job_id}")
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    print("Embedding status endpoint working")
                    print(f"   Job status: {status_data.get('status', 'unknown')}")
                    print(f"   Progress: {status_data.get('progress', 0)}%")
                else:
                    print(f"Embedding status failed: {status_response.status_code}")
                    return False
        else:
            print(f"Embedding submit failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"Embedding test failed: {e}")
        return False
    
    return True

def test_history_endpoints():
    """Test history API endpoints."""
    base_url = "http://localhost:8000/api/v1"
    
    print("\nTesting History API Endpoints")
    print("=" * 50)
    
    try:
        response = requests.get(f"{base_url}/history/jobs")
        
        if response.status_code == 200:
            history_data = response.json()
            print("History jobs endpoint working")
            print(f"   Total jobs: {len(history_data.get('jobs', []))}")
            
            # Test getting available models
            models_response = requests.get(f"{base_url}/history/available-models")
            if models_response.status_code == 200:
                models_data = models_response.json()
                print("Available models endpoint working")
                print(f"   Available models: {len(models_data.get('models', []))}")
            else:
                print(f"Available models failed: {models_response.status_code}")
                return False
        else:
            print(f"History jobs failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"History test failed: {e}")
        return False
    
    return True

def test_anomaly_detection_endpoints():
    """Test anomaly detection API endpoints."""
    base_url = "http://localhost:8000/api/v1"
    
    print("\nTesting Anomaly Detection API Endpoints")
    print("=" * 50)
    
    try:
        # Create sample data
        np.random.seed(42)
        n_samples = 100
        
        data = {
            'data': [[float(np.random.normal(0, 1)) for _ in range(3)] for _ in range(n_samples)],
            'headers': ['feature1', 'feature2', 'feature3']
        }
        
        payload = {
            'data': data,
            'parameters': {
                'gridSize': 10,
                'expectedRatio': 0.5,
                'tolerance': 0.2
            }
        }
        
        response = requests.post(
            f"{base_url}/anomaly-detection/detect",
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            results = response.json()
            print("Anomaly detection endpoint working")
            print(f"   Anomalies detected: {results.get('anomalyCount', 0)}")
            print(f"   Grid cells analyzed: {results.get('totalCells', 0)}")
            print(f"   Anomaly percentage: {results.get('anomalyPercentage', 0):.2f}%")
        else:
            print(f"Anomaly detection failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"Anomaly detection test failed: {e}")
        return False
    
    return True

def main():
    """Run all API endpoint tests."""
    print("Starting Comprehensive API Endpoint Tests")
    print("=" * 60)
    
    # Check if server is running
    try:
        response = requests.get("http://localhost:8000/api/v1/validation/status", timeout=5)
        if response.status_code != 200:
            print("Backend server is not running or not accessible")
            print("Please start the backend server with: python main.py")
            return False
    except Exception as e:
        print("Backend server is not running")
        print("Please start the backend server with: python main.py")
        return False
    
    print("Backend server is running")
    
    # Run all tests
    tests = [
        ("Validation Endpoints", test_validation_endpoints),
        ("Embedding Endpoints", test_embedding_endpoints),
        ("History Endpoints", test_history_endpoints),
        ("Anomaly Detection Endpoints", test_anomaly_detection_endpoints)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"{test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Print summary
    print("\n" + "=" * 60)
    print("API Endpoint Test Results")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "PASSED" if result else "FAILED"
        print(f"  {test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\nAll API endpoints are working correctly!")
        return True
    else:
        print(f"\n{total - passed} tests failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    main() 