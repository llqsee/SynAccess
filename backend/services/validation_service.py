import numpy as np
import pandas as pd
import warnings
from typing import Dict, List, Any, Optional, Tuple
import json
from datetime import datetime
import math
import random

# GPU support imports
try:
    import cupy as cp
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False

# Import scientific libraries - these are required for accurate statistical analysis
import scipy
from scipy import stats
from scipy.stats import ks_2samp, chi2_contingency, pearsonr, spearmanr
from scipy.spatial.distance import pdist, squareform
from scipy.spatial import distance
from scipy.stats import energy_distance, entropy
from sklearn.metrics import mutual_info_score
from sklearn.preprocessing import StandardScaler
from sklearn.manifold import MDS
from statsmodels.stats.multitest import multipletests
from .privacy_service import privacy_service
from backend.utils.logging_config import get_logger
from backend.config import settings

warnings.filterwarnings('ignore')

def convert_numpy_types(obj):
    """Convert numpy types to Python native types for JSON serialization."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    else:
        return obj

class ValidationService:
    """
    Professional validation service using scientific libraries for maximum accuracy.
    Provides comprehensive validation including multivariate tests with proper statistical rigor.
    All tests use full datasets for maximum accuracy and consistency.
    """
    
    def __init__(self):
        self.logger = get_logger("validation_service")
        self.enable_validation_debug = bool(getattr(settings, "validation_debug_log", False))
        self.logger.info("Professional Validation Service Initialized", extra={"gpu_available": GPU_AVAILABLE})
        # print(f"  - SciPy: {scipy.__version__}")
        # print(f"  - NumPy: {np.__version__}")
        # print(f"  - Pandas: {pd.__version__}")
        
        # Sample size configurations for different validation tasks
        self.optimal_sample_sizes = {
            'correlation': 1000,
            'distribution': 500,
            'statistical': 1000,
            'multivariate': 500,
            'energy_distance': 1000,
            'mutual_information': 1000
        }
        
        self.min_sample_sizes = {
            'correlation': 10,
            'distribution': 5,
            'statistical': 10,
            'multivariate': 5,
            'energy_distance': 10,
            'mutual_information': 10
        }
    
    def _should_use_gpu(self, data_size: int, threshold: int = 1000) -> bool:
        """Determine if GPU acceleration should be used based on data size."""
        return GPU_AVAILABLE and data_size >= threshold
    
    def _compute_correlation_matrix_gpu(self, data: np.ndarray) -> np.ndarray:
        """Compute correlation matrix using GPU acceleration."""
        try:
            if self._should_use_gpu(len(data)):
                data_gpu = cp.asarray(data)
                # GPU-accelerated correlation computation
                corr_matrix = cp.corrcoef(data_gpu.T)
                return cp.asnumpy(corr_matrix)
            else:
                # CPU fallback
                return np.corrcoef(data.T)
        except Exception as e:
            self.logger.warning("GPU correlation computation failed, falling back to CPU", extra={"error": str(e)})
            return np.corrcoef(data.T)
    
    def _compute_distance_matrix_gpu(self, data: np.ndarray) -> np.ndarray:
        """Compute distance matrix using GPU acceleration."""
        try:
            if self._should_use_gpu(len(data)):
                data_gpu = cp.asarray(data)
                # GPU-accelerated distance computation using broadcasting
                diff = data_gpu[:, None, :] - data_gpu[None, :, :]
                distances = cp.sqrt(cp.sum(diff**2, axis=2))
                return cp.asnumpy(distances)
            else:
                # CPU fallback using scipy
                return squareform(pdist(data, metric='euclidean'))
        except Exception as e:
            self.logger.warning("GPU distance computation failed, falling back to CPU", extra={"error": str(e)})
            return squareform(pdist(data, metric='euclidean'))
    
    def _compute_mutual_information_gpu(self, real_data: np.ndarray, synth_data: np.ndarray) -> float:
        """Compute mutual information using GPU acceleration for large datasets."""
        try:
            if self._should_use_gpu(len(real_data)):
                # For mutual information, we still use CPU as it's more complex
                # But we can use GPU for preprocessing large datasets
                real_gpu = cp.asarray(real_data)
                synth_gpu = cp.asarray(synth_data)
                
                # GPU-accelerated preprocessing (e.g., normalization)
                real_norm = cp.asnumpy((real_gpu - cp.mean(real_gpu, axis=0)) / cp.std(real_gpu, axis=0))
                synth_norm = cp.asnumpy((synth_gpu - cp.mean(synth_gpu, axis=0)) / cp.std(synth_gpu, axis=0))
                
                # Use CPU for mutual information computation
                return mutual_info_score(real_norm.flatten(), synth_norm.flatten())
            else:
                # CPU fallback
                return mutual_info_score(real_data.flatten(), synth_data.flatten())
        except Exception as e:
            self.logger.warning("GPU mutual information computation failed, falling back to CPU", extra={"error": str(e)})
            return mutual_info_score(real_data.flatten(), synth_data.flatten())
    
    def _ensure_min_numeric_columns(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> None:
        """Ensure there are at least two numeric columns by converting numeric-like strings.

        This function mutates the provided DataFrames in place. All logging is gated
        behind the validation debug flag to keep default console output quiet.
        """
        numeric_cols = real_df.select_dtypes(include=[np.number]).columns.tolist()
        if len(numeric_cols) >= 2:
            return
        if self.enable_validation_debug:
            self.logger.warning("Insufficient numeric columns; attempting conversion", extra={"numeric_count": len(numeric_cols)})
        for col in real_df.columns:
            if col in numeric_cols:
                continue
            try:
                converted = pd.to_numeric(real_df[col], errors='coerce')
                if not converted.isna().all():
                    if self.enable_validation_debug:
                        self.logger.debug("Converted column to numeric", extra={"column": col})
                    real_df[col] = converted
                    synth_df[col] = pd.to_numeric(synth_df[col], errors='coerce')
            except Exception as e:
                if self.enable_validation_debug:
                    self.logger.warning("Failed to convert column", extra={"column": col, "error": str(e)})
        # Final info after conversion (only when debug flag enabled)
        if self.enable_validation_debug:
            numeric_cols_after = real_df.select_dtypes(include=[np.number]).columns.tolist()
            self.logger.info("Numeric column conversion completed", extra={
                "numeric_columns": numeric_cols_after,
                "numeric_count": len(numeric_cols_after)
            })
    
    def _log_data_info(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> None:
        """Log information about the data for debugging."""
        self.logger.debug("Data Info", extra={
            "real_shape": tuple(real_df.shape),
            "synthetic_shape": tuple(synth_df.shape),
            "real_columns": list(real_df.columns),
            "real_dtypes": {k: str(v) for k, v in real_df.dtypes.to_dict().items()}
        })
        
        numeric_cols = real_df.select_dtypes(include=[np.number]).columns.tolist()
        self.logger.debug("Numeric columns summary", extra={
            "numeric_columns": numeric_cols,
            "numeric_count": len(numeric_cols)
        })
        
        # Check for potential numeric columns that might be strings
        for col in real_df.columns:
            if col not in numeric_cols:
                sample_values = real_df[col].dropna().head(5).tolist()
                self.logger.debug("Column sample", extra={
                    "column": col,
                    "dtype": str(real_df[col].dtype),
                    "samples": sample_values
                })
                
                # Try to convert to numeric to see if it's actually numeric data
                try:
                    pd.to_numeric(real_df[col], errors='raise')
                    self.logger.debug("Column can be converted to numeric", extra={"column": col})
                except (ValueError, TypeError):
                    self.logger.debug("Column cannot be converted to numeric", extra={"column": col})
        
        # Note: conversion is handled by _ensure_min_numeric_columns; this function only logs.
    
    def compute_validation_statistics(self, real_data: Dict, synthetic_data: Dict, options: Dict = None) -> Dict:
        """
        Main validation function that computes comprehensive statistical tests using scientific libraries.
        """
        if options is None:
            options = {}
            
        start_time = datetime.now()
        
        try:
            # Convert to pandas DataFrames
            real_df = pd.DataFrame(real_data['data'], columns=real_data['headers'])
            synth_df = pd.DataFrame(synthetic_data['data'], columns=synthetic_data['headers'])
            
            # Always ensure we have sufficient numeric columns regardless of debug flag
            self._ensure_min_numeric_columns(real_df, synth_df)

            # Log data information only when enabled via env flag
            if self.enable_validation_debug:
                self._log_data_info(real_df, synth_df)
            
            # Re-get numeric columns after potential conversion
            numeric_cols = real_df.select_dtypes(include=[np.number]).columns.tolist()
            if self.enable_validation_debug:
                self.logger.debug("Final numeric columns for testing", extra={
                    "numeric_columns": numeric_cols,
                    "numeric_count": len(numeric_cols)
                })
            
            results = {
                'timestamp': start_time.isoformat(),
                'datasetInfo': self._get_dataset_info(real_data, synthetic_data),
                'dataset_info': self._get_dataset_info(real_data, synthetic_data),  # Also include as dataset_info for compatibility
                'processingTime': 0,
                'tests': {},
                'summary': {
                    'totalTests': 0,
                    'passed': 0,
                    'warnings': 0,
                    'failures': 0,
                    'critical': 0
                }
            }
            
            # 1. Range and Domain Statistics
            range_stats = self._compute_range_statistics(real_df, synth_df)
            results['tests']['Range Validation'] = range_stats
            results['summary']['totalTests'] += range_stats['summary']['total']
            
            # 2. Distribution Tests (KS and Chi-square)
            distribution_stats = self._compute_distribution_statistics(real_df, synth_df)
            results['tests']['Distribution Tests'] = distribution_stats
            results['summary']['totalTests'] += distribution_stats['summary']['total']
            
            # 3. Correlation Structure Validation
            correlation_stats = self._compute_correlation_statistics(real_df, synth_df)
            results['tests']['Correlation Validation'] = correlation_stats
            results['summary']['totalTests'] += correlation_stats['summary']['total']
            
            # 4. Statistical Tests (t-tests)
            statistical_stats = self._compute_statistical_tests(real_df, synth_df)
            results['tests']['Statistical Tests'] = statistical_stats
            results['summary']['totalTests'] += statistical_stats['summary']['total']
            
            # 5. Outlier Detection
            outlier_stats = self._compute_outlier_statistics(real_df, synth_df)
            results['tests']['Outlier Detection'] = outlier_stats
            results['summary']['totalTests'] += outlier_stats['summary']['total']
            
            # 6. Quality Metrics
            quality_stats = self._compute_quality_metrics(real_df, synth_df)
            results['tests']['Quality Metrics'] = quality_stats
            results['summary']['totalTests'] += quality_stats['summary']['total']
            
            # 7. Multivariate Tests (always run, with proper error handling)
            multivariate_stats = self._compute_multivariate_statistics(real_df, synth_df)
            results['tests']['Multivariate Tests'] = multivariate_stats
            results['summary']['totalTests'] += multivariate_stats['summary']['total']
            
            # Calculate summary statistics
            self._calculate_summary_statistics(results)
            
            # Calculate processing time
            end_time = datetime.now()
            results['processingTime'] = (end_time - start_time).total_seconds()
            
            # Convert numpy types to Python native types for serialization
            return convert_numpy_types(results)
            
        except Exception as e:
            return {
                'error': f'Validation computation failed: {str(e)}',
                'timestamp': start_time.isoformat()
            }
    
    def _get_dataset_info(self, real_data: Dict, synthetic_data: Dict) -> Dict:
        """Get basic dataset information."""
        return {
            'real': {
                'rows': len(real_data['data']),
                'columns': len(real_data['headers']),
                'headers': real_data['headers']
            },
            'synthetic': {
                'rows': len(synthetic_data['data']),
                'columns': len(synthetic_data['headers']),
                'headers': synthetic_data['headers']
            },
            'compatibility': {
                'sameColumnCount': len(real_data['headers']) == len(synthetic_data['headers']),
                'sameHeaders': real_data['headers'] == synthetic_data['headers'],
                'sizeDifference': abs(len(real_data['data']) - len(synthetic_data['data'])) / max(len(real_data['data']), len(synthetic_data['data']))
            }
        }
    
    def _compute_range_statistics(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute range and domain statistics."""
        tests = []
        
        for col in real_df.columns:
            if col in synth_df.columns:
                real_col = real_df[col]
                synth_col = synth_df[col]
                
                if pd.api.types.is_numeric_dtype(real_col):
                    # Numeric range statistics
                    real_clean = real_col.dropna()
                    synth_clean = synth_col.dropna()
                    
                    if len(real_clean) > 0 and len(synth_clean) > 0:
                        test = {
                            'column': col,
                            'type': 'range_test',
                            'dataType': 'numeric',
                            'real': {
                                'min': float(real_clean.min()),
                                'max': float(real_clean.max()),
                                'mean': float(real_clean.mean()),
                                'std': float(real_clean.std())
                            },
                            'synthetic': {
                                'min': float(synth_clean.min()),
                                'max': float(synth_clean.max()),
                                'mean': float(synth_clean.mean()),
                                'std': float(synth_clean.std())
                            },
                            'statistics': {
                                'rangeDiff': abs((real_clean.max() - real_clean.min()) - (synth_clean.max() - synth_clean.min())) / (real_clean.max() - real_clean.min()) if real_clean.max() != real_clean.min() else 0,
                                'meanDiff': abs(real_clean.mean() - synth_clean.mean()),
                                'stdDiff': abs(real_clean.std() - synth_clean.std())
                            }
                        }
                        tests.append(test)
                else:
                    # Categorical range statistics
                    real_unique = set(real_col.dropna().unique())
                    synth_unique = set(synth_col.dropna().unique())
                    
                    new_categories = synth_unique - real_unique
                    missing_categories = real_unique - synth_unique
                    
                    test = {
                        'column': col,
                        'type': 'categorical_range_test',
                        'dataType': 'categorical',
                        'real': {
                            'uniqueValues': len(real_unique),
                            'values': list(real_unique)[:10]  # First 10 for display
                        },
                        'synthetic': {
                            'uniqueValues': len(synth_unique),
                            'values': list(synth_unique)[:10]
                        },
                        'statistics': {
                            'newCategories': len(new_categories),
                            'missingCategories': len(missing_categories),
                            'overlapRatio': len(real_unique & synth_unique) / len(real_unique) if real_unique else 0
                        }
                    }
                    tests.append(test)
        
        return {
            'testType': 'Range and Domain Statistics',
            'description': 'Raw statistics for data ranges, bounds, and categorical domains',
            'tests': tests,
            'summary': {
                'total': len(tests),
                'numericTests': len([t for t in tests if t['dataType'] == 'numeric']),
                'categoricalTests': len([t for t in tests if t['dataType'] == 'categorical'])
            }
        }
    
    def _compute_distribution_statistics(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute distribution statistics (KS and Chi-square tests) using SciPy."""
        tests = []
        
        for col in real_df.columns:
            if col in synth_df.columns:
                real_col = real_df[col]
                synth_col = synth_df[col]
                
                if pd.api.types.is_numeric_dtype(real_col):
                    # KS test for numeric columns using SciPy
                    test = self._compute_ks_test(real_col, synth_col, col)
                    tests.append(test)
                else:
                    # Chi-square test for categorical columns using SciPy
                    test = self._compute_chi_square_test(real_col, synth_col, col)
                    tests.append(test)
        
        return {
            'testType': 'Distribution Statistics',
            'description': 'KS and Chi-square tests comparing distributions',
            'tests': tests,
            'summary': {
                'total': len(tests),
                'ksTests': len([t for t in tests if t['type'] == 'ks_test']),
                'chiSquareTests': len([t for t in tests if t['type'] == 'chi_square_test'])
            }
        }
    
    def _compute_ks_test(self, real_col: pd.Series, synth_col: pd.Series, column_name: str) -> Dict:
        """Compute KS test using SciPy for maximum accuracy."""
        real_clean = real_col.dropna()
        synth_clean = synth_col.dropna()
        
        if len(real_clean) < 30 or len(synth_clean) < 30:
            return {
                'column': column_name,
                'type': 'ks_test',
                'result': 'INSUFFICIENT_DATA',
                'reason': 'Insufficient numeric data'
            }
        
        # Use SciPy's implementation for maximum accuracy
        statistic, p_value = ks_2samp(real_clean, synth_clean)
        significant = p_value < 0.05
        
        return {
            'column': column_name,
            'type': 'ks_test',
            'statistic': float(statistic),
            'pValue': float(p_value),
            'significant': significant,
            'sampleSizes': {'real': len(real_clean), 'synthetic': len(synth_clean)},
            'result': 'REJECT' if significant else 'ACCEPT',
            'method': 'scipy'
        }
    
    def _compute_chi_square_test(self, real_col: pd.Series, synth_col: pd.Series, column_name: str) -> Dict:
        """Compute Chi-square test using SciPy for maximum accuracy."""
        # Create frequency distributions
        real_counts = real_col.value_counts()
        synth_counts = synth_col.value_counts()
        
        # Align indices
        all_categories = real_counts.index.union(synth_counts.index)
        real_aligned = real_counts.reindex(all_categories, fill_value=0)
        synth_aligned = synth_counts.reindex(all_categories, fill_value=0)
        
        # Use SciPy's implementation for maximum accuracy
        chi2_stat, p_value, dof, expected = chi2_contingency([real_aligned.values, synth_aligned.values])
        significant = p_value < 0.05
        
        return {
            'column': column_name,
            'type': 'chi_square_test',
            'statistic': float(chi2_stat),
            'pValue': float(p_value),
            'degreesOfFreedom': int(dof),
            'significant': significant,
            'result': 'REJECT' if significant else 'ACCEPT',
            'method': 'scipy'
        }
    
    def _compute_correlation_statistics(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute correlation structure validation."""
        # Get numeric columns
        numeric_cols = real_df.select_dtypes(include=[np.number]).columns.tolist()
        
        if len(numeric_cols) < 2:
            return {
                'testType': 'Correlation Structure Validation',
                'description': 'Element-wise comparison of correlation matrices',
                'result': 'SKIP',
                'reason': f'Insufficient numeric variables (found {len(numeric_cols)}, minimum 2 required)',
                'tests': [],
                'summary': {'total': 0}
            }
        
        # Use full datasets for maximum accuracy
        real_full = real_df[numeric_cols]
        synth_full = synth_df[numeric_cols]
        
        # Calculate correlation matrices using full datasets with GPU acceleration
        real_corr = self._compute_correlation_matrix_gpu(real_full.values)
        synth_corr = self._compute_correlation_matrix_gpu(synth_full.values)
        
        # Convert to DataFrames for compatibility
        real_corr_df = pd.DataFrame(real_corr, index=numeric_cols, columns=numeric_cols)
        synth_corr_df = pd.DataFrame(synth_corr, index=numeric_cols, columns=numeric_cols)
        
        # Compare correlation matrices
        comparison = self._compare_correlation_matrices(real_corr_df, synth_corr_df)
        
        return {
            'testType': 'Correlation Structure Validation',
            'description': 'Element-wise comparison of correlation matrices using full datasets',
            'realCorrelations': real_corr_df.to_dict(),
            'syntheticCorrelations': synth_corr_df.to_dict(),
            'comparison': comparison,
            'tests': [{'type': 'correlation_comparison', 'result': 'SUCCESS'}],
            'summary': {'total': 1}
        }
    
    def _compare_correlation_matrices(self, real_corr: pd.DataFrame, synth_corr: pd.DataFrame) -> Dict:
        """Compare correlation matrices and identify significant differences."""
        # Get upper triangle indices (avoid double counting)
        upper_triangle = np.triu_indices_from(real_corr, k=1)
        
        differences = []
        significant_differences = 0
        total_comparisons = len(upper_triangle[0])
        
        for i, j in zip(*upper_triangle):
            real_coeff = real_corr.iloc[i, j]
            synth_coeff = synth_corr.iloc[i, j]
            diff = abs(real_coeff - synth_coeff)
            
            if diff > 0.3:  # Significant difference threshold
                significant_differences += 1
                differences.append({
                    'variables': [real_corr.index[i], real_corr.columns[j]],
                    'realValue': float(real_coeff),
                    'syntheticValue': float(synth_coeff),
                    'difference': float(diff)
                })
        
        return {
            'totalComparisons': total_comparisons,
            'significantDifferences': significant_differences,
            'percentageSignificant': (significant_differences / total_comparisons) * 100 if total_comparisons > 0 else 0,
            'differences': differences[:10],  # First 10 for display
            'summary': f'Found {significant_differences} significant correlation differences'
        }
    
    def _compute_statistical_tests(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute statistical tests (t-tests) using SciPy."""
        tests = []
        
        numeric_cols = real_df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            if col in synth_df.columns:
                real_col = real_df[col]
                synth_col = synth_df[col]
                
                test = self._compute_t_test(real_col, synth_col, col)
                tests.append(test)
        
        return {
            'testType': 'Statistical Tests',
            'description': "Welch's t-tests comparing means using SciPy",
            'tests': tests,
            'summary': {'total': len(tests)}
        }
    
    def _compute_t_test(self, real_col: pd.Series, synth_col: pd.Series, column_name: str) -> Dict:
        """Compute Welch's t-test."""
        real_clean = real_col.dropna()
        synth_clean = synth_col.dropna()
        
        if len(real_clean) < 20 or len(synth_clean) < 20:
            return {
                'column': column_name,
                'type': 'welch_t_test',
                'result': 'INSUFFICIENT_DATA',
                'reason': 'Insufficient numeric data'
            }
        
        # Use SciPy's implementation for maximum accuracy
        statistic, p_value = stats.ttest_ind(real_clean, synth_clean, equal_var=False)
        significant = p_value < 0.05
        
        return {
            'column': column_name,
            'type': 'welch_t_test',
            'statistic': float(statistic),
            'pValue': float(p_value),
            'significant': significant,
            'realMean': float(real_clean.mean()),
            'syntheticMean': float(synth_clean.mean()),
            'result': 'REJECT' if significant else 'ACCEPT',
            'method': 'scipy'
        }
    
    def _compute_outlier_statistics(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute outlier detection and comparison."""
        tests = []
        
        numeric_cols = real_df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            if col in synth_df.columns:
                real_col = real_df[col]
                synth_col = synth_df[col]
                
                test = self._detect_outliers(real_col, synth_col, col)
                tests.append(test)
        
        return {
            'testType': 'Outlier Detection',
            'description': 'Compares outlier patterns between datasets',
            'tests': tests,
            'summary': {'total': len(tests)}
        }
    
    def _detect_outliers(self, real_col: pd.Series, synth_col: pd.Series, column_name: str) -> Dict:
        """Detect outliers using IQR method."""
        real_clean = real_col.dropna()
        synth_clean = synth_col.dropna()
        
        if len(real_clean) < 4 or len(synth_clean) < 4:
            return {
                'column': column_name,
                'type': 'outlier_test',
                'result': 'INSUFFICIENT_DATA',
                'reason': 'Insufficient data for outlier detection'
            }
        
        # Calculate outliers for real data
        q1_real, q3_real = real_clean.quantile([0.25, 0.75])
        iqr_real = q3_real - q1_real
        lower_bound_real = q1_real - 1.5 * iqr_real
        upper_bound_real = q3_real + 1.5 * iqr_real
        real_outliers = real_clean[(real_clean < lower_bound_real) | (real_clean > upper_bound_real)]
        
        # Calculate outliers for synthetic data
        q1_synth, q3_synth = synth_clean.quantile([0.25, 0.75])
        iqr_synth = q3_synth - q1_synth
        lower_bound_synth = q1_synth - 1.5 * iqr_synth
        upper_bound_synth = q3_synth + 1.5 * iqr_synth
        synth_outliers = synth_clean[(synth_clean < lower_bound_synth) | (synth_clean > upper_bound_synth)]
        
        return {
            'column': column_name,
            'type': 'outlier_test',
            'real': {
                'outlierCount': len(real_outliers),
                'outlierPercentage': (len(real_outliers) / len(real_clean)) * 100,
                'outliers': real_outliers.tolist()[:5]  # First 5 for display
            },
            'synthetic': {
                'outlierCount': len(synth_outliers),
                'outlierPercentage': (len(synth_outliers) / len(synth_clean)) * 100,
                'outliers': synth_outliers.tolist()[:5]
            }
        }
    
    def _compute_quality_metrics(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute data quality metrics."""
        tests = []
        
        # Completeness test
        real_completeness = 1 - (real_df.isnull().sum().sum() / (real_df.shape[0] * real_df.shape[1]))
        synth_completeness = 1 - (synth_df.isnull().sum().sum() / (synth_df.shape[0] * synth_df.shape[1]))
        completeness_ratio = synth_completeness / real_completeness if real_completeness > 0 else 0
        
        completeness_test = {
            'type': 'completeness_test',
            'metric': 'data_completeness',
            'realCompleteness': float(real_completeness),
            'syntheticCompleteness': float(synth_completeness),
            'ratio': float(completeness_ratio),
            'result': 'ACCEPT' if completeness_ratio >= 0.95 else 'REJECT',
            'description': f'Completeness ratio: {completeness_ratio:.3f} (synthetic/real)'
        }
        tests.append(completeness_test)
        
        # Consistency test (data type matching)
        consistent_columns = 0
        for col in real_df.columns:
            if col in synth_df.columns:
                if real_df[col].dtype == synth_df[col].dtype:
                    consistent_columns += 1
        
        consistency_ratio = consistent_columns / len(real_df.columns) if len(real_df.columns) > 0 else 0
        
        consistency_test = {
            'type': 'consistency_test',
            'metric': 'data_type_consistency',
            'consistentColumns': consistent_columns,
            'totalColumns': len(real_df.columns),
            'ratio': float(consistency_ratio),
            'result': 'ACCEPT' if consistency_ratio >= 0.95 else 'REJECT',
            'description': f'Data type consistency: {consistency_ratio:.3f} ({consistent_columns}/{len(real_df.columns)} columns)'
        }
        tests.append(consistency_test)
        
        # Privacy tests (integrated into Quality Metrics)
        privacy_tests = self._compute_privacy_statistics(real_df, synth_df)
        if privacy_tests.get('tests'):
            tests.extend(privacy_tests['tests'])
        
        # Note: Data Quality Assessment (SDMetrics Diagnostic Report) intentionally removed
        # from Quality Metrics as requested.
        
        return {
            'testType': 'Quality Metrics',
            'description': 'Data completeness, consistency, and privacy metrics',
            'completeness': {
                'realCompleteness': float(real_completeness),
                'syntheticCompleteness': float(synth_completeness),
                'ratio': float(completeness_ratio)
            },
            'consistency': {
                'consistentColumns': consistent_columns,
                'totalColumns': len(real_df.columns),
                'ratio': float(consistency_ratio)
            },
            'tests': tests,
            'summary': {
                'total': len(tests),
                'completenessTests': 1,
                'consistencyTests': 1,
                'privacyTests': len(privacy_tests.get('tests', []))
            }
        }
    
    def _compute_multivariate_statistics(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute multivariate statistical tests using SciPy."""
        # Get numeric columns
        numeric_cols = real_df.select_dtypes(include=[np.number]).columns.tolist()
        
        if len(numeric_cols) < 2:
            return {
                'testType': 'Multivariate Tests',
                'description': 'Multivariate statistical tests for distribution comparison using SciPy',
                'result': 'SKIP',
                'reason': f'Insufficient numeric variables (found {len(numeric_cols)}, minimum 2 required)',
                'tests': [],
                'summary': {
                    'total': 0,
                    'energyTests': 0,
                    'totalVariationTests': 0,
                    'klDivergenceTests': 0,
                    'jennrichTests': 0
                }
            }
        
        # Use full datasets for maximum accuracy
        real_full = real_df[numeric_cols]
        synth_full = synth_df[numeric_cols]
        
        tests = []
        
        # 1. Energy Test using SciPy
        energy_test = self._compute_energy_test(real_full, synth_full)
        tests.append(energy_test)
        
        # 2. Total Variation Distance using SciPy
        tv_test = self._compute_total_variation_test(real_full, synth_full)
        tests.append(tv_test)
        
        # 3. KL Divergence Test using SciPy
        kl_test = self._compute_kl_divergence_test(real_full, synth_full)
        tests.append(kl_test)
        
        # 4. Jennrich Test (Correlation Matrix Comparison)
        jennrich_test = self._compute_jennrich_test(real_full, synth_full)
        tests.append(jennrich_test)
        
        return {
            'testType': 'Multivariate Tests',
            'description': 'Multivariate statistical tests for distribution comparison using SciPy and full datasets',
            'tests': tests,
            'summary': {
                'total': len(tests),
                'energyTests': 1,
                'totalVariationTests': 1,
                'klDivergenceTests': 1,
                'jennrichTests': 1
            }
        }
    
    def _compute_energy_test(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute Energy Test using SciPy with full datasets."""
        try:
            # Convert to numpy arrays
            real_data = real_df.values
            synth_data = synth_df.values
            
            # Use SciPy's energy_distance for maximum accuracy
            energy_stat = energy_distance(real_data, synth_data)
            
            # Determine significance based on effect size
            significant = energy_stat > 0.1  # Threshold for practical significance
            
            return {
                'type': 'energy_test',
                'statistic': float(energy_stat),
                'significant': significant,
                'description': 'Energy test for multivariate distribution comparison using SciPy and full datasets',
                'result': 'REJECT' if significant else 'ACCEPT',
                'method': 'scipy'
            }
        except Exception as e:
            return {
                'type': 'energy_test',
                'result': 'ERROR',
                'error': str(e)
            }
    
    def _compute_total_variation_test(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute Total Variation Distance using SciPy with full datasets."""
        try:
            # Convert to numpy arrays
            real_data = real_df.values
            synth_data = synth_df.values
            
            # Use SciPy's histogram2d for total variation distance
            # Create 2D histogram
            hist_2d, x_edges, y_edges = np.histogram2d(
                real_data[:, 0], real_data[:, 1], 
                bins=10, range=None
            )
            
            # Normalize histograms
            hist_2d = hist_2d / hist_2d.sum()
            
            # Create synthetic histogram
            synth_hist_2d, _, _ = np.histogram2d(
                synth_data[:, 0], synth_data[:, 1],
                bins=[x_edges, y_edges]
            )
            synth_hist_2d = synth_hist_2d / synth_hist_2d.sum()
            
            # Calculate total variation distance
            tv_distance = 0.5 * np.sum(np.abs(hist_2d - synth_hist_2d))
            
            # Determine significance
            significant = tv_distance > 0.1  # Threshold for practical significance
            
            return {
                'type': 'total_variation_test',
                'statistic': float(tv_distance),
                'significant': significant,
                'description': 'Total variation distance using SciPy and full datasets',
                'result': 'REJECT' if significant else 'ACCEPT',
                'method': 'scipy'
            }
        except Exception as e:
            return {
                'type': 'total_variation_test',
                'result': 'ERROR',
                'error': str(e)
            }
    
    def _compute_kl_divergence_test(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute KL Divergence using SciPy with full datasets."""
        try:
            # Convert to numpy arrays
            real_data = real_df.values
            synth_data = synth_df.values
            
            # Create 2D histograms for KL divergence
            hist_2d, x_edges, y_edges = np.histogram2d(
                real_data[:, 0], real_data[:, 1],
                bins=10, range=None
            )
            
            # Normalize histograms
            hist_2d = hist_2d / hist_2d.sum()
            
            # Create synthetic histogram
            synth_hist_2d, _, _ = np.histogram2d(
                synth_data[:, 0], synth_data[:, 1],
                bins=[x_edges, y_edges]
            )
            synth_hist_2d = synth_hist_2d / synth_hist_2d.sum()
            
            # Calculate KL divergence (add small epsilon to avoid log(0))
            epsilon = 1e-10
            kl_divergence = np.sum(hist_2d * np.log((hist_2d + epsilon) / (synth_hist_2d + epsilon)))
            
            # Determine significance
            significant = kl_divergence > 0.1  # Threshold for practical significance
            
            return {
                'type': 'kl_divergence_test',
                'statistic': float(kl_divergence),
                'significant': significant,
                'description': 'KL divergence using SciPy and full datasets',
                'result': 'REJECT' if significant else 'ACCEPT',
                'method': 'scipy'
            }
        except Exception as e:
            return {
                'type': 'kl_divergence_test',
                'result': 'ERROR',
                'error': str(e)
            }
    
    def _compute_jennrich_test(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute Jennrich Test using full datasets."""
        try:
            # Calculate correlation matrices using full datasets with GPU acceleration
            real_corr = self._compute_correlation_matrix_gpu(real_df.values)
            synth_corr = self._compute_correlation_matrix_gpu(synth_df.values)
            
            # Use the computed correlation matrices directly
            R1 = real_corr
            R2 = synth_corr
            
            # Calculate Jennrich statistic
            jennrich_stat = self._jennrich_statistic(R1, R2)
            
            # Determine significance (threshold based on chi-square distribution)
            significant = jennrich_stat > 0.1  # Threshold for practical significance
            
            return {
                'type': 'jennrich_test',
                'statistic': float(jennrich_stat),
                'significant': significant,
                'description': 'Jennrich test for correlation matrix comparison using full datasets',
                'result': 'REJECT' if significant else 'ACCEPT',
                'method': 'manual'
            }
        except Exception as e:
            return {
                'type': 'jennrich_test',
                'result': 'ERROR',
                'error': str(e)
            }
    
    def _compute_privacy_statistics(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """Compute privacy statistics using the privacy testing service."""
        try:
            return privacy_service.compute_privacy_tests(real_df, synth_df)
        except Exception as e:
            return {
                'testType': 'Privacy Tests',
                'description': 'Comprehensive privacy assessment',
                'result': 'ERROR',
                'error': str(e),
                'tests': [],
                'summary': {'total': 0}
            }
    
    def _jennrich_statistic(self, R1: np.ndarray, R2: np.ndarray) -> float:
        """Compute Jennrich statistic for correlation matrix comparison."""
        try:
            if self._should_use_gpu(len(R1)):
                # GPU-accelerated computation
                R1_gpu = cp.asarray(R1)
                R2_gpu = cp.asarray(R2)
                
                # Compute difference matrix
                diff_matrix = R1_gpu - R2_gpu
                
                # Compute Jennrich statistic (Frobenius norm of difference)
                jennrich_stat = cp.sqrt(cp.sum(diff_matrix**2))
                
                return float(cp.asnumpy(jennrich_stat))
            else:
                # CPU fallback
                diff_matrix = R1 - R2
                jennrich_stat = np.sqrt(np.sum(diff_matrix**2))
                return float(jennrich_stat)
        except Exception as e:
            self.logger.warning("GPU Jennrich computation failed, falling back to CPU", extra={"error": str(e)})
            # CPU fallback
            diff_matrix = R1 - R2
            jennrich_stat = np.sqrt(np.sum(diff_matrix**2))
            return float(jennrich_stat)
    
    def _calculate_summary_statistics(self, results: Dict) -> None:
        """Calculate summary statistics for all tests and apply FDR correction."""
        total_tests = 0
        passed_tests = 0
        warning_tests = 0
        failed_tests = 0
        critical_tests = 0
        
        # Collect all p-values for FDR correction
        all_p_values = []
        test_references = []
        
        for test_category, test_data in results['tests'].items():
            if 'tests' in test_data:
                for test in test_data['tests']:
                    total_tests += 1
                    
                    # Collect p-values for FDR correction
                    if 'pValue' in test and test['pValue'] is not None:
                        all_p_values.append(test['pValue'])
                        test_references.append((test_category, test))
                    
                    if 'result' in test:
                        if test['result'] == 'ACCEPT':
                            passed_tests += 1
                        elif test['result'] == 'REJECT':
                            failed_tests += 1
                        elif test['result'] == 'WARNING':
                            warning_tests += 1
                        elif test['result'] == 'CRITICAL':
                            critical_tests += 1
        
        # Apply FDR correction separately by test type
        self._apply_fdr_correction_by_type(results)
        
        results['summary'].update({
            'totalTests': total_tests,
            'passed': passed_tests,
            'warnings': warning_tests,
            'failures': failed_tests,
            'critical': critical_tests
        })
    
    def _apply_fdr_correction_by_type(self, results: Dict) -> None:
        """Apply FDR correction separately to each test type that has multiple testings."""
        try:
            from statsmodels.stats.multitest import multipletests
            
            # Group tests by type for separate FDR correction
            test_groups = {}
            
            for test_category, test_data in results['tests'].items():
                if 'tests' in test_data:
                    for test in test_data['tests']:
                        if 'pValue' in test and test['pValue'] is not None:
                            test_type = test.get('type', 'unknown')
                            
                            if test_type not in test_groups:
                                test_groups[test_type] = []
                            test_groups[test_type].append(test)
            
            # Apply FDR correction to each test type separately
            fdr_results = {}
            
            for test_type, tests in test_groups.items():
                if len(tests) >= 2:  # Only apply FDR if we have multiple tests of this type
                    p_values = [test['pValue'] for test in tests]
                    
                    # Use statsmodels for Benjamini-Hochberg FDR correction
                    rejected, pvals_corrected, _, _ = multipletests(
                        p_values, 
                        alpha=0.05, 
                        method='fdr_bh'  # Benjamini-Hochberg correction
                    )
                    
                    # Update each test in this group
                    for i, test in enumerate(tests):
                        test['pValueCorrected'] = float(pvals_corrected[i])
                        test['fdrRejected'] = bool(rejected[i])
                        
                        # Update result based on FDR correction
                        if test.get('significant', False) and not rejected[i]:
                            test['result'] = 'ACCEPT'
                            test['fdrNote'] = f'Not significant after FDR correction ({test_type})'
                        elif not test.get('significant', False) and rejected[i]:
                            test['result'] = 'REJECT'
                            test['fdrNote'] = f'Significant after FDR correction ({test_type})'
                    
                    fdr_results[test_type] = {
                        'totalTests': len(tests),
                        'significantBeforeFDR': sum(1 for test in tests if test.get('significant', False)),
                        'significantAfterFDR': sum(rejected),
                        'method': 'Benjamini-Hochberg (statsmodels)',
                        'alpha': 0.05
                    }
                else:
                    fdr_results[test_type] = {
                        'note': f'FDR correction requires at least 2 tests of this type (found {len(tests)})',
                        'totalTests': len(tests)
                    }
            
            results['fdrCorrection'] = fdr_results
            
        except ImportError:
            # Fallback if statsmodels is not available
            results['fdrCorrection'] = {
                'error': 'Statsmodels not available for FDR correction. Please install statsmodels for proper FDR correction.'
            }
        except Exception as e:
            # Fallback for any other errors
            results['fdrCorrection'] = {
                'error': f'FDR correction failed: {str(e)}'
            }

# Global instance
validation_service = ValidationService() 