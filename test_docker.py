#!/usr/bin/env python3
"""
Docker Test Script for MAVIS
Tests Docker build and basic functionality
"""

import subprocess
import sys
import time
import requests
import os
from pathlib import Path

def run_command(command, check=True, capture_output=True):
    """Run a shell command and return the result."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=check,
            capture_output=capture_output,
            text=True
        )
        return result
    except subprocess.CalledProcessError as e:
        print(f"❌ Command failed: {command}")
        print(f"Error: {e}")
        if not capture_output:
            print(f"Output: {e.stdout}")
            print(f"Error: {e.stderr}")
        return e

def test_docker_build():
    """Test Docker build process."""
    print("🔨 Testing Docker build...")
    
    # Test CPU build
    print("  Testing CPU build...")
    result = run_command("docker build --build-arg ENV_FILE=environment.yml -t mavis:test-cpu .")
    if result.returncode == 0:
        print("  ✅ CPU build successful")
    else:
        print("  ❌ CPU build failed")
        return False
    
    # Test GPU build (if environment supports it)
    print("  Testing GPU build...")
    result = run_command("docker build --build-arg ENV_FILE=environment-gpu.yml --build-arg GPU_ENABLED=true --build-arg CONDA_ENV_NAME=mavis-gpu -t mavis:test-gpu .")
    if result.returncode == 0:
        print("  ✅ GPU build successful")
    else:
        print("  ⚠️  GPU build failed (this is normal if CUDA is not available)")
    
    return True

def test_docker_compose():
    """Test Docker Compose configuration."""
    print("🐳 Testing Docker Compose...")
    
    # Test compose configuration
    result = run_command("docker compose config")
    if result.returncode == 0:
        print("  ✅ Docker Compose configuration is valid")
    else:
        print("  ❌ Docker Compose configuration is invalid")
        return False
    
    return True

def test_container_health():
    """Test container health check."""
    print("🏥 Testing container health...")
    
    # Start container
    print("  Starting test container...")
    run_command("docker run -d --name mavis-test -p 8001:8000 mavis:test-cpu", check=False)
    
    # Wait for container to start
    time.sleep(10)
    
    # Check if container is running
    result = run_command("docker ps --filter name=mavis-test --format '{{.Status}}'")
    if "Up" in result.stdout:
        print("  ✅ Container is running")
    else:
        print("  ❌ Container failed to start")
        return False
    
    # Test health endpoint
    try:
        response = requests.get("http://localhost:8001/api/v1/health", timeout=10)
        if response.status_code == 200:
            print("  ✅ Health endpoint is responding")
        else:
            print(f"  ❌ Health endpoint returned {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Health endpoint test failed: {e}")
        return False
    
    # Cleanup
    run_command("docker stop mavis-test", check=False)
    run_command("docker rm mavis-test", check=False)
    
    return True

def test_gpu_support():
    """Test GPU support if available."""
    print("🚀 Testing GPU support...")
    
    # Check if nvidia-smi is available
    result = run_command("nvidia-smi", check=False)
    if result.returncode == 0:
        print("  ✅ NVIDIA GPU detected")
        
        # Test GPU container
        result = run_command("docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu20.04 nvidia-smi", check=False)
        if result.returncode == 0:
            print("  ✅ Docker GPU support is working")
        else:
            print("  ❌ Docker GPU support is not working")
            return False
    else:
        print("  ⚠️  No NVIDIA GPU detected (this is normal)")
    
    return True

def cleanup():
    """Clean up test images."""
    print("🧹 Cleaning up test images...")
    run_command("docker rmi mavis:test-cpu", check=False)
    run_command("docker rmi mavis:test-gpu", check=False)
    print("  ✅ Cleanup complete")

def main():
    """Main test function."""
    print("🐳 MAVIS Docker Test Suite")
    print("=" * 50)
    
    # Check if Docker is available
    result = run_command("docker --version", check=False)
    if result.returncode != 0:
        print("❌ Docker is not available. Please install Docker first.")
        sys.exit(1)
    
    print(f"✅ Docker version: {result.stdout.strip()}")
    
    # Check if Docker Compose is available
    result = run_command("docker compose version", check=False)
    if result.returncode != 0:
        print("❌ Docker Compose is not available. Please install Docker Compose first.")
        sys.exit(1)
    
    print(f"✅ Docker Compose version: {result.stdout.strip()}")
    
    # Run tests
    tests = [
        ("Docker Build", test_docker_build),
        ("Docker Compose", test_docker_compose),
        ("Container Health", test_container_health),
        ("GPU Support", test_gpu_support),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n📋 Running {test_name} test...")
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} test passed")
            else:
                print(f"❌ {test_name} test failed")
        except Exception as e:
            print(f"❌ {test_name} test failed with exception: {e}")
    
    # Cleanup
    cleanup()
    
    # Summary
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Docker setup is working correctly.")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Please check the output above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
