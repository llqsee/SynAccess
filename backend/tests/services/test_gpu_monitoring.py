import pytest
from unittest.mock import patch, MagicMock
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from backend.services.gpu_monitoring import GPUMonitoringService

@pytest.fixture
def gpu_monitor():
    """Create GPU monitoring service instance."""
    return GPUMonitoringService()

def test_gpu_monitoring_initialization(gpu_monitor):
    """Test GPU monitoring service initialization."""
    assert hasattr(gpu_monitor, 'initialized')
    assert hasattr(gpu_monitor, 'gpu_count')
    assert hasattr(gpu_monitor, 'gpu_handles')

def test_get_gpu_status(gpu_monitor):
    """Test getting GPU status."""
    status = gpu_monitor.get_gpu_status()
    assert isinstance(status, dict)
    assert "gpu_available" in status
    assert "gpu_monitoring_available" in status
    assert "gpu_count" in status
    assert "monitoring_initialized" in status

def test_get_gpu_info_not_initialized(gpu_monitor):
    """Test getting GPU info when not initialized."""
    gpu_monitor.initialized = False
    info = gpu_monitor.get_gpu_info(0)
    assert info is None

def test_get_gpu_info_invalid_index(gpu_monitor):
    """Test getting GPU info with invalid index."""
    gpu_monitor.initialized = True
    gpu_monitor.gpu_count = 1
    info = gpu_monitor.get_gpu_info(1)  # Index 1 when only 1 GPU
    assert info is None

def test_get_all_gpu_info_not_initialized(gpu_monitor):
    """Test getting all GPU info when not initialized."""
    gpu_monitor.initialized = False
    all_info = gpu_monitor.get_all_gpu_info()
    assert isinstance(all_info, list)
    assert len(all_info) == 0

def test_get_gpu_usage_summary_not_initialized(gpu_monitor):
    """Test getting GPU usage when not initialized."""
    gpu_monitor.initialized = False
    usage = gpu_monitor.get_gpu_usage_summary()
    assert isinstance(usage, dict)
    assert usage["error"] == "GPU monitoring not initialized"

def test_check_gpu_availability(gpu_monitor):
    """Test checking GPU availability."""
    availability = gpu_monitor.check_gpu_availability()
    assert isinstance(availability, dict)
    assert "cupy_available" in availability
    assert "gpu_memory_available" in availability
    assert "gpu_ready_for_computation" in availability

def test_gpu_monitoring_cleanup(gpu_monitor):
    """Test GPU monitoring cleanup."""
    # This should not raise any exceptions
    del gpu_monitor

def test_get_gpu_info_with_mock_data(gpu_monitor):
    """Test getting GPU info with mock data."""
    # Mock the GPU info directly
    mock_info = {
        "index": 0,
        "name": "NVIDIA GeForce RTX 3080",
        "memory_total_mb": 10240,
        "memory_used_mb": 2048,
        "gpu_utilization_percent": 45,
        "temperature_celsius": 65,
        "memory_utilization_percent": 20,
        "power_usage_watts": 200
    }
    
    gpu_monitor.initialized = True
    gpu_monitor.gpu_count = 1
    
    with patch.object(gpu_monitor, 'get_gpu_info', return_value=mock_info):
        info = gpu_monitor.get_gpu_info(0)
        assert info is not None
        assert info["index"] == 0
        assert "name" in info

def test_get_all_gpu_info_with_mock_data(gpu_monitor):
    """Test getting all GPU info with mock data."""
    # Mock GPU info
    mock_info = {
        "index": 0,
        "name": "NVIDIA GeForce RTX 3080",
        "memory_total_mb": 10240,
        "memory_used_mb": 2048,
        "gpu_utilization_percent": 45
    }
    
    gpu_monitor.initialized = True
    gpu_monitor.gpu_count = 1
    
    with patch.object(gpu_monitor, 'get_gpu_info', return_value=mock_info):
        all_info = gpu_monitor.get_all_gpu_info()
        assert isinstance(all_info, list)
        assert len(all_info) == 1
        assert all_info[0]["index"] == 0

def test_get_gpu_usage_summary_with_mock_data(gpu_monitor):
    """Test getting GPU usage summary with mock data."""
    # Mock GPU info
    mock_info = {
        "index": 0,
        "name": "NVIDIA GeForce RTX 3080",
        "memory_total_mb": 10240,
        "memory_used_mb": 2048,
        "gpu_utilization_percent": 45,
        "temperature_celsius": 65,
        "memory_utilization_percent": 20,
        "power_usage_watts": 200
    }
    
    gpu_monitor.initialized = True
    gpu_monitor.gpu_count = 1
    
    with patch.object(gpu_monitor, 'get_all_gpu_info', return_value=[mock_info]):
        usage = gpu_monitor.get_gpu_usage_summary()
        assert isinstance(usage, dict)
        assert "gpu_count" in usage
        assert "average_gpu_utilization_percent" in usage
        assert "average_memory_utilization_percent" in usage 