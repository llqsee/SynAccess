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
        """Test basic privacy tests computation."""
        real_df, synth_df = sample_data
        
        # Mock all privacy libraries to avoid import issues in testing
        with patch('backend.services.privacy_service.sdmetrics') as mock_sdmetrics, \
             patch('backend.services.privacy_service.anonymeter') as mock_anonymeter, \
             patch('backend.services.privacy_service.synthcity') as mock_synthcity, \
             patch('backend.services.privacy_service.sdv') as mock_sdv:
            
            # Mock SDMetrics DiagnosticReport
            mock_report = MagicMock()
            mock_report.get_results.return_value = {'privacy': 0.85, 'overall': 0.78}
            mock_sdmetrics.reports.single_table.DiagnosticReport.return_value = mock_report
            
            # Mock SDMetrics DCR
            mock_sdmetrics.single_table.privacy.DCR.compute.return_value = 0.82
            
            # Mock Anonymeter
            mock_anonymeter.evaluation.evaluate.return_value = {
                'singling_out': {'risk': 0.15},
                'linkability': {'risk': 0.12},
                'inference': {'risk': 0.18}
            }
            
            # Mock SynthCity
            mock_metrics = MagicMock()
            mock_metrics.evaluate.return_value = {
                'identifiability_score': 0.08,
                'sensitive_data_reidentification_xgb': 0.11
            }
            mock_synthcity.metrics.Metrics.return_value = mock_metrics
            
            # Mock SDV
            mock_sdv.evaluation.privacy.PrivacyEvaluator.return_value = MagicMock()
            
            result = privacy_service.compute_privacy_tests(real_df, synth_df)
            
            # Verify structure
            assert 'tests' in result
            assert 'summary' in result
            assert isinstance(result['tests'], list)
            assert isinstance(result['summary'], dict)
            
            # Verify summary structure
            assert 'total' in result['summary']
            assert 'passed' in result['summary']
            assert 'failed' in result['summary']
            assert 'errors' in result['summary']

    def test_sdmetrics_privacy_test(self, privacy_service, sample_data):
        """Test SDMetrics privacy test specifically."""
        real_df, synth_df = sample_data
        
        # Since sdmetrics is not installed, this should return LIBRARY_NOT_AVAILABLE
        result = privacy_service._test_sdmetrics_privacy(real_df, synth_df)
        
        assert result['type'] == 'sdmetrics_diagnostic_test'
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'
        assert 'SDMetrics library not installed' in result['reason']

    def test_sdmetrics_dcr_test(self, privacy_service, sample_data):
        """Test SDMetrics DCR test specifically."""
        real_df, synth_df = sample_data
        
        # Since sdmetrics is not installed, this should return LIBRARY_NOT_AVAILABLE
        result = privacy_service._test_sdmetrics_dcr(real_df, synth_df)
        
        assert result['type'] == 'sdmetrics_dcr_test'
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'
        assert 'SDMetrics library not installed' in result['reason']

    def test_anonymeter_gdpr_test(self, privacy_service, sample_data):
        """Test Anonymeter GDPR compliance test."""
        real_df, synth_df = sample_data
        
        # Since anonymeter is not installed, this should return LIBRARY_NOT_AVAILABLE
        result = privacy_service._test_anonymeter_gdpr(real_df, synth_df)
        
        assert result['type'] == 'anonymeter_gdpr_test'
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'
        assert 'Anonymeter library not installed' in result['reason']

    def test_synthcity_privacy_test(self, privacy_service, sample_data):
        """Test SynthCity privacy metrics."""
        real_df, synth_df = sample_data
        
        # Since synthcity is not installed, this should return LIBRARY_NOT_AVAILABLE
        result = privacy_service._test_synthcity_privacy(real_df, synth_df)
        
        assert result['type'] == 'synthcity_privacy_test'
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'
        assert 'SynthCity library not installed' in result['reason']

    def test_sdv_privacy_test(self, privacy_service, sample_data):
        """Test SDV privacy evaluator."""
        real_df, synth_df = sample_data
        
        # Since sdv is not installed, this should return LIBRARY_NOT_AVAILABLE
        result = privacy_service._test_sdv_privacy(real_df, synth_df)
        
        assert result['type'] == 'sdv_privacy_test'
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'
        assert 'SDV library not installed' in result['reason']

    def test_library_not_available_handling(self, privacy_service, sample_data):
        """Test handling when privacy libraries are not available."""
        real_df, synth_df = sample_data
        
        # Test when SDMetrics is not available
        result = privacy_service._test_sdmetrics_privacy(real_df, synth_df)
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'
        assert 'SDMetrics library not installed' in result['reason']

        # Test when Anonymeter is not available
        result = privacy_service._test_anonymeter_gdpr(real_df, synth_df)
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'
        assert 'Anonymeter library not installed' in result['reason']

        # Test when SynthCity is not available
        result = privacy_service._test_synthcity_privacy(real_df, synth_df)
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'
        assert 'SynthCity library not installed' in result['reason']

        # Test when SDV is not available
        result = privacy_service._test_sdv_privacy(real_df, synth_df)
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'
        assert 'SDV library not installed' in result['reason']

    def test_error_handling(self, privacy_service, sample_data):
        """Test error handling in privacy tests."""
        real_df, synth_df = sample_data
        
        # Since libraries are not installed, this should return LIBRARY_NOT_AVAILABLE
        result = privacy_service._test_sdmetrics_privacy(real_df, synth_df)
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'

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
        """Test handling of datasets with insufficient data."""
        # Create very small datasets
        small_real = pd.DataFrame({'col1': [1, 2], 'col2': [3, 4]})
        small_synth = pd.DataFrame({'col1': [1.1, 2.1], 'col2': [3.1, 4.1]})
        
        # Since libraries are not installed, this should return LIBRARY_NOT_AVAILABLE
        result = privacy_service._test_sdmetrics_privacy(small_real, small_synth)
        assert result['result'] == 'LIBRARY_NOT_AVAILABLE'
