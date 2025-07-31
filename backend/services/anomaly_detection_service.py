import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
import logging
from typing import Dict, List, Tuple, Optional
import json

logger = logging.getLogger(__name__)

class AnomalyDetectionService:
    """Service for detecting anomalies in synthetic data using Isolation Forest + DBSCAN clustering."""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.is_fitted = False
        
    def train_anomaly_detector(self, real_data: List[List[float]], 
                               contamination: str = 'auto') -> Dict:
        """
        Train Isolation Forest model on real data only.
        
        Args:
            real_data: List of real data points (embedding coordinates)
            contamination: Expected proportion of anomalies ('auto' for automatic detection)
            
        Returns:
            Dict containing training results and model info
        """
        try:
            # Convert to numpy array
            real_array = np.array(real_data)
            
            if real_array.shape[0] < 10:
                raise ValueError("Insufficient real data for training (minimum 10 points)")
            
            # Initialize and train Isolation Forest with automatic contamination
            self.model = IsolationForest(
                contamination=contamination,
                random_state=42,
                n_estimators=100,
                max_samples='auto'
            )
            
            # Fit the model on real data only
            self.model.fit(real_array)
            self.is_fitted = True
            
            # Calculate baseline scores for real data
            real_scores = self.model.score_samples(real_array)
            real_predictions = self.model.predict(real_array)
            
            logger.info(f"Anomaly detector trained on {len(real_data)} real data points")
            
            return {
                "status": "success",
                "model_info": {
                    "contamination": contamination,
                    "n_estimators": 100,
                    "real_data_points": int(len(real_data)),
                    "real_data_shape": list(real_array.shape)
                },
                "real_data_baseline": {
                    "mean_score": float(np.mean(real_scores)),
                    "std_score": float(np.std(real_scores)),
                    "min_score": float(np.min(real_scores)),
                    "max_score": float(np.max(real_scores))
                }
            }
            
        except Exception as e:
            logger.error(f"Error training anomaly detector: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def detect_anomalies(self, real_data: List[List[float]], synthetic_data: List[List[float]], contamination: str = 'auto') -> Dict:
        """
        Detect anomalies in both real and synthetic data using Isolation Forest.
        
        Args:
            real_data: List of real data points
            synthetic_data: List of synthetic data points
            contamination: Contamination parameter for Isolation Forest ('auto' or float)
            
        Returns:
            Dictionary containing anomaly detection results for both real and synthetic data
        """
        try:
            logger.info(f"Starting anomaly detection with contamination={contamination}")
            
            # Check if model is fitted
            if not hasattr(self, 'model') or not self.is_fitted:
                logger.info("Model not fitted, training on real data...")
                self.train_anomaly_detector(real_data, contamination)
            
            # Convert to numpy arrays
            real_array = np.array(real_data, dtype=np.float64)
            synthetic_array = np.array(synthetic_data, dtype=np.float64)
            
            logger.info(f"Real data shape: {real_array.shape}")
            logger.info(f"Synthetic data shape: {synthetic_array.shape}")
            
            # Score both real and synthetic data
            logger.info("Scoring real data...")
            real_scores = self.model.score_samples(real_array)
            real_predictions = self.model.predict(real_array)
            
            logger.info("Scoring synthetic data...")
            synthetic_scores = self.model.score_samples(synthetic_array)
            synthetic_predictions = self.model.predict(synthetic_array)
            
            logger.info(f"Real scores shape: {real_scores.shape}")
            logger.info(f"Synthetic scores shape: {synthetic_scores.shape}")
            logger.info(f"Real predictions: {real_predictions[:10]}...")  # Show first 10
            logger.info(f"Synthetic predictions: {synthetic_predictions[:10]}...")  # Show first 10
            
            # Create results for real data
            real_anomalies = []
            real_normal = []
            
            for i, (score, prediction) in enumerate(zip(real_scores, real_predictions)):
                point_data = {
                    "index": i,
                    "coordinates": real_data[i] if i < len(real_data) else [0, 0],
                    "score": float(score),
                    "is_anomaly": bool(prediction == -1),
                    "data_type": "real"
                }
                
                if prediction == -1:
                    real_anomalies.append(point_data)
                else:
                    real_normal.append(point_data)
            
            # Create results for synthetic data
            synthetic_anomalies = []
            synthetic_normal = []
            
            for i, (score, prediction) in enumerate(zip(synthetic_scores, synthetic_predictions)):
                point_data = {
                    "index": i,
                    "coordinates": synthetic_data[i] if i < len(synthetic_data) else [0, 0],
                    "score": float(score),
                    "is_anomaly": bool(prediction == -1),
                    "data_type": "synthetic"
                }
                
                if prediction == -1:
                    synthetic_anomalies.append(point_data)
                else:
                    synthetic_normal.append(point_data)
            
            # Calculate statistics
            total_real = len(real_data)
            total_synthetic = len(synthetic_data)
            real_anomaly_count = len(real_anomalies)
            synthetic_anomaly_count = len(synthetic_anomalies)
            
            statistics = {
                "total_real": total_real,
                "total_synthetic": total_synthetic,
                "real_anomalies": real_anomaly_count,
                "synthetic_anomalies": synthetic_anomaly_count,
                "real_anomaly_rate": float(real_anomaly_count / total_real) if total_real > 0 else 0.0,
                "synthetic_anomaly_rate": float(synthetic_anomaly_count / total_synthetic) if total_synthetic > 0 else 0.0,
                "contamination": contamination
            }
            
            # Combine all data for return
            all_real_data = real_anomalies + real_normal
            all_synthetic_data = synthetic_anomalies + synthetic_normal
            
            return_dict = {
                "status": "success",
                "statistics": statistics,
                "real_data": all_real_data,
                "synthetic_data": all_synthetic_data,
                "real_anomalies": real_anomalies,
                "real_normal": real_normal,
                "synthetic_anomalies": synthetic_anomalies,
                "normal_synthetic": synthetic_normal,
                "message": f"Detected {real_anomaly_count} real anomalies and {synthetic_anomaly_count} synthetic anomalies"
            }
            
            logger.info(f"Final return_dict keys: {return_dict.keys()}")
            logger.info(f"Returning: {return_dict}")
            
            return return_dict
            
        except Exception as e:
            logger.error(f"Error in detect_anomalies: {str(e)}")
            raise Exception(f"Anomaly detection failed: {str(e)}")
    
    def _classify_severity(self, avg_severity: float) -> str:
        """Classify anomaly severity based on average score."""
        if avg_severity < -0.8:
            return "critical"
        elif avg_severity < -0.5:
            return "high"
        elif avg_severity < -0.2:
            return "moderate"
        else:
            return "low"
    
    def generate_anomaly_csv(self, results: Dict) -> str:
        """
        Generate CSV content for anomaly results.
        
        Args:
            results: Anomaly detection results from detect_anomalies
            
        Returns:
            CSV content as string
        """
        try:
            if results.get("status") != "success":
                return "# Anomaly detection failed or no results available"
            
            # Create CSV content
            csv_lines = []
            
            # Add summary statistics as comments
            stats = results.get("statistics", {})
            csv_lines.append(f"# Anomaly Detection Summary")
            csv_lines.append(f"# Total Real Points: {stats.get('total_real', 0)}")
            csv_lines.append(f"# Total Synthetic Points: {stats.get('total_synthetic', 0)}")
            csv_lines.append(f"# Real Anomalies Detected: {stats.get('real_anomalies', 0)}")
            csv_lines.append(f"# Synthetic Anomalies Detected: {stats.get('synthetic_anomalies', 0)}")
            csv_lines.append("")
            
            # Add header
            csv_lines.append("index,anomaly_score,prediction,is_anomaly,data_type")
            
            # Add real data points
            real_data = results.get("real_data", [])
            for point in real_data:
                csv_lines.append(f"{point.get('index', 0)},{point.get('score', 0):.6f},{1 if point.get('is_anomaly', False) else -1},{point.get('is_anomaly', False)},{point.get('data_type', 'real')}")
            
            # Add synthetic data points
            synthetic_data = results.get("synthetic_data", [])
            for point in synthetic_data:
                csv_lines.append(f"{point.get('index', 0)},{point.get('score', 0):.6f},{1 if point.get('is_anomaly', False) else -1},{point.get('is_anomaly', False)},{point.get('data_type', 'synthetic')}")
            
            return "\n".join(csv_lines)
            
        except Exception as e:
            logger.error(f"Error generating CSV: {str(e)}")
            return f"# Error generating CSV: {str(e)}"

# Global instance
anomaly_service = AnomalyDetectionService() 