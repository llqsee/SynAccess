import pytest
import numpy as np
from services.anomaly_detection_service import AnomalyDetectionService

class TestAnomalyDetectionService:
    
    def setup_method(self):
        """Set up test fixtures."""
        self.service = AnomalyDetectionService()
        
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
    
    def test_train_anomaly_detector(self):
        """Test training the anomaly detector."""
        result = self.service.train_anomaly_detector(self.real_data, contamination=0.1)
        
        assert result["status"] == "success"
        assert self.service.is_fitted is True
        assert self.service.model is not None
        assert "model_info" in result
        assert "real_data_baseline" in result
    
    def test_detect_anomalies(self):
        """Test anomaly detection."""
        # First train the model
        self.service.train_anomaly_detector(self.real_data, contamination=0.1)
        
        # Then detect anomalies
        result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        assert result["status"] == "success"
        assert "statistics" in result
        assert "real_data" in result
        assert "synthetic_data" in result
        assert "anomalies" in result
        assert "normal_synthetic" in result
        
        # Check statistics
        stats = result["statistics"]
        assert stats["total_synthetic"] == len(self.synthetic_data)
        assert stats["synthetic_anomalies"] >= 0
        assert stats["synthetic_normal"] >= 0
        assert 0 <= stats["anomaly_rate"] <= 1
    
    def test_generate_anomaly_csv(self):
        """Test CSV generation."""
        # Train and detect
        self.service.train_anomaly_detector(self.real_data, contamination=0.1)
        detection_result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        # Generate CSV
        csv_content = self.service.generate_anomaly_csv(detection_result)
        
        assert csv_content is not None
        assert len(csv_content) > 0
        assert "# Anomaly Detection Results Summary" in csv_content
        assert "index,x_coordinate,y_coordinate,anomaly_score,prediction,is_anomaly,data_type,category" in csv_content
    
    def test_insufficient_real_data(self):
        """Test handling of insufficient real data."""
        insufficient_data = [[1.0, 2.0], [3.0, 4.0]]  # Only 2 points
        
        result = self.service.train_anomaly_detector(insufficient_data, contamination=0.1)
        
        assert result["status"] == "error"
        assert "Insufficient real data" in result["message"]
    
    def test_no_synthetic_data(self):
        """Test handling of no synthetic data."""
        self.service.train_anomaly_detector(self.real_data, contamination=0.1)
        
        result = self.service.detect_anomalies(self.real_data, [])
        
        assert result["status"] == "error"
        assert "No synthetic data" in result["message"]
    
    def test_different_dimensions(self):
        """Test handling of different data dimensions."""
        real_2d = [[1.0, 2.0], [3.0, 4.0]]
        synthetic_3d = [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]]
        
        self.service.train_anomaly_detector(real_2d, contamination=0.1)
        result = self.service.detect_anomalies(real_2d, synthetic_3d)
        
        # This should fail due to dimension mismatch
        assert result["status"] == "error"
    
    def test_anomaly_scores(self):
        """Test that anomaly scores are reasonable."""
        self.service.train_anomaly_detector(self.real_data, contamination=0.1)
        result = self.service.detect_anomalies(self.real_data, self.synthetic_data)
        
        # Check that all synthetic data points have scores
        for point in result["synthetic_data"]:
            assert "anomaly_score" in point
            assert isinstance(point["anomaly_score"], float)
            assert "prediction" in point
            assert point["prediction"] in [-1, 1]  # -1 for anomaly, 1 for normal
            assert "is_anomaly" in point
            assert isinstance(point["is_anomaly"], bool)
    
    def test_real_data_baseline(self):
        """Test that real data baseline is calculated correctly."""
        result = self.service.train_anomaly_detector(self.real_data, contamination=0.1)
        
        baseline = result["real_data_baseline"]
        assert "mean_score" in baseline
        assert "std_score" in baseline
        assert "min_score" in baseline
        assert "max_score" in baseline
        
        # All scores should be finite
        assert np.isfinite(baseline["mean_score"])
        assert np.isfinite(baseline["std_score"])
        assert np.isfinite(baseline["min_score"])
        assert np.isfinite(baseline["max_score"]) 