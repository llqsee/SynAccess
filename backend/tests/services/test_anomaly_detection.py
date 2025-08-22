import pytest
import numpy as np
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from backend.services.anomaly_detection_service import HistogramBasedAnomalyDetectionService

class TestHistogramBasedAnomalyDetectionService:
    def setup_method(self):
        """Set up test data for each test method."""
        self.service = HistogramBasedAnomalyDetectionService()
        
        # Create test data with clear separation
        np.random.seed(42)
        self.real_data = np.random.normal(0, 1, (100, 2)).tolist()
        self.synthetic_data = np.random.normal(2, 1, (100, 2)).tolist()
    
    def test_histogram_based_detection(self):
        """Test histogram-based binomial proportion detection."""
        result = self.service.detect_anomalies(
            real_data=self.real_data,
            synthetic_data=self.synthetic_data,
            x_bins=10,
            y_bins=10,
            fdr_alpha=0.05
        )
        
        assert result["status"] == "success"
        assert "statistics" in result
        assert "grid_info" in result
        assert "positive_tests" in result
        assert "negative_tests" in result
        assert "proportion_thresholds" in result
    
    def test_binomial_proportion_tests(self):
        """Test binomial proportion-based anomaly detection."""
        # Train the service first
        self.service.detect_anomalies(
            real_data=self.real_data,
            synthetic_data=self.synthetic_data,
            x_bins=5,
            y_bins=5,
            fdr_alpha=0.05
        )
        
        # Test with the same data
        result = self.service.detect_anomalies(
            real_data=self.real_data,
            synthetic_data=self.synthetic_data,
            x_bins=5,
            y_bins=5,
            fdr_alpha=0.05
        )
        
        assert result["status"] == "success"
        stats = result["statistics"]
        assert "total_real" in stats
        assert "total_synthetic" in stats
        assert "global_proportion" in stats
        assert "positive_tests_conducted" in stats
        assert "negative_tests_conducted" in stats
        assert "positive_significant" in stats
        assert "negative_significant" in stats
    
    def test_csv_generation(self):
        """Test CSV generation for histogram-based detection."""
        # Train the service first
        result = self.service.detect_anomalies(
            real_data=self.real_data,
            synthetic_data=self.synthetic_data,
            x_bins=5,
            y_bins=5,
            fdr_alpha=0.05
        )
        
        # Generate CSV
        csv_content = self.service.generate_anomaly_csv(result)
        
        assert "# Histogram-Based Anomaly Detection Results" in csv_content
        assert "cell_x,cell_y,real_count,synthetic_count,total_count,cell_proportion,global_proportion,proportion_diff,p_value,p_value_adjusted,is_significant,test_type,color" in csv_content
        assert "Global Proportion:" in csv_content
        assert "FDR Alpha Level:" in csv_content
    
    def test_invalid_inputs(self):
        """Test handling of invalid inputs."""
        # Test with empty real data
        result = self.service.detect_anomalies([], self.synthetic_data)
        assert result["status"] == "error"
        
        # Test with empty synthetic data
        result = self.service.detect_anomalies(self.real_data, [])
        assert result["status"] == "error"
        
        # Test with insufficient data (should still work with 2 points)
        result = self.service.detect_anomalies(self.real_data[:2], self.synthetic_data[:2])
        assert result["status"] == "success"
    
    def test_grid_creation(self):
        """Test histogram-based grid creation."""
        result = self.service.detect_anomalies(
            real_data=self.real_data,
            synthetic_data=self.synthetic_data,
            x_bins=8,
            y_bins=8,
            fdr_alpha=0.05
        )
        
        grid_info = result["grid_info"]
        assert "x_bins" in grid_info
        assert "y_bins" in grid_info
        assert "x_grid_size" in grid_info
        assert "y_grid_size" in grid_info
        assert "bounds" in grid_info
        assert len(grid_info["x_bins"]) == 9  # n+1 edges for n bins
        assert len(grid_info["y_bins"]) == 9
    
    def test_fdr_correction(self):
        """Test that FDR correction is applied correctly."""
        result = self.service.detect_anomalies(
            real_data=self.real_data,
            synthetic_data=self.synthetic_data,
            x_bins=5,
            y_bins=5,
            fdr_alpha=0.05
        )
        
        # Check that FDR correction is applied
        positive_tests = result["positive_tests"]
        negative_tests = result["negative_tests"]
        
        for test in positive_tests:
            assert "p_value_adjusted" in test
            assert "is_significant" in test
            assert "fdr_alpha" in test
        
        for test in negative_tests:
            assert "p_value_adjusted" in test
            assert "is_significant" in test
            assert "fdr_alpha" in test
    
    def test_test_type_classification(self):
        """Test that test types are properly classified."""
        result = self.service.detect_anomalies(
            real_data=self.real_data,
            synthetic_data=self.synthetic_data,
            x_bins=5,
            y_bins=5,
            fdr_alpha=0.05
        )
        
        positive_tests = result["positive_tests"]
        negative_tests = result["negative_tests"]
        
        for test in positive_tests:
            assert test["test_type"] == "real_overpopulation"
        
        for test in negative_tests:
            assert test["test_type"] == "synthetic_overpopulation"
    
    def test_proportion_calculation(self):
        """Test that proportions are calculated correctly."""
        result = self.service.detect_anomalies(
            real_data=self.real_data,
            synthetic_data=self.synthetic_data,
            x_bins=5,
            y_bins=5,
            fdr_alpha=0.05
        )
        
        stats = result["statistics"]
        global_proportion = stats["global_proportion"]
        
        # Global proportion should be real_count / (real_count + synthetic_count)
        expected_proportion = len(self.real_data) / (len(self.real_data) + len(self.synthetic_data))
        assert abs(global_proportion - expected_proportion) < 1e-10
    
    def test_color_assignment(self):
        """Test that colors are assigned based on test type."""
        result = self.service.detect_anomalies(
            real_data=self.real_data,
            synthetic_data=self.synthetic_data,
            x_bins=5,
            y_bins=5,
            fdr_alpha=0.05
        )
        
        positive_tests = result["positive_tests"]
        negative_tests = result["negative_tests"]
        
        # Check that significant tests have colors assigned
        for test in positive_tests:
            if test.get("is_significant", False):
                assert "color" in test
                assert test["color"] == "#FF0000"  # Red for real overpopulation
        
        for test in negative_tests:
            if test.get("is_significant", False):
                assert "color" in test
                assert test["color"] == "#0000FF"  # Blue for synthetic overpopulation 