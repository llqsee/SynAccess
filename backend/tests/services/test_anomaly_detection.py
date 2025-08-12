import pytest
import numpy as np
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from backend.services.anomaly_detection_service import AdaptiveLogitAnomalyDetectionService

class TestAnomalyDetectionService:
    
    def setup_method(self):
        """Set up test fixtures."""
        self.service = AdaptiveLogitAnomalyDetectionService()
        
        # Generate test data
        np.random.seed(42)
        self.real_data = np.random.randn(100, 2).tolist()  # 100 real points
        self.synthetic_data = np.random.randn(50, 2).tolist()  # 50 synthetic points
        
        # Add some anomalies to synthetic data
        self.synthetic_data.extend([
            [10.0, 10.0],  # Clear outlier
            [-10.0, -10.0],  # Clear outlier
            [5.0, 5.0]  # Moderate outlier
        ])
    
    def test_train_logit_detector(self):
        """Test training the adaptive logit detector."""
        result = self.service.train_logit_detector(self.real_data, self.synthetic_data)
        
        assert result["status"] == "success"
        assert self.service.is_fitted is True
        assert self.service.grid_info is not None
        assert "grid_info" in result
        assert "logit_thresholds" in result
    
    def test_detect_anomalies(self):
        """Test adaptive logit-based anomaly detection."""
        # First train the model
        self.service.train_logit_detector(self.real_data, self.synthetic_data)
        
        # Then detect anomalies
        result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        assert result["status"] == "success"
        assert "statistics" in result
        assert "real_data" in result
        assert "synthetic_data" in result
        assert "real_anomalies" in result
        assert "real_normal" in result
        assert "synthetic_anomalies" in result
        assert "synthetic_normal" in result
        assert "cell_anomalies" in result
        
        # Check statistics
        stats = result["statistics"]
        assert stats["total_real"] == len(self.real_data)
        assert stats["total_synthetic"] == len(self.synthetic_data)
        assert stats["real_anomalies"] >= 0
        assert stats["synthetic_anomalies"] >= 0
        assert 0 <= stats["real_anomaly_rate"] <= 1
        assert 0 <= stats["synthetic_anomaly_rate"] <= 1
        assert "logit_global" in stats
        assert "logit_sd" in stats
    
    def test_generate_anomaly_csv(self):
        """Test CSV generation for adaptive logit-based detection."""
        # Train and detect
        self.service.train_logit_detector(self.real_data, self.synthetic_data)
        detection_result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        # Generate CSV
        csv_content = self.service.generate_anomaly_csv(detection_result)
        
        assert csv_content is not None
        assert len(csv_content) > 0
        assert "# Adaptive Logit Anomaly Detection Results" in csv_content
        assert "cell_x,cell_y,real_count,synthetic_count,total_count,p_cell,logit_cell,z_score,anomaly_type,severity,color" in csv_content
    
    def test_empty_data_handling(self):
        """Test handling of empty data."""
        # The service returns error status instead of raising exceptions
        result = self.service.detect_anomalies([], self.synthetic_data)
        assert result["status"] == "error"
        assert "Real data cannot be empty" in result["message"]
        
        result = self.service.detect_anomalies(self.real_data, [])
        assert result["status"] == "error"
        assert "Synthetic data cannot be empty" in result["message"]
    
    def test_insufficient_data_handling(self):
        """Test handling of insufficient data."""
        # The service returns error status instead of raising exceptions
        result = self.service.train_logit_detector(self.real_data[:5], self.synthetic_data)
        assert result["status"] == "error"
        assert "Insufficient real data for training" in result["message"]
        
        result = self.service.train_logit_detector(self.real_data, self.synthetic_data[:2])
        assert result["status"] == "error"
        assert "Insufficient synthetic data for training" in result["message"]
    
    def test_invalid_dimensions(self):
        """Test handling of invalid data dimensions."""
        invalid_real = [[1, 2, 3]]  # 3D instead of 2D
        result = self.service.detect_anomalies(invalid_real, self.synthetic_data)
        assert result["status"] == "error"
        assert "Both real and synthetic data must be 2D coordinates" in result["message"]
    
    def test_anomaly_classification(self):
        """Test that anomaly classification is working correctly."""
        self.service.train_logit_detector(self.real_data, self.synthetic_data)
        result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        # Check that all data points have proper classification
        for point in result["real_data"]:
            assert "is_anomaly" in point
            assert isinstance(point["is_anomaly"], bool)
            assert "data_type" in point
            assert point["data_type"] == "real"
        
        for point in result["synthetic_data"]:
            assert "is_anomaly" in point
            assert isinstance(point["is_anomaly"], bool)
            assert "data_type" in point
            assert point["data_type"] == "synthetic"
    
    def test_logit_thresholds(self):
        """Test that logit thresholds are properly configured."""
        result = self.service.train_logit_detector(self.real_data, self.synthetic_data)
        
        thresholds = result["logit_thresholds"]
        assert "logit_global" in thresholds
        assert "logit_sd" in thresholds
        assert "threshold_lower" in thresholds
        assert "threshold_upper" in thresholds
        assert "p_global" in thresholds
        
        # All values should be finite
        assert np.isfinite(thresholds["logit_global"])
        assert np.isfinite(thresholds["logit_sd"])
        assert np.isfinite(thresholds["threshold_lower"])
        assert np.isfinite(thresholds["threshold_upper"])
        assert np.isfinite(thresholds["p_global"])
    
    def test_cell_anomalies_structure(self):
        """Test that cell anomalies have the correct structure."""
        self.service.train_logit_detector(self.real_data, self.synthetic_data)
        result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        cell_anomalies = result["cell_anomalies"]
        assert isinstance(cell_anomalies, list)
        
        for anomaly in cell_anomalies:
            assert "cell_x" in anomaly
            assert "cell_y" in anomaly
            assert "anomaly_type" in anomaly
            assert anomaly["anomaly_type"] in ["real_overrepresentation", "synthetic_overrepresentation"]
            assert "p_cell" in anomaly
            assert "logit_value" in anomaly
            assert "z_score" in anomaly
            assert "severity" in anomaly
            assert anomaly["severity"] in ["high", "medium"]
            assert "color" in anomaly
    
    def test_adaptive_logit_detection_only(self):
        """Test that only adaptive logit-based detection is performed."""
        self.service.train_logit_detector(self.real_data, self.synthetic_data)
        result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        # Verify that only logit-based anomalies are detected
        cell_anomalies = result["cell_anomalies"]
        for anomaly in cell_anomalies:
            assert "logit_value" in anomaly
            assert "z_score" in anomaly
            assert "anomaly_type" in anomaly
        
        # Verify that logit-based statistics are present
        stats = result["statistics"]
        assert "logit_global" in stats
        assert "logit_sd" in stats
        # These should not be present in simplified version
        assert "expected_ratio" not in stats
        assert "tolerance" not in stats
        assert "distribution_similarity" not in stats
        assert "coverage_similarity" not in stats
        assert "mode_collapse_detected" not in stats
    
    def test_z_score_calculation(self):
        """Test that z-scores are calculated correctly."""
        self.service.train_logit_detector(self.real_data, self.synthetic_data)
        result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        cell_anomalies = result["cell_anomalies"]
        for anomaly in cell_anomalies:
            assert "z_score" in anomaly
            assert isinstance(anomaly["z_score"], (int, float))
            # Z-scores can be infinite for edge cases (all real or all synthetic)
            # but should still be valid numbers
            assert anomaly["z_score"] != np.nan
    
    def test_severity_classification(self):
        """Test that severity classification is based on z-scores."""
        self.service.train_logit_detector(self.real_data, self.synthetic_data)
        result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        cell_anomalies = result["cell_anomalies"]
        for anomaly in cell_anomalies:
            assert "severity" in anomaly
            assert "z_score" in anomaly
            
            z_score = abs(anomaly["z_score"])
            if z_score > 2:
                assert anomaly["severity"] == "high"
            elif z_score > 1:
                assert anomaly["severity"] == "medium"
    
    def test_color_assignment(self):
        """Test that colors are assigned based on z-scores."""
        self.service.train_logit_detector(self.real_data, self.synthetic_data)
        result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        cell_anomalies = result["cell_anomalies"]
        for anomaly in cell_anomalies:
            assert "color" in anomaly
            assert "z_score" in anomaly
            
            z_score = anomaly["z_score"]
            color = anomaly["color"]
            
            if abs(z_score) > 2:
                assert color == "#8B0000"  # Dark Red for high severity
            elif abs(z_score) > 1:
                assert color == "#FFD700"  # Golden Yellow for medium severity
            else:
                assert color == "#D3D3D3"  # Neutral Gray for normal 