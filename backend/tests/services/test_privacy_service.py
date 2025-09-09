import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock
from backend.services.privacy_service import PrivacyTestingService


class TestPrivacyTestingService:
    """Test cases for PrivacyTestingService."""

    @pytest.fixture
    def privacy_service(self):
        """Create a PrivacyTestingService instance."""
        return PrivacyTestingService()

    @pytest.fixture
    def sample_data(self):
        """Create sample real and synthetic datasets."""
        np.random.seed(42)
        real_data = pd.DataFrame({
            'age': np.random.normal(35, 10, 1000),
            'income': np.random.normal(50000, 15000, 1000),
            'education': np.random.choice(['High School', 'Bachelor', 'Master', 'PhD'], 1000),
            'gender': np.random.choice(['Male', 'Female'], 1000)
        })
        
        # Create synthetic data with some differences
        synth_data = pd.DataFrame({
            'age': np.random.normal(36, 11, 1000),
            'income': np.random.normal(52000, 16000, 1000),
            'education': np.random.choice(['High School', 'Bachelor', 'Master', 'PhD'], 1000, p=[0.3, 0.4, 0.2, 0.1]),
            'gender': np.random.choice(['Male', 'Female'], 1000)
        })
        
        return real_data, synth_data

    def test_privacy_service_initialization(self, privacy_service):
        """Test PrivacyTestingService initialization."""
        assert privacy_service is not None
        assert hasattr(privacy_service, 'compute_privacy_tests')

    def test_compute_privacy_tests_basic(self, privacy_service, sample_data):
        """Test basic privacy tests computation (structure only)."""
        real_df, synth_df = sample_data
        result = privacy_service.compute_privacy_tests(real_df, synth_df)
        assert 'tests' in result
        assert 'summary' in result
        assert isinstance(result['tests'], list)
        assert isinstance(result['summary'], dict)
        assert 'total' in result['summary']
        assert 'passed' in result['summary']
        assert 'failed' in result['summary']
        assert 'errors' in result['summary']

    # SDMetrics tests removed; fast privacy tests are now used

    # SDV privacy evaluator is no longer used; no tests required

    def test_fast_privacy_outputs(self, privacy_service, sample_data):
        """Test that fast privacy tests return expected keys."""
        real_df, synth_df = sample_data
        result = privacy_service.compute_privacy_tests(real_df, synth_df)
        assert 'tests' in result and isinstance(result['tests'], list)
        types = {t.get('type') for t in result['tests']}
        assert any(t in types for t in ['NNDR', 'NN_Distance', 'ExactMatchRate'])

    # Diagnostic score path removed; error handling covered by compute_privacy_tests

    def test_privacy_level_assessment(self, privacy_service):
        """Test privacy level assessment logic."""
        # Test excellent privacy
        assert privacy_service._assess_privacy_level(0.95) == 'EXCELLENT'
        assert privacy_service._assess_privacy_level(0.85) == 'EXCELLENT'
        
        # Test good privacy
        assert privacy_service._assess_privacy_level(0.75) == 'GOOD'
        assert privacy_service._assess_privacy_level(0.65) == 'GOOD'
        
        # Test fair privacy
        assert privacy_service._assess_privacy_level(0.55) == 'FAIR'
        assert privacy_service._assess_privacy_level(0.45) == 'FAIR'
        
        # Test poor privacy
        assert privacy_service._assess_privacy_level(0.35) == 'POOR'
        assert privacy_service._assess_privacy_level(0.15) == 'POOR'

    def test_result_assessment(self, privacy_service):
        """Test result assessment logic."""
        # Test pass result
        assert privacy_service._assess_result('EXCELLENT') == 'PASS'
        assert privacy_service._assess_result('GOOD') == 'PASS'
        
        # Test fail result
        assert privacy_service._assess_result('FAIR') == 'FAIL'
        assert privacy_service._assess_result('POOR') == 'FAIL'

    def test_empty_data_handling(self, privacy_service):
        """Test handling of empty datasets."""
        empty_df = pd.DataFrame()
        
        result = privacy_service.compute_privacy_tests(empty_df, empty_df)
        
        assert 'tests' in result
        assert 'summary' in result
        assert result['summary']['total'] == 0
        assert result['summary']['errors'] == 0

    def test_insufficient_data_handling(self, privacy_service):
        """Test handling of very small datasets with fast privacy checks."""
        # Create very small datasets
        small_real = pd.DataFrame({'col1': [1, 2], 'col2': [3, 4]})
        small_synth = pd.DataFrame({'col1': [1.1, 2.1], 'col2': [3.1, 4.1]})

        result = privacy_service.compute_privacy_tests(small_real, small_synth)
        assert 'tests' in result and isinstance(result['tests'], list)
        assert 'summary' in result and isinstance(result['summary'], dict)
        assert 'total' in result['summary']
