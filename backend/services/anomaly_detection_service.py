import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import logging
from typing import Dict, List, Tuple, Optional
import json

logger = logging.getLogger(__name__)

def convert_numpy_types(obj):
    """Convert numpy types to Python native types for JSON serialization."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        float_val = float(obj)
        # Handle infinite values for JSON serialization
        if np.isinf(float_val):
            return "Infinity" if float_val > 0 else "-Infinity"
        elif np.isnan(float_val):
            return "NaN"
        return float_val
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    else:
        # Handle Python float inf/nan values too
        if isinstance(obj, float):
            if np.isinf(obj):
                return "Infinity" if obj > 0 else "-Infinity"
            elif np.isnan(obj):
                return "NaN"
        return obj

class AdaptiveLogitAnomalyDetectionService:
    """Advanced service for detecting anomalies using adaptive logit transformation with data-driven thresholds."""
    
    def __init__(self):
        self.grid_info = None
        self.logit_thresholds = None
        self.is_fitted = False
        
    def _create_grid(self, data: np.ndarray, grid_size: int = 20) -> Dict:
        """
        Create a grid overlay on the data space.
        
        Args:
            data: 2D numpy array of data points
            grid_size: Number of grid cells per dimension
            
        Returns:
            Dictionary containing grid information
        """
        # Get data bounds
        min_vals = np.min(data, axis=0)
        max_vals = np.max(data, axis=0)
        
        # Add small padding to avoid edge cases
        padding = (max_vals - min_vals) * 0.01
        min_vals -= padding
        max_vals += padding
        
        # Create grid
        x_bins = np.linspace(min_vals[0], max_vals[0], grid_size + 1)
        y_bins = np.linspace(min_vals[1], max_vals[1], grid_size + 1)
        
        return {
            'x_bins': x_bins,
            'y_bins': y_bins,
            'grid_size': grid_size,
            'bounds': {
                'x_min': float(min_vals[0]),
                'x_max': float(max_vals[0]),
                'y_min': float(min_vals[1]),
                'y_max': float(max_vals[1])
            }
        }
    
    def _calculate_density(self, data: np.ndarray, grid_info: Dict) -> np.ndarray:
        """
        Calculate density for each grid cell.
        
        Args:
            data: 2D numpy array of data points
            grid_info: Grid information dictionary
            
        Returns:
            2D numpy array of density values for each grid cell
        """
        # Handle empty data
        if data.size == 0:
            return np.zeros((grid_info['grid_size'], grid_info['grid_size']))
        
        # Create 2D histogram
        density, _, _ = np.histogram2d(
            data[:, 0], 
            data[:, 1], 
            bins=[grid_info['x_bins'], grid_info['y_bins']]
        )
        
        return density
    
    def _get_cell_count(self, data: np.ndarray, cell_x: int, cell_y: int, grid_info: Dict) -> int:
        """
        Get the count of data points in a specific grid cell.
        
        Args:
            data: 2D numpy array of data points
            cell_x: X coordinate of the cell
            cell_y: Y coordinate of the cell
            grid_info: Grid information dictionary
            
        Returns:
            Number of data points in the specified cell
        """
        if data.size == 0:
            return 0
        
        # Get cell boundaries
        x_min = grid_info['x_bins'][cell_x]
        x_max = grid_info['x_bins'][cell_x + 1]
        y_min = grid_info['y_bins'][cell_y]
        y_max = grid_info['y_bins'][cell_y + 1]
        
        # Count points in cell
        mask = ((data[:, 0] >= x_min) & (data[:, 0] < x_max) &
                (data[:, 1] >= y_min) & (data[:, 1] < y_max))
        
        return int(np.sum(mask))
    
    def _calculate_adaptive_logit_thresholds(self, real_data: np.ndarray, synthetic_data: np.ndarray, grid_info: Dict) -> Dict:
        """
        Calculate adaptive thresholds based on global dataset characteristics and cell logit distribution.
        
        Args:
            real_data: 2D numpy array of real data points
            synthetic_data: 2D numpy array of synthetic data points
            grid_info: Grid information dictionary
            
        Returns:
            Dictionary containing logit thresholds and statistics
        """
        # Calculate global baseline
        total_real = len(real_data)
        total_synthetic = len(synthetic_data)
        total_points = total_real + total_synthetic
        
        if total_points == 0:
            raise ValueError("No data points available for threshold calculation")
        
        # Global probability and logit
        p_global = total_real / total_points
        if p_global == 0 or p_global == 1:
            # Handle edge cases
            logit_global = 0.0 if p_global == 0.5 else (float('inf') if p_global == 1 else float('-inf'))
        else:
            logit_global = np.log(p_global / (1 - p_global))
        
        # Calculate logit values for all cells
        logit_values = []
        cell_statistics = {}
        
        for i in range(grid_info['grid_size']):
            for j in range(grid_info['grid_size']):
                real_count = self._get_cell_count(real_data, i, j, grid_info)
                synthetic_count = self._get_cell_count(synthetic_data, i, j, grid_info)
                total_cell = real_count + synthetic_count
                
                if total_cell > 0:
                    p_cell = real_count / total_cell
                    
                    # Calculate logit (avoid log(0) or log(infinity))
                    if 0 < p_cell < 1:
                        logit_cell = np.log(p_cell / (1 - p_cell))
                        logit_values.append(logit_cell)
                        
                        cell_statistics[f"{i},{j}"] = {
                            'cell_x': i,
                            'cell_y': j,
                            'real_count': real_count,
                            'synthetic_count': synthetic_count,
                            'total_count': total_cell,
                            'p_cell': p_cell,
                            'logit_cell': logit_cell
                        }
                    else:
                        # Handle edge cases (all real or all synthetic)
                        logit_cell = float('inf') if p_cell == 1 else float('-inf')
                        cell_statistics[f"{i},{j}"] = {
                        'cell_x': i,
                        'cell_y': j,
                            'real_count': real_count,
                            'synthetic_count': synthetic_count,
                            'total_count': total_cell,
                            'p_cell': p_cell,
                            'logit_cell': logit_cell
                        }
        
        # Calculate standard deviation of logit values
        if len(logit_values) > 1:
            logit_sd = np.std(logit_values)
        else:
            # If only one cell or no valid logits, use a default
            logit_sd = 1.0
        
        # Set adaptive thresholds
        threshold_lower = logit_global - logit_sd
        threshold_upper = logit_global + logit_sd
        
        return {
            'logit_global': logit_global,
            'logit_sd': logit_sd,
            'threshold_lower': threshold_lower,
            'threshold_upper': threshold_upper,
            'p_global': p_global,
            'total_real': total_real,
            'total_synthetic': total_synthetic,
            'total_points': total_points,
            'cell_statistics': cell_statistics,
            'valid_logit_count': len(logit_values)
        }
    
    def _calculate_anomaly_color(self, logit_cell: float, thresholds: Dict) -> str:
        """
        Calculate color based on z-score using existing thresholds.
        
        Args:
            logit_cell: Logit value for the cell
            thresholds: Dictionary containing logit thresholds
            
        Returns:
            Hex color string for visualization
        """
        global_logit = thresholds['logit_global']
        logit_sd = thresholds['logit_sd']
        
        if logit_sd == 0:
            return '#CCCCCC'  # Gray if no variation
        
        # Calculate z-score
        z_score = (logit_cell - global_logit) / logit_sd
        
        # Color logic based on z-score with severity distinction
        if z_score < -2:
            return '#8B0000'  # Dark Red (strongly synthetic-heavy, high severity)
        elif z_score < -1:
            return '#FFD700'  # Golden Yellow (moderately synthetic-heavy, medium severity)
        elif z_score > 2:
            return '#8B0000'  # Dark Red (strongly real-heavy, high severity)
        elif z_score > 1:
            return '#FFD700'  # Golden Yellow (moderately real-heavy, medium severity)
        else:
            return '#D3D3D3'  # Neutral Gray (balanced/normal)
    
    def _detect_logit_anomalies(self, real_data: np.ndarray, synthetic_data: np.ndarray, 
                               grid_info: Dict, thresholds: Dict) -> List[Dict]:
        """
        Detect anomalies using adaptive logit thresholds.
        
        Args:
            real_data: 2D numpy array of real data points
            synthetic_data: 2D numpy array of synthetic data points
            grid_info: Grid information dictionary
            thresholds: Dictionary containing logit thresholds
            
        Returns:
            List of anomaly dictionaries
        """
        anomalies = []
        
        cells_processed = 0
        cells_skipped_low_count = 0
        cells_skipped_extreme = 0
        
        for i in range(grid_info['grid_size']):
            for j in range(grid_info['grid_size']):
                real_count = self._get_cell_count(real_data, i, j, grid_info)
                synthetic_count = self._get_cell_count(synthetic_data, i, j, grid_info)
                total_cell = real_count + synthetic_count
                
                # Only process cells with a minimum number of points to avoid noise
                min_points_threshold = 3  # Require at least 3 points to consider a cell for anomaly detection
                
                if total_cell >= min_points_threshold:
                    cells_processed += 1
                    p_cell = real_count / total_cell
                    
                    # Calculate logit value
                    if 0 < p_cell < 1:
                        logit_cell = np.log(p_cell / (1 - p_cell))
                        
                        # Check if outside adaptive threshold
                        if (logit_cell < thresholds['threshold_lower'] or 
                            logit_cell > thresholds['threshold_upper']):
                            
                            # Calculate z-score for severity
                            z_score = (logit_cell - thresholds['logit_global']) / thresholds['logit_sd']
                            
                            # Determine severity based on z-score
                            if abs(z_score) > 2:
                                severity = 'high'
                            else:
                                severity = 'medium'
                            
                            # Determine anomaly type
                            if logit_cell > thresholds['threshold_upper']:
                                anomaly_type = 'real_overrepresentation'
                            else:
                                anomaly_type = 'synthetic_overrepresentation'
                            
                            anomalies.append({
                                'cell_x': i,
                                'cell_y': j,
                                'logit_value': logit_cell,
                                'p_cell': p_cell,
                                'real_count': real_count,
                                'synthetic_count': synthetic_count,
                                'total_count': total_cell,
                                'severity': severity,
                                'anomaly_type': anomaly_type,
                                'z_score': z_score,
                                'color': self._calculate_anomaly_color(logit_cell, thresholds)
                            })
                    else:
                        # Handle edge cases (all real or all synthetic) - only for significant cell populations
                        if total_cell >= 5:  # Higher threshold for extreme cases to ensure statistical significance
                            if p_cell == 1:  # All real
                                logit_cell = float('inf')
                                anomaly_type = 'real_overrepresentation'
                            else:  # All synthetic
                                logit_cell = float('-inf')
                                anomaly_type = 'synthetic_overrepresentation'
                            
                            # These are definitely anomalies but only if significant
                            anomalies.append({
                                'cell_x': i,
                                'cell_y': j,
                                'logit_value': logit_cell,
                                'p_cell': p_cell,
                                'real_count': real_count,
                                'synthetic_count': synthetic_count,
                                'total_count': total_cell,
                                'severity': 'high',
                                'anomaly_type': anomaly_type,
                                'z_score': float('inf') if p_cell == 1 else float('-inf'),
                                'color': self._calculate_anomaly_color(logit_cell, thresholds)
                            })
                        else:
                            cells_skipped_extreme += 1
                else:
                    cells_skipped_low_count += 1
        
        logger.info(f"Anomaly detection cell processing: {cells_processed} processed, {cells_skipped_low_count} skipped (low count), {cells_skipped_extreme} skipped (extreme but insufficient)")
        logger.info(f"Found {len(anomalies)} anomalous cells")
        
        return anomalies
    
    def _get_cell_indices(self, point: np.ndarray, grid_info: Dict) -> Tuple[int, int]:
        """
        Get grid cell indices for a data point.
        
        Args:
            point: 2D point coordinates
            grid_info: Grid information dictionary
            
        Returns:
            Tuple of (x_index, y_index) for the grid cell
        """
        x_idx = np.digitize(point[0], grid_info['x_bins']) - 1
        y_idx = np.digitize(point[1], grid_info['y_bins']) - 1
        
        # Clamp to valid range
        x_idx = max(0, min(x_idx, grid_info['grid_size'] - 1))
        y_idx = max(0, min(y_idx, grid_info['grid_size'] - 1))
        
        return x_idx, y_idx
    
    def train_logit_detector(self, real_data: List[List[float]], synthetic_data: List[List[float]],
                           grid_size: int = 20) -> Dict:
        """
        Train adaptive logit-based anomaly detector on real and synthetic data.
        
        Args:
            real_data: List of real data points (2D coordinates)
            synthetic_data: List of synthetic data points (2D coordinates)
            grid_size: Number of grid cells per dimension
            
        Returns:
            Dict containing training results and analysis
        """
        try:
            # Convert to numpy arrays
            real_array = np.array(real_data)
            synthetic_array = np.array(synthetic_data)
            
            if real_array.shape[0] < 10:
                raise ValueError("Insufficient real data for training (minimum 10 points)")
            
            if synthetic_array.shape[0] < 5:
                raise ValueError("Insufficient synthetic data for training (minimum 5 points)")
            
            if real_array.shape[1] != 2 or synthetic_array.shape[1] != 2:
                raise ValueError("Data must be 2D coordinates")
            
            # Create grid using combined data bounds
            combined_data = np.vstack([real_array, synthetic_array])
            self.grid_info = self._create_grid(combined_data, grid_size)
            
            # Calculate adaptive thresholds
            self.logit_thresholds = self._calculate_adaptive_logit_thresholds(
                real_array, synthetic_array, self.grid_info
            )
            
            self.is_fitted = True
            
            logger.info(f"Adaptive logit detector trained on {len(real_data)} real and {len(synthetic_data)} synthetic data points")
            logger.info(f"Grid size: {grid_size}x{grid_size}")
            logger.info(f"Global logit: {self.logit_thresholds['logit_global']:.3f}")
            logger.info(f"Logit SD: {self.logit_thresholds['logit_sd']:.3f}")
            logger.info(f"Thresholds: [{self.logit_thresholds['threshold_lower']:.3f}, {self.logit_thresholds['threshold_upper']:.3f}]")
            
            return convert_numpy_types({
                "status": "success",
                "grid_info": {
                    "grid_size": grid_size,
                    "bounds": self.grid_info['bounds'],
                    "total_cells": grid_size * grid_size
                },
                "logit_thresholds": {
                    "logit_global": self.logit_thresholds['logit_global'],
                    "logit_sd": self.logit_thresholds['logit_sd'],
                    "threshold_lower": self.logit_thresholds['threshold_lower'],
                    "threshold_upper": self.logit_thresholds['threshold_upper'],
                    "p_global": self.logit_thresholds['p_global']
                },
                "statistics": {
                    "total_real": self.logit_thresholds['total_real'],
                    "total_synthetic": self.logit_thresholds['total_synthetic'],
                    "total_points": self.logit_thresholds['total_points'],
                    "valid_logit_count": self.logit_thresholds['valid_logit_count']
                }
            })
            
        except Exception as e:
            logger.error(f"Error training logit detector: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def detect_anomalies(self, real_data: List[List[float]], 
                        synthetic_data: List[List[float]],
                        grid_size: int = 20) -> Dict:
        """
        Detect anomalies using adaptive logit-based analysis.
        
        Args:
            real_data: List of real data points (2D coordinates)
            synthetic_data: List of synthetic data points (2D coordinates)
            grid_size: Number of grid cells per dimension
            
        Returns:
            Dictionary containing anomaly detection results
        """
        try:
            logger.info(f"Starting adaptive logit anomaly detection with grid_size={grid_size}")
            
            # Validate input data
            if not real_data or len(real_data) == 0:
                raise ValueError("Real data cannot be empty")
            
            if not synthetic_data or len(synthetic_data) == 0:
                raise ValueError("Synthetic data cannot be empty")
            
            # Convert to numpy arrays
            real_array = np.array(real_data, dtype=np.float64)
            synthetic_array = np.array(synthetic_data, dtype=np.float64)
            
            # Validate dimensions
            if real_array.shape[1] != 2 or synthetic_array.shape[1] != 2:
                raise ValueError("Both real and synthetic data must be 2D coordinates")
            
            logger.info(f"Real data shape: {real_array.shape}")
            logger.info(f"Synthetic data shape: {synthetic_array.shape}")
            
            # Check if model is fitted
            if not self.is_fitted:
                logger.info("Model not fitted, training on real and synthetic data...")
                self.train_logit_detector(real_data, synthetic_data, grid_size)
            
            # Detect logit anomalies
            logit_anomalies = self._detect_logit_anomalies(
                real_array, synthetic_array, self.grid_info, self.logit_thresholds
            )
            
            # Process points with anomaly classification
            real_anomalies = []
            real_normal = []
            synthetic_anomalies = []
            synthetic_normal = []
            
            # Create anomaly cell lookup
            anomaly_cells = set()
            for anomaly in logit_anomalies:
                anomaly_cells.add(f"{anomaly['cell_x']},{anomaly['cell_y']}")
            
            # Process real data points
            for i, point in enumerate(real_array):
                x_idx, y_idx = self._get_cell_indices(point, self.grid_info)
                cell_id = f"{x_idx},{y_idx}"
                is_anomaly = cell_id in anomaly_cells
                
                point_data = {
                    "index": i,
                    "coordinates": point.tolist(),
                    "grid_cell": [x_idx, y_idx],
                    "is_anomaly": bool(is_anomaly),
                    "data_type": "real"
                }
                
                if is_anomaly:
                    real_anomalies.append(point_data)
                else:
                    real_normal.append(point_data)
            
            # Process synthetic data points
            for i, point in enumerate(synthetic_array):
                x_idx, y_idx = self._get_cell_indices(point, self.grid_info)
                cell_id = f"{x_idx},{y_idx}"
                is_anomaly = cell_id in anomaly_cells
                
                point_data = {
                    "index": i,
                    "coordinates": point.tolist(),
                    "grid_cell": [x_idx, y_idx],
                    "is_anomaly": bool(is_anomaly),
                    "data_type": "synthetic"
                }
                
                if is_anomaly:
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
                "grid_size": self.grid_info['grid_size'],
                "total_anomaly_cells": len(logit_anomalies),
                "logit_global": self.logit_thresholds['logit_global'],
                "logit_sd": self.logit_thresholds['logit_sd'],
                "threshold_lower": self.logit_thresholds['threshold_lower'],
                "threshold_upper": self.logit_thresholds['threshold_upper'],
                "p_global": self.logit_thresholds['p_global']
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
                "synthetic_normal": synthetic_normal,
                "grid_info": self.grid_info,
                "logit_thresholds": {
                    "logit_global": self.logit_thresholds['logit_global'],
                    "logit_sd": self.logit_thresholds['logit_sd'],
                    "threshold_lower": self.logit_thresholds['threshold_lower'],
                    "threshold_upper": self.logit_thresholds['threshold_upper'],
                    "p_global": self.logit_thresholds['p_global']
                },
                "cell_anomalies": logit_anomalies,
                "message": f"Detected {real_anomaly_count} real anomalies and {synthetic_anomaly_count} synthetic anomalies using adaptive logit approach"
            }
            
            converted_dict = convert_numpy_types(return_dict)
            
            logger.info(f"Adaptive logit detection complete: {real_anomaly_count} real, {synthetic_anomaly_count} synthetic anomalies")
            
            return converted_dict
            
        except Exception as e:
            logger.error(f"Error in adaptive logit detect_anomalies: {str(e)}")
            return {
                "status": "error",
                "message": f"Adaptive logit anomaly detection failed: {str(e)}"
            }
    
    def generate_anomaly_csv(self, results: Dict) -> str:
        """
        Generate CSV content for adaptive logit anomaly results.
        
        Args:
            results: Anomaly detection results from detect_anomalies
            
        Returns:
            CSV content as string
        """
        try:
            if results.get("status") != "success":
                return "# Adaptive logit anomaly detection failed or no results available"
            
            # Create CSV content
            csv_lines = []
            
            # Add summary statistics as comments
            stats = results.get("statistics", {})
            grid_info = results.get("grid_info", {})
            logit_thresholds = results.get("logit_thresholds", {})
            
            csv_lines.append(f"# Adaptive Logit Anomaly Detection Results")
            csv_lines.append(f"# Grid Size: {grid_info.get('grid_size', 'N/A')}x{grid_info.get('grid_size', 'N/A')}")
            # Safely format numeric values
            p_global = logit_thresholds.get('p_global')
            logit_global = logit_thresholds.get('logit_global')
            logit_sd = logit_thresholds.get('logit_sd')
            threshold_lower = logit_thresholds.get('threshold_lower')
            threshold_upper = logit_thresholds.get('threshold_upper')
            
            # Format values handling infinity and NaN
            def format_value(val, decimals=3):
                if val is None:
                    return "None"
                elif isinstance(val, (int, float)) and not (np.isinf(val) or np.isnan(val)):
                    return f"{val:.{decimals}f}"
                elif val in ["Infinity", "-Infinity", "NaN"]:
                    return val
                else:
                    return str(val)
            
            # Add global statistics (removed threshold parameter as requested)
            csv_lines.append(f"# Global Probability: {format_value(p_global)}")
            csv_lines.append(f"# Global Logit: {format_value(logit_global)}")
            csv_lines.append(f"# Logit Standard Deviation: {format_value(logit_sd)}")
            csv_lines.append(f"# Total Real Points: {stats.get('total_real', 0)}")
            csv_lines.append(f"# Total Synthetic Points: {stats.get('total_synthetic', 0)}")
            csv_lines.append(f"# Real Anomalies Detected: {stats.get('real_anomalies', 0)}")
            csv_lines.append(f"# Synthetic Anomalies Detected: {stats.get('synthetic_anomalies', 0)}")
            csv_lines.append("")
            
            # Add header
            csv_lines.append("cell_x,cell_y,real_count,synthetic_count,total_count,p_cell,logit_cell,z_score,anomaly_type,severity,color")
            
            # Add cell-level analysis
            cell_anomalies = results.get("cell_anomalies", [])
            for anomaly in cell_anomalies:
                # Safely format numeric values using the format_value function
                p_cell = anomaly.get('p_cell', 0)
                logit_value = anomaly.get('logit_value', 0)
                z_score = anomaly.get('z_score', 0)
                
                p_cell_str = format_value(p_cell)
                logit_str = format_value(logit_value)
                z_score_str = format_value(z_score)
                
                csv_lines.append(f"{anomaly['cell_x']},{anomaly['cell_y']},{anomaly.get('real_count', 0)},{anomaly.get('synthetic_count', 0)},{anomaly.get('total_count', 0)},{p_cell_str},{logit_str},{z_score_str},{anomaly.get('anomaly_type', 'unknown')},{anomaly['severity']},{anomaly.get('color', '#CCCCCC')}")
            
            csv_lines.append("")
            csv_lines.append("# Point-level data")
            csv_lines.append("index,grid_cell_x,grid_cell_y,is_anomaly,data_type")
            
            # Add real data points
            real_data = results.get("real_data", [])
            for point in real_data:
                grid_cell = point.get("grid_cell", [0, 0])
                csv_lines.append(f"{point.get('index', 0)},{grid_cell[0]},{grid_cell[1]},{point.get('is_anomaly', False)},{point.get('data_type', 'real')}")
            
            # Add synthetic data points
            synthetic_data = results.get("synthetic_data", [])
            for point in synthetic_data:
                grid_cell = point.get("grid_cell", [0, 0])
                csv_lines.append(f"{point.get('index', 0)},{grid_cell[0]},{grid_cell[1]},{point.get('is_anomaly', False)},{point.get('data_type', 'synthetic')}")
            
            return "\n".join(csv_lines)
        
        except Exception as e:
            logger.error(f"Error generating CSV: {str(e)}")
            return f"# Error generating CSV: {str(e)}"

# Global instance
anomaly_service = AdaptiveLogitAnomalyDetectionService() 