import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import logging
from typing import Dict, List, Tuple, Optional
import json
from scipy import stats
from statsmodels.stats.multitest import fdrcorrection

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

class HistogramBasedAnomalyDetectionService:
    """
    Advanced service for detecting anomalies using histogram-based grid sizing with statistical testing.
    
    This service implements:
    1. Histogram-based grid cell determination for X and Y dimensions separately
    2. Two one-sided t-tests for mean comparison (real vs synthetic overpopulation)
    3. False Discovery Rate (FDR) correction applied separately to positive and negative tests
    4. Binary red/blue coloring based on FDR-corrected significance
    """
    
    def __init__(self):
        self.grid_info = None
        self.global_logit = None
        self.is_fitted = False
        
    def _create_histogram_based_grid(self, real_data: np.ndarray, synthetic_data: np.ndarray, 
                                   x_bins: int = 20, y_bins: int = 20) -> Dict:
        """
        Create a grid overlay using histogram-based binning for each dimension separately.
        
        Args:
            real_data: 2D numpy array of real data points
            synthetic_data: 2D numpy array of synthetic data points
            x_bins: Number of bins for X dimension
            y_bins: Number of bins for Y dimension
            
        Returns:
            Dictionary containing grid information with histogram-based bins
        """
        # Combine data for overall bounds
        combined_data = np.vstack([real_data, synthetic_data])
        
        # Create histograms for each dimension to determine optimal bin edges
        x_coords = combined_data[:, 0]
        y_coords = combined_data[:, 1]
        
        # Use numpy's histogram function to get optimal bin edges
        # This automatically handles data distribution for better grid sizing
        _, x_bin_edges = np.histogram(x_coords, bins=x_bins)
        _, y_bin_edges = np.histogram(y_coords, bins=y_bins)
        
        # Ensure we cover the full data range by extending edges slightly if needed
        x_range = x_coords.max() - x_coords.min()
        y_range = y_coords.max() - y_coords.min()
        
        x_padding = x_range * 0.01
        y_padding = y_range * 0.01
        
        x_bin_edges[0] = min(x_bin_edges[0], x_coords.min() - x_padding)
        x_bin_edges[-1] = max(x_bin_edges[-1], x_coords.max() + x_padding)
        y_bin_edges[0] = min(y_bin_edges[0], y_coords.min() - y_padding)
        y_bin_edges[-1] = max(y_bin_edges[-1], y_coords.max() + y_padding)
        
        return {
            'x_bins': x_bin_edges,
            'y_bins': y_bin_edges,
            'x_grid_size': x_bins,
            'y_grid_size': y_bins,
            'grid_size': min(x_bins, y_bins),  # For backward compatibility
            'bounds': {
                'x_min': float(x_bin_edges[0]),
                'x_max': float(x_bin_edges[-1]),
                'y_min': float(y_bin_edges[0]),
                'y_max': float(y_bin_edges[-1])
            }
        }
    
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
        
        # Get cell boundaries using histogram-based bins
        x_min = grid_info['x_bins'][cell_x]
        x_max = grid_info['x_bins'][cell_x + 1]
        y_min = grid_info['y_bins'][cell_y]
        y_max = grid_info['y_bins'][cell_y + 1]
        
        # Count points in cell
        mask = ((data[:, 0] >= x_min) & (data[:, 0] < x_max) &
                (data[:, 1] >= y_min) & (data[:, 1] < y_max))
        
        return int(np.sum(mask))
    
    def _calculate_global_logit(self, real_data: np.ndarray, synthetic_data: np.ndarray) -> float:
        """
        Calculate the global logit (a_0) from the entire dataset.
        
        Args:
            real_data: 2D numpy array of real data points
            synthetic_data: 2D numpy array of synthetic data points
            
        Returns:
            Global logit value
        """
        total_real = len(real_data)
        total_synthetic = len(synthetic_data)
        total_points = total_real + total_synthetic
        
        if total_points == 0:
            raise ValueError("No data points available for global logit calculation")
        
        # Global probability
        p_global = total_real / total_points
        
        # Handle edge cases
        if p_global == 0:
            return float('-inf')
        elif p_global == 1:
            return float('inf')
        else:
            return np.log(p_global / (1 - p_global))
    
    def _perform_one_sided_t_tests(self, real_data: np.ndarray, synthetic_data: np.ndarray, 
                                 grid_info: Dict, global_logit: float) -> Tuple[List[Dict], List[Dict]]:
        """
        Perform two one-sided t-tests for each grid cell.
        
        Args:
            real_data: 2D numpy array of real data points
            synthetic_data: 2D numpy array of synthetic data points
            grid_info: Grid information dictionary
            global_logit: Global logit value (a_0)
            
        Returns:
            Tuple of (positive_tests, negative_tests) - lists of test results
        """
        positive_tests = []  # Real overpopulation tests
        negative_tests = []  # Synthetic overpopulation tests
        
        x_grid_size = grid_info['x_grid_size']
        y_grid_size = grid_info['y_grid_size']
        
        for i in range(x_grid_size):
            for j in range(y_grid_size):
                real_count = self._get_cell_count(real_data, i, j, grid_info)
                synthetic_count = self._get_cell_count(synthetic_data, i, j, grid_info)
                total_cell = real_count + synthetic_count
                
                # Only test cells with sufficient data points
                min_points_threshold = 5
                
                if total_cell >= min_points_threshold:
                    p_cell = real_count / total_cell
                    
                    # Calculate cell logit
                    if 0 < p_cell < 1:
                        logit_cell = np.log(p_cell / (1 - p_cell))
                    elif p_cell == 1:
                        logit_cell = float('inf')
                    else:  # p_cell == 0
                        logit_cell = float('-inf')
                    
                    # Calculate difference from global mean
                    if not (np.isinf(logit_cell) or np.isinf(global_logit)):
                        logit_diff = logit_cell - global_logit
                        
                        # Estimate standard error for the cell
                        # Using binomial approximation: SE ≈ sqrt(p*(1-p)/n) transformed to logit scale
                        if 0 < p_cell < 1 and total_cell > 1:
                            # Fisher information for logit transformation
                            fisher_info = total_cell * p_cell * (1 - p_cell)
                            se_logit = 1.0 / np.sqrt(fisher_info) if fisher_info > 0 else 1.0
                            
                            # One-sample t-test against global mean
                            t_stat = logit_diff / se_logit
                            
                            # Degrees of freedom (conservative estimate)
                            df = max(1, total_cell - 1)
                            
                            # Two one-sided tests
                            # Test 1: H0: logit_cell <= global_logit vs H1: logit_cell > global_logit (real overpopulation)
                            p_positive = 1 - stats.t.cdf(t_stat, df)
                            
                            # Test 2: H0: logit_cell >= global_logit vs H1: logit_cell < global_logit (synthetic overpopulation)
                            p_negative = stats.t.cdf(t_stat, df)
                            
                            # Store positive test (real overpopulation)
                            if logit_diff > 0:  # Only consider cells that actually favor real data
                                positive_tests.append({
                                    'cell_x': i,
                                    'cell_y': j,
                                    'real_count': real_count,
                                    'synthetic_count': synthetic_count,
                                    'total_count': total_cell,
                                    'p_cell': p_cell,
                                    'logit_cell': logit_cell,
                                    'logit_diff': logit_diff,
                                    't_stat': t_stat,
                                    'p_value': p_positive,
                                    'test_type': 'real_overpopulation'
                                })
                            
                            # Store negative test (synthetic overpopulation)
                            if logit_diff < 0:  # Only consider cells that actually favor synthetic data
                                negative_tests.append({
                                    'cell_x': i,
                                    'cell_y': j,
                                    'real_count': real_count,
                                    'synthetic_count': synthetic_count,
                                    'total_count': total_cell,
                                    'p_cell': p_cell,
                                    'logit_cell': logit_cell,
                                    'logit_diff': logit_diff,
                                    't_stat': t_stat,
                                    'p_value': p_negative,
                                    'test_type': 'synthetic_overpopulation'
                                })
                    else:
                        # Handle extreme cases (all real or all synthetic)
                        if p_cell == 1:  # All real
                            positive_tests.append({
                                'cell_x': i,
                                'cell_y': j,
                                'real_count': real_count,
                                'synthetic_count': synthetic_count,
                                'total_count': total_cell,
                                'p_cell': p_cell,
                                'logit_cell': logit_cell,
                                'logit_diff': float('inf'),
                                't_stat': float('inf'),
                                'p_value': 0.0,  # Highly significant
                                'test_type': 'real_overpopulation'
                            })
                        elif p_cell == 0:  # All synthetic
                            negative_tests.append({
                                'cell_x': i,
                                'cell_y': j,
                                'real_count': real_count,
                                'synthetic_count': synthetic_count,
                                'total_count': total_cell,
                                'p_cell': p_cell,
                                'logit_cell': logit_cell,
                                'logit_diff': float('-inf'),
                                't_stat': float('-inf'),
                                'p_value': 0.0,  # Highly significant
                                'test_type': 'synthetic_overpopulation'
                            })
        
        return positive_tests, negative_tests
    
    def _apply_fdr_correction(self, tests: List[Dict], alpha: float = 0.05) -> List[Dict]:
        """
        Apply False Discovery Rate correction to p-values.
        
        Args:
            tests: List of test results
            alpha: Significance level for FDR correction
            
        Returns:
            List of test results with FDR correction applied
        """
        if not tests:
            return tests
        
        # Extract p-values
        p_values = [test['p_value'] for test in tests]
        
        # Apply FDR correction
        rejected, p_adjusted = fdrcorrection(p_values, alpha=alpha, method='indep')
        
        # Update test results
        corrected_tests = []
        for i, test in enumerate(tests):
            test_copy = test.copy()
            test_copy['p_value_adjusted'] = p_adjusted[i]
            test_copy['is_significant'] = rejected[i]
            test_copy['fdr_alpha'] = alpha
            corrected_tests.append(test_copy)
        
        return corrected_tests
    
    def _assign_colors(self, positive_tests: List[Dict], negative_tests: List[Dict]) -> Dict:
        """
        Assign colors to significant cells based on test results.
        
        Args:
            positive_tests: FDR-corrected positive test results
            negative_tests: FDR-corrected negative test results
            
        Returns:
            Dictionary mapping cell coordinates to colors
        """
        color_map = {}
        
        # Red for significant real overpopulation
        for test in positive_tests:
            if test.get('is_significant', False):
                cell_key = f"{test['cell_x']},{test['cell_y']}"
                color_map[cell_key] = '#FF0000'  # Red
        
        # Blue for significant synthetic overpopulation
        for test in negative_tests:
            if test.get('is_significant', False):
                cell_key = f"{test['cell_x']},{test['cell_y']}"
                color_map[cell_key] = '#0000FF'  # Blue
        
        return color_map
    
    def _get_cell_indices(self, point: np.ndarray, grid_info: Dict) -> Tuple[int, int]:
        """
        Get grid cell indices for a data point using histogram-based bins.
        
        Args:
            point: 2D point coordinates
            grid_info: Grid information dictionary
            
        Returns:
            Tuple of (x_index, y_index) for the grid cell
        """
        x_idx = np.digitize(point[0], grid_info['x_bins']) - 1
        y_idx = np.digitize(point[1], grid_info['y_bins']) - 1
        
        # Clamp to valid range
        x_idx = max(0, min(x_idx, grid_info['x_grid_size'] - 1))
        y_idx = max(0, min(y_idx, grid_info['y_grid_size'] - 1))
        
        return x_idx, y_idx
    
    def detect_anomalies(self, real_data: List[List[float]], 
                        synthetic_data: List[List[float]],
                        x_bins: int = 20, y_bins: int = 20,
                        fdr_alpha: float = 0.05) -> Dict:
        """
        Detect anomalies using histogram-based grid sizing with statistical testing and FDR correction.
        
        Args:
            real_data: List of real data points (2D coordinates)
            synthetic_data: List of synthetic data points (2D coordinates)
            x_bins: Number of bins for X dimension
            y_bins: Number of bins for Y dimension
            fdr_alpha: Significance level for FDR correction
            
        Returns:
            Dictionary containing anomaly detection results
        """
        try:
            logger.info(f"Starting histogram-based anomaly detection with x_bins={x_bins}, y_bins={y_bins}, fdr_alpha={fdr_alpha}")
            
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
            
            # Step 1: Create histogram-based grid
            self.grid_info = self._create_histogram_based_grid(real_array, synthetic_array, x_bins, y_bins)
            
            # Step 2: Calculate global logit (a_0)
            self.global_logit = self._calculate_global_logit(real_array, synthetic_array)
            
            # Step 3: Perform two one-sided t-tests
            positive_tests, negative_tests = self._perform_one_sided_t_tests(
                real_array, synthetic_array, self.grid_info, self.global_logit
            )
            
            # Step 4: Apply FDR correction separately to each test type
            positive_tests_corrected = self._apply_fdr_correction(positive_tests, fdr_alpha)
            negative_tests_corrected = self._apply_fdr_correction(negative_tests, fdr_alpha)
            
            # Step 5: Assign colors based on significance
            color_map = self._assign_colors(positive_tests_corrected, negative_tests_corrected)
            
            # Combine all significant anomalies
            all_anomalies = []
            for test in positive_tests_corrected:
                if test.get('is_significant', False):
                    cell_key = f"{test['cell_x']},{test['cell_y']}"
                    test['color'] = color_map.get(cell_key, '#CCCCCC')
                    all_anomalies.append(test)
            
            for test in negative_tests_corrected:
                if test.get('is_significant', False):
                    cell_key = f"{test['cell_x']},{test['cell_y']}"
                    test['color'] = color_map.get(cell_key, '#CCCCCC')
                    all_anomalies.append(test)
            
            # Process points with anomaly classification
            real_anomalies = []
            real_normal = []
            synthetic_anomalies = []
            synthetic_normal = []
            
            # Create anomaly cell lookup
            anomaly_cells = set()
            for anomaly in all_anomalies:
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
            
            # Calculate global probability for backwards compatibility
            p_global = total_real / (total_real + total_synthetic)
            
            statistics = {
                "total_real": total_real,
                "total_synthetic": total_synthetic,
                "real_anomalies": real_anomaly_count,
                "synthetic_anomalies": synthetic_anomaly_count,
                "real_anomaly_rate": float(real_anomaly_count / total_real) if total_real > 0 else 0.0,
                "synthetic_anomaly_rate": float(synthetic_anomaly_count / total_synthetic) if total_synthetic > 0 else 0.0,
                "x_grid_size": self.grid_info['x_grid_size'],
                "y_grid_size": self.grid_info['y_grid_size'],
                "total_anomaly_cells": len(all_anomalies),
                "positive_tests_conducted": len(positive_tests),
                "negative_tests_conducted": len(negative_tests),
                "positive_significant": len([t for t in positive_tests_corrected if t.get('is_significant', False)]),
                "negative_significant": len([t for t in negative_tests_corrected if t.get('is_significant', False)]),
                "fdr_alpha": fdr_alpha,
                "global_logit": self.global_logit,
                "p_global": p_global
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
                "anomalies": all_anomalies,  # For backward compatibility
                "cell_anomalies": all_anomalies,
                "positive_tests": positive_tests_corrected,
                "negative_tests": negative_tests_corrected,
                "logit_thresholds": {
                    "global_logit": self.global_logit,
                    "p_global": p_global,
                    "fdr_alpha": fdr_alpha
                },
                "message": f"Detected {real_anomaly_count} real anomalies and {synthetic_anomaly_count} synthetic anomalies using histogram-based statistical testing with FDR correction"
            }
            
            converted_dict = convert_numpy_types(return_dict)
            
            logger.info(f"Histogram-based detection complete: {real_anomaly_count} real, {synthetic_anomaly_count} synthetic anomalies")
            logger.info(f"Positive tests: {len(positive_tests)} conducted, {statistics['positive_significant']} significant")
            logger.info(f"Negative tests: {len(negative_tests)} conducted, {statistics['negative_significant']} significant")
            
            self.is_fitted = True
            
            return converted_dict
            
        except Exception as e:
            logger.error(f"Error in histogram-based detect_anomalies: {str(e)}")
            return {
                "status": "error",
                "message": f"Histogram-based anomaly detection failed: {str(e)}"
            }
    
    def generate_anomaly_csv(self, results: Dict) -> str:
        """
        Generate CSV content for histogram-based anomaly results.
        
        Args:
            results: Anomaly detection results from detect_anomalies
            
        Returns:
            CSV content as string
        """
        try:
            if results.get("status") != "success":
                return "# Histogram-based anomaly detection failed or no results available"
            
            # Create CSV content
            csv_lines = []
            
            # Add summary statistics as comments
            stats = results.get("statistics", {})
            grid_info = results.get("grid_info", {})
            logit_thresholds = results.get("logit_thresholds", {})
            
            csv_lines.append(f"# Histogram-Based Anomaly Detection Results")
            csv_lines.append(f"# Grid Size: {grid_info.get('x_grid_size', 'N/A')}x{grid_info.get('y_grid_size', 'N/A')}")
            
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
            
            # Add global statistics
            p_global = logit_thresholds.get('p_global')
            global_logit = logit_thresholds.get('global_logit')
            fdr_alpha = logit_thresholds.get('fdr_alpha')
            
            csv_lines.append(f"# Global Probability: {format_value(p_global)}")
            csv_lines.append(f"# Global Logit: {format_value(global_logit)}")
            csv_lines.append(f"# FDR Alpha Level: {format_value(fdr_alpha)}")
            csv_lines.append(f"# Total Real Points: {stats.get('total_real', 0)}")
            csv_lines.append(f"# Total Synthetic Points: {stats.get('total_synthetic', 0)}")
            csv_lines.append(f"# Real Anomalies Detected: {stats.get('real_anomalies', 0)}")
            csv_lines.append(f"# Synthetic Anomalies Detected: {stats.get('synthetic_anomalies', 0)}")
            csv_lines.append(f"# Positive Tests Conducted: {stats.get('positive_tests_conducted', 0)}")
            csv_lines.append(f"# Negative Tests Conducted: {stats.get('negative_tests_conducted', 0)}")
            csv_lines.append(f"# Positive Significant: {stats.get('positive_significant', 0)}")
            csv_lines.append(f"# Negative Significant: {stats.get('negative_significant', 0)}")
            csv_lines.append("")
            
            # Add header for cell-level analysis
            csv_lines.append("cell_x,cell_y,real_count,synthetic_count,total_count,p_cell,logit_cell,logit_diff,t_stat,p_value,p_value_adjusted,is_significant,test_type,color")
            
            # Add positive test results
            positive_tests = results.get("positive_tests", [])
            for test in positive_tests:
                p_cell = test.get('p_cell', 0)
                logit_cell = test.get('logit_cell', 0)
                logit_diff = test.get('logit_diff', 0)
                t_stat = test.get('t_stat', 0)
                p_value = test.get('p_value', 1)
                p_value_adj = test.get('p_value_adjusted', 1)
                
                csv_lines.append(f"{test['cell_x']},{test['cell_y']},{test.get('real_count', 0)},{test.get('synthetic_count', 0)},{test.get('total_count', 0)},{format_value(p_cell)},{format_value(logit_cell)},{format_value(logit_diff)},{format_value(t_stat)},{format_value(p_value)},{format_value(p_value_adj)},{test.get('is_significant', False)},{test.get('test_type', 'unknown')},{test.get('color', '#CCCCCC')}")
            
            # Add negative test results
            negative_tests = results.get("negative_tests", [])
            for test in negative_tests:
                p_cell = test.get('p_cell', 0)
                logit_cell = test.get('logit_cell', 0)
                logit_diff = test.get('logit_diff', 0)
                t_stat = test.get('t_stat', 0)
                p_value = test.get('p_value', 1)
                p_value_adj = test.get('p_value_adjusted', 1)
                
                csv_lines.append(f"{test['cell_x']},{test['cell_y']},{test.get('real_count', 0)},{test.get('synthetic_count', 0)},{test.get('total_count', 0)},{format_value(p_cell)},{format_value(logit_cell)},{format_value(logit_diff)},{format_value(t_stat)},{format_value(p_value)},{format_value(p_value_adj)},{test.get('is_significant', False)},{test.get('test_type', 'unknown')},{test.get('color', '#CCCCCC')}")
            
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
anomaly_service = HistogramBasedAnomalyDetectionService()