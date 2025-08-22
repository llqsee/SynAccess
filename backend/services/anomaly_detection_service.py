import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import logging
from typing import Dict, List, Tuple, Optional
import json
from scipy import stats
from scipy.stats import binomtest
from statsmodels.stats.multitest import fdrcorrection

# GPU support imports
try:
    import cupy as cp
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False

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
    Advanced service for detecting anomalies using histogram-based grid sizing with binomial proportion tests.
    
    This service implements:
    1. Histogram-based grid cell determination for X and Y dimensions separately
    2. Two one-sided binomial proportion tests (real vs synthetic overpopulation)
    3. False Discovery Rate (FDR) correction applied separately to positive and negative tests
    4. Binary red/blue coloring based on FDR-corrected significance
    """
    
    def __init__(self):
        self.grid_info = None
        self.global_proportion = None
        self.is_fitted = False
        logger.info(f"Anomaly Detection Service initialized - GPU Available: {GPU_AVAILABLE}")
    
    def _should_use_gpu(self, data_size: int, threshold: int = 500) -> bool:
        """Determine if GPU acceleration should be used based on data size."""
        return GPU_AVAILABLE and data_size >= threshold
    
    def _compute_histogram_gpu(self, data: np.ndarray, bins: int) -> Tuple[np.ndarray, np.ndarray]:
        """Compute histogram using GPU acceleration."""
        try:
            if self._should_use_gpu(len(data)):
                data_gpu = cp.asarray(data)
                # GPU-accelerated histogram computation
                hist, bin_edges = cp.histogram(data_gpu, bins=bins)
                return cp.asnumpy(hist), cp.asnumpy(bin_edges)
            else:
                # CPU fallback
                return np.histogram(data, bins=bins)
        except Exception as e:
            logger.warning(f"GPU histogram computation failed, falling back to CPU: {e}")
            return np.histogram(data, bins=bins)
    
    def _compute_grid_assignment_gpu(self, data: np.ndarray, x_bin_edges: np.ndarray, y_bin_edges: np.ndarray) -> np.ndarray:
        """Compute grid cell assignments using GPU acceleration."""
        try:
            if self._should_use_gpu(len(data)):
                data_gpu = cp.asarray(data)
                x_edges_gpu = cp.asarray(x_bin_edges)
                y_edges_gpu = cp.asarray(y_bin_edges)
                
                # GPU-accelerated digitization
                x_indices = cp.digitize(data_gpu[:, 0], x_edges_gpu) - 1
                y_indices = cp.digitize(data_gpu[:, 1], y_edges_gpu) - 1
                
                # Clamp to valid range
                x_indices = cp.clip(x_indices, 0, len(x_edges_gpu) - 2)
                y_indices = cp.clip(y_indices, 0, len(y_edges_gpu) - 2)
                
                return cp.asnumpy(cp.column_stack([x_indices, y_indices]))
            else:
                # CPU fallback
                x_indices = np.digitize(data[:, 0], x_bin_edges) - 1
                y_indices = np.digitize(data[:, 1], y_bin_edges) - 1
                
                # Clamp to valid range
                x_indices = np.clip(x_indices, 0, len(x_bin_edges) - 2)
                y_indices = np.clip(y_indices, 0, len(y_bin_edges) - 2)
                
                return np.column_stack([x_indices, y_indices])
        except Exception as e:
            logger.warning(f"GPU grid assignment failed, falling back to CPU: {e}")
            # CPU fallback
            x_indices = np.digitize(data[:, 0], x_bin_edges) - 1
            y_indices = np.digitize(data[:, 1], y_bin_edges) - 1
            
            # Clamp to valid range
            x_indices = np.clip(x_indices, 0, len(x_bin_edges) - 2)
            y_indices = np.clip(y_indices, 0, len(y_bin_edges) - 2)
            
            return np.column_stack([x_indices, y_indices])
        
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
        
        # Use GPU-accelerated histogram function to get optimal bin edges
        # This automatically handles data distribution for better grid sizing
        _, x_bin_edges = self._compute_histogram_gpu(x_coords, x_bins)
        _, y_bin_edges = self._compute_histogram_gpu(y_coords, y_bins)
        
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
    
    def _calculate_global_proportion(self, real_data: np.ndarray, synthetic_data: np.ndarray) -> float:
        """
        Calculate the global proportion of real data points.
        
        Args:
            real_data: 2D numpy array of real data points
            synthetic_data: 2D numpy array of synthetic data points
            
        Returns:
            Global proportion of real data points
        """
        total_real = len(real_data)
        total_synthetic = len(synthetic_data)
        total_points = total_real + total_synthetic
        
        if total_points == 0:
            raise ValueError("No data points available for global proportion calculation")
        
        return total_real / total_points
    
    def _perform_binomial_proportion_tests(self, real_data: np.ndarray, synthetic_data: np.ndarray, 
                                         grid_info: Dict, global_proportion: float) -> Tuple[List[Dict], List[Dict]]:
        """
        Perform two one-sided binomial proportion tests for each grid cell.
        
        Args:
            real_data: 2D numpy array of real data points
            synthetic_data: 2D numpy array of synthetic data points
            grid_info: Grid information dictionary
            global_proportion: Global proportion of real data points
            
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
                    cell_proportion = real_count / total_cell
                    
                    # Perform binomial proportion tests
                    # Test A: cell_proportion > global_proportion (real overpopulation)
                    test_a = binomtest(real_count, total_cell, p=global_proportion, alternative='greater')
                    
                    # Test B: cell_proportion < global_proportion (synthetic overpopulation)
                    test_b = binomtest(real_count, total_cell, p=global_proportion, alternative='less')
                    
                    # Store positive test (real overpopulation)
                    if cell_proportion > global_proportion:  # Only consider cells that actually favor real data
                        positive_tests.append({
                            'cell_x': i,
                            'cell_y': j,
                            'real_count': real_count,
                            'synthetic_count': synthetic_count,
                            'total_count': total_cell,
                            'cell_proportion': cell_proportion,
                            'global_proportion': global_proportion,
                            'proportion_diff': cell_proportion - global_proportion,
                            'p_value': test_a.pvalue,
                            'test_type': 'real_overpopulation'
                        })
                    
                    # Store negative test (synthetic overpopulation)
                    if cell_proportion < global_proportion:  # Only consider cells that actually favor synthetic data
                        negative_tests.append({
                            'cell_x': i,
                            'cell_y': j,
                            'real_count': real_count,
                            'synthetic_count': synthetic_count,
                            'total_count': total_cell,
                            'cell_proportion': cell_proportion,
                            'global_proportion': global_proportion,
                            'proportion_diff': cell_proportion - global_proportion,
                            'p_value': test_b.pvalue,
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
        try:
            if self._should_use_gpu(1):  # Even single points can benefit from GPU if available
                point_gpu = cp.asarray(point.reshape(1, -1))
                x_edges_gpu = cp.asarray(grid_info['x_bins'])
                y_edges_gpu = cp.asarray(grid_info['y_bins'])
                
                x_idx = int(cp.digitize(point_gpu[0, 0], x_edges_gpu) - 1)
                y_idx = int(cp.digitize(point_gpu[0, 1], y_edges_gpu) - 1)
            else:
                x_idx = np.digitize(point[0], grid_info['x_bins']) - 1
                y_idx = np.digitize(point[1], grid_info['y_bins']) - 1
            
            # Clamp to valid range
            x_idx = max(0, min(x_idx, grid_info['x_grid_size'] - 1))
            y_idx = max(0, min(y_idx, grid_info['y_grid_size'] - 1))
            
            return x_idx, y_idx
        except Exception as e:
            logger.warning(f"GPU cell index computation failed, falling back to CPU: {e}")
            # CPU fallback
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
        Detect anomalies using histogram-based grid sizing with binomial proportion tests and FDR correction.
        
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
            
            # Step 2: Calculate global proportion
            self.global_proportion = self._calculate_global_proportion(real_array, synthetic_array)
            
            # Step 3: Perform two one-sided binomial proportion tests
            positive_tests, negative_tests = self._perform_binomial_proportion_tests(
                real_array, synthetic_array, self.grid_info, self.global_proportion
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
            
            # Process points with anomaly classification using GPU acceleration
            real_anomalies = []
            real_normal = []
            synthetic_anomalies = []
            synthetic_normal = []
            
            # Create anomaly cell lookup
            anomaly_cells = set()
            for anomaly in all_anomalies:
                anomaly_cells.add(f"{anomaly['cell_x']},{anomaly['cell_y']}")
            
            # Process real data points with GPU acceleration
            real_cell_assignments = self._compute_grid_assignment_gpu(real_array, self.grid_info['x_bins'], self.grid_info['y_bins'])
            
            for i, (point, cell_assignment) in enumerate(zip(real_array, real_cell_assignments)):
                x_idx, y_idx = int(cell_assignment[0]), int(cell_assignment[1])
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
            
            # Process synthetic data points with GPU acceleration
            synth_cell_assignments = self._compute_grid_assignment_gpu(synthetic_array, self.grid_info['x_bins'], self.grid_info['y_bins'])
            
            for i, (point, cell_assignment) in enumerate(zip(synthetic_array, synth_cell_assignments)):
                x_idx, y_idx = int(cell_assignment[0]), int(cell_assignment[1])
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
                "x_grid_size": self.grid_info['x_grid_size'],
                "y_grid_size": self.grid_info['y_grid_size'],
                "total_anomaly_cells": len(all_anomalies),
                "positive_tests_conducted": len(positive_tests),
                "negative_tests_conducted": len(negative_tests),
                "positive_significant": len([t for t in positive_tests_corrected if t.get('is_significant', False)]),
                "negative_significant": len([t for t in negative_tests_corrected if t.get('is_significant', False)]),
                "fdr_alpha": fdr_alpha,
                "global_proportion": self.global_proportion
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
                "proportion_thresholds": {
                    "global_proportion": self.global_proportion,
                    "fdr_alpha": fdr_alpha
                },
                "message": f"Detected {real_anomaly_count} real anomalies and {synthetic_anomaly_count} synthetic anomalies using histogram-based binomial proportion tests with FDR correction"
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
            proportion_thresholds = results.get("proportion_thresholds", {})
            
            csv_lines.append(f"# Histogram-Based Anomaly Detection Results (Binomial Proportion Tests)")
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
            global_proportion = proportion_thresholds.get('global_proportion')
            fdr_alpha = proportion_thresholds.get('fdr_alpha')
            
            csv_lines.append(f"# Global Proportion: {format_value(global_proportion)}")
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
            csv_lines.append("cell_x,cell_y,real_count,synthetic_count,total_count,cell_proportion,global_proportion,proportion_diff,p_value,p_value_adjusted,is_significant,test_type,color")
            
            # Add positive test results
            positive_tests = results.get("positive_tests", [])
            for test in positive_tests:
                cell_proportion = test.get('cell_proportion', 0)
                global_proportion = test.get('global_proportion', 0)
                proportion_diff = test.get('proportion_diff', 0)
                p_value = test.get('p_value', 1)
                p_value_adj = test.get('p_value_adjusted', 1)
                
                csv_lines.append(f"{test['cell_x']},{test['cell_y']},{test.get('real_count', 0)},{test.get('synthetic_count', 0)},{test.get('total_count', 0)},{format_value(cell_proportion)},{format_value(global_proportion)},{format_value(proportion_diff)},{format_value(p_value)},{format_value(p_value_adj)},{test.get('is_significant', False)},{test.get('test_type', 'unknown')},{test.get('color', '#CCCCCC')}")
            
            # Add negative test results
            negative_tests = results.get("negative_tests", [])
            for test in negative_tests:
                cell_proportion = test.get('cell_proportion', 0)
                global_proportion = test.get('global_proportion', 0)
                proportion_diff = test.get('proportion_diff', 0)
                p_value = test.get('p_value', 1)
                p_value_adj = test.get('p_value_adjusted', 1)
                
                csv_lines.append(f"{test['cell_x']},{test['cell_y']},{test.get('real_count', 0)},{test.get('synthetic_count', 0)},{test.get('total_count', 0)},{format_value(cell_proportion)},{format_value(global_proportion)},{format_value(proportion_diff)},{format_value(p_value)},{format_value(p_value_adj)},{test.get('is_significant', False)},{test.get('test_type', 'unknown')},{test.get('color', '#CCCCCC')}")
            
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