import pytest
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_app():
    """Mock FastAPI app for testing."""
    from fastapi import FastAPI
    app = FastAPI()
    
    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}
    
    return app

@pytest.fixture
def client():
    """Set up a test client for the FastAPI app."""
    from backend.main import app
    
    # Mock the task queue to avoid ZMQ issues on Windows
    with patch('backend.services.task_queue.get_task_queue_manager') as mock_queue:
        mock_instance = MagicMock()
        mock_instance.start.return_value = None
        mock_instance.stop.return_value = None
        mock_instance.running = False
        mock_queue.return_value = mock_instance
        
        with TestClient(app) as test_client:
            yield test_client

@pytest.fixture
def mock_embedding_service():
    """Mock embedding service for testing."""
    with patch('backend.services.embedding.EmbeddingService') as mock_service:
        mock_instance = MagicMock()
        mock_service.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def mock_validation_service():
    """Mock validation service for testing."""
    with patch('backend.services.validation_service.validation_service') as mock_service:
        yield mock_service

@pytest.fixture
def mock_anomaly_detection_service():
    """Mock anomaly detection service for testing."""
    with patch('backend.services.anomaly_detection_service.RatioBasedGridAnomalyDetectionService') as mock_service:
        mock_instance = MagicMock()
        mock_service.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def mock_gpu_monitoring_service():
    """Mock GPU monitoring service for testing."""
    with patch('backend.services.gpu_monitoring.GPUMonitoringService') as mock_service:
        mock_instance = MagicMock()
        mock_service.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def mock_job_service():
    """Mock job service for testing."""
    with patch('backend.services.job_service.JobService') as mock_service:
        mock_instance = MagicMock()
        mock_service.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def mock_task_queue():
    """Mock task queue for testing."""
    with patch('backend.services.task_queue.get_task_queue_manager') as mock_queue:
        mock_instance = MagicMock()
        mock_queue.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def sample_real_data():
    """Sample real data for testing."""
    return {
        'data': [
            [1.0, 2.0, 3.0],
            [4.0, 5.0, 6.0],
            [7.0, 8.0, 9.0]
        ],
        'headers': ['x', 'y', 'z']
    }

@pytest.fixture
def sample_synthetic_data():
    """Sample synthetic data for testing."""
    return {
        'data': [
            [1.1, 2.1, 3.1],
            [4.1, 5.1, 6.1],
            [7.1, 8.1, 9.1]
        ],
        'headers': ['x', 'y', 'z']
    }

@pytest.fixture
def sample_embedding_data():
    """Sample embedding data for testing."""
    return {
        'real': [[1.0, 1.0], [2.0, 2.0], [3.0, 3.0]],
        'synthetic': [[1.1, 1.1], [2.1, 2.1], [3.1, 3.1]]
    }

@pytest.fixture
def sample_anomaly_results():
    """Sample anomaly detection results for testing."""
    # Mock anomaly detection results for testing
    mock_anomaly_results = {
        'status': 'success',
        'statistics': {
            'total_real': 100,
            'total_synthetic': 100,
            'real_anomalies': 5,
            'synthetic_anomalies': 3,
            'real_anomaly_rate': 0.05,
            'synthetic_anomaly_rate': 0.03,
            'x_grid_size': 10,
            'y_grid_size': 10,
            'total_anomaly_cells': 8,
            'positive_tests_conducted': 15,
            'negative_tests_conducted': 12,
            'positive_significant': 5,
            'negative_significant': 3,
            'fdr_alpha': 0.05,
            'global_proportion': 0.5
        },
        'grid_info': {
            'x_bins': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            'y_bins': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            'x_grid_size': 10,
            'y_grid_size': 10,
            'bounds': {
                'x_min': 0,
                'x_max': 10,
                'y_min': 0,
                'y_max': 10
            }
        },
        'cell_anomalies': [
            {
                'cell_x': 0,
                'cell_y': 0,
                'real_count': 8,
                'synthetic_count': 2,
                'total_count': 10,
                'cell_proportion': 0.8,
                'global_proportion': 0.5,
                'proportion_diff': 0.3,
                'p_value': 0.001,
                'p_value_adjusted': 0.005,
                'is_significant': True,
                'test_type': 'real_overpopulation',
                'color': '#FF0000'
            }
        ],
        'positive_tests': [
            {
                'cell_x': 0,
                'cell_y': 0,
                'real_count': 8,
                'synthetic_count': 2,
                'total_count': 10,
                'cell_proportion': 0.8,
                'global_proportion': 0.5,
                'proportion_diff': 0.3,
                'p_value': 0.001,
                'p_value_adjusted': 0.005,
                'is_significant': True,
                'test_type': 'real_overpopulation',
                'color': '#FF0000'
            }
        ],
        'negative_tests': [
            {
                'cell_x': 1,
                'cell_y': 1,
                'real_count': 2,
                'synthetic_count': 8,
                'total_count': 10,
                'cell_proportion': 0.2,
                'global_proportion': 0.5,
                'proportion_diff': -0.3,
                'p_value': 0.002,
                'p_value_adjusted': 0.008,
                'is_significant': True,
                'test_type': 'synthetic_overpopulation',
                'color': '#0000FF'
            }
        ],
        'proportion_thresholds': {
            'global_proportion': 0.5,
            'fdr_alpha': 0.05
        }
    } 