"""
Privacy testing service for synthetic data validation.

This service implements fast privacy checks optimized for responsiveness:
    - NNDR (Nearest Neighbour Distance Ratio) computed with scikit-learn NearestNeighbors
    - ExactMatchRate (percentage of synthetic rows identical to any real row)
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple, Optional
import warnings
import logging
import os
from contextlib import redirect_stdout, redirect_stderr
from io import StringIO
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import MinMaxScaler

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

# No external privacy libraries required for fast checks

class PrivacyTestingService:
    """
    Comprehensive privacy testing service providing fast metrics:
    - NNDR (Nearest Neighbour Distance Ratio)
    - ExactMatchRate (exact row collisions with the real dataset)
    """
    
    def __init__(self):
        """Initialize the privacy testing service."""
        self.privacy_scores = {}
        
    def compute_privacy_tests(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """
        Compute fast privacy tests (NNDR and ExactMatchRate) using scikit-learn.
        
        Args:
            real_df: Real dataset
            synth_df: Synthetic dataset
            
        Returns:
            Dictionary containing privacy test results
        """
        # Handle empty data
        if real_df.empty or synth_df.empty:
            return {
                'testType': 'Privacy Tests',
                'description': 'Privacy assessment using SynthEval',
                'tests': [],
                'summary': {
                    'total': 0,
                    'passed': 0,
                    'failed': 0,
                    'errors': 0
                }
            }
        
        try:
            tests: List[Dict[str, Any]] = []

            # 1) Encode data quickly into numeric matrices (shared encoding)
            def encode_dataframe_for_distance(df: pd.DataFrame, ref_categories: Dict[str, Dict[Any, int]]) -> np.ndarray:
                encoded_cols: List[np.ndarray] = []
                for col in df.columns:
                    series = df[col]
                    if pd.api.types.is_numeric_dtype(series):
                        values = series.astype(float).fillna(series.median()).to_numpy()
                        encoded_cols.append(values)
                    else:
                        # Use reference mapping; unseen categories -> -1
                        mapping = ref_categories.setdefault(col, {})
                        if not mapping:
                            # Build mapping from real data only later; here we assume mapping exists
                            unique_vals = []
                        codes = series.map(mapping).fillna(-1).astype(int).to_numpy()
                        # Normalize categorical codes to [0,1] using max code (avoid zero division)
                        max_code = max(mapping.values()) if mapping else 0
                        denom = max(1, max_code)
                        encoded_cols.append(codes / denom)
                return np.column_stack(encoded_cols) if encoded_cols else np.empty((len(df), 0))

            # Build category maps from real_df
            category_maps: Dict[str, Dict[Any, int]] = {}
            for col in real_df.columns:
                if not pd.api.types.is_numeric_dtype(real_df[col]):
                    uniques = pd.Index(real_df[col].dropna().unique())
                    category_maps[col] = {val: idx for idx, val in enumerate(uniques)}

            X_real = encode_dataframe_for_distance(real_df, category_maps)
            X_synth = encode_dataframe_for_distance(synth_df, category_maps)

            # Scale each feature to [0,1] using real data stats
            if X_real.shape[1] > 0:
                scaler = MinMaxScaler()
                scaler.fit(X_real)
                X_real = scaler.transform(X_real)
                X_synth = scaler.transform(X_synth)

            # 2) Fast NN search from synthetic -> real
            if X_real.shape[0] >= 2 and X_synth.shape[0] >= 1:
                nn = NearestNeighbors(n_neighbors=2, algorithm='auto', metric='euclidean')
                nn.fit(X_real)
                dists, idxs = nn.kneighbors(X_synth, n_neighbors=2, return_distance=True)
                # Distance ratio of nearest to second-nearest real neighbor
                eps = 1e-12
                ratios = (dists[:, 0] / (dists[:, 1] + eps)).clip(0, 1)
                nndr_test = {
                    'type': 'NNDR',
                    'metric': 'nearest_neighbor_distance_ratio',
                    'median': float(np.median(ratios)),
                    'mean': float(np.mean(ratios)),
                    'q25': float(np.quantile(ratios, 0.25)),
                    'q75': float(np.quantile(ratios, 0.75)),
                    'result': 'SUCCESS',
                    'description': 'Ratio of nearest to second-nearest real neighbor distances for synthetic samples'
                }
                tests.append(nndr_test)

                nn_dist_test = {
                    'type': 'NN_Distance',
                    'metric': 'nearest_neighbor_distance',
                    'median': float(np.median(dists[:, 0])),
                    'mean': float(np.mean(dists[:, 0])),
                    'q25': float(np.quantile(dists[:, 0], 0.25)),
                    'q75': float(np.quantile(dists[:, 0], 0.75)),
                    'result': 'SUCCESS',
                    'description': 'Distance from each synthetic sample to its nearest real neighbor'
                }
                tests.append(nn_dist_test)

            # 3) Exact match rate (fast set lookup on row hashes)
            def row_keys(df: pd.DataFrame) -> np.ndarray:
                # Create a stable string key per row
                return (
                    df.fillna("<NA>").astype(str).agg("|".join, axis=1).to_numpy()
                )

            real_keys = set(row_keys(real_df))
            synth_keys = row_keys(synth_df)
            matches = int(sum(1 for k in synth_keys if k in real_keys))
            rate = matches / max(1, len(synth_keys))
            exact_match_test = {
                'type': 'ExactMatchRate',
                'metric': 'exact_match_rate',
                'matches': matches,
                'total': int(len(synth_keys)),
                'rate': float(rate),
                'result': 'SUCCESS' if matches == 0 else 'WARNING',
                'description': 'Proportion of synthetic rows exactly matching a real row'
            }
            tests.append(exact_match_test)

            return {
                'testType': 'Privacy Tests',
                'description': 'Fast privacy assessment (NNDR, nearest distance, exact match rate)',
                'tests': tests,
                'summary': {
                    'total': len(tests),
                    'passed': sum(1 for t in tests if t.get('result') == 'ACCEPT'),
                    'failed': sum(1 for t in tests if t.get('result') == 'REJECT'),
                    'errors': sum(1 for t in tests if t.get('result') in ['ERROR', 'LIBRARY_NOT_AVAILABLE'])
                }
            }
        except Exception as e:
            return {
                'testType': 'Privacy Tests',
                'description': 'Fast privacy assessment',
                'tests': [{
                    'type': 'FastPrivacy',
                    'result': 'ERROR',
                    'error': str(e)
                }],
                'summary': {
                    'total': 1,
                    'passed': 0,
                    'failed': 0,
                    'errors': 1
                }
            }
    
    def _assess_privacy_level(self, score: float) -> str:
        """Assess privacy level based on score."""
        if score >= 0.8:
            return 'EXCELLENT'
        elif score >= 0.6:
            return 'GOOD'
        elif score >= 0.4:
            return 'FAIR'
        else:
            return 'POOR'
    
    def _assess_result(self, privacy_level: str) -> str:
        """Assess test result based on privacy level."""
        if privacy_level in ['EXCELLENT', 'GOOD']:
            return 'PASS'
        else:
            return 'FAIL'
    
    # SDMetrics-based helpers removed as we now rely on SynthEval for privacy metrics.

# Global instance
privacy_service = PrivacyTestingService()
