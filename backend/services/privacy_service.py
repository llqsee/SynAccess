"""
Privacy testing service for synthetic data validation.

This service implements privacy tests using SynthEval for robust privacy assessment
focused on NNDR, NNAA, and MIA metrics.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple, Optional
import warnings
import logging
import os
from contextlib import redirect_stdout, redirect_stderr
from io import StringIO

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

# Import privacy libraries with fallback
try:
    from syntheval import SynthEval  # type: ignore
except Exception:  # ImportError or other issues
    SynthEval = None

class PrivacyTestingService:
    """
    Comprehensive privacy testing service using SynthEval for privacy assessment.
    
    Implements privacy tests focusing on:
    - NNDR (Nearest Neighbour Distance Ratio)
    - NNAA (Nearest Neighbour Adversarial Accuracy)
    - MIA (Membership Inference Attack)
    """
    
    def __init__(self):
        """Initialize the privacy testing service."""
        self.privacy_scores = {}
        
    def compute_privacy_tests(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """
        Compute privacy tests using SynthEval (NNDR, NNAA, MIA).
        
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
        
        if SynthEval is None:
            return {
                'testType': 'Privacy Tests',
                'description': 'Privacy assessment using SynthEval',
                'tests': [
                    {
                        'type': 'SynthEval',
                        'result': 'LIBRARY_NOT_AVAILABLE',
                        'reason': 'SynthEval library not installed. Install with: pip install syntheval',
                        'description': 'SynthEval privacy metrics (NNDR, NNAA, MIA)'
                    }
                ],
                'summary': {
                    'total': 1,
                    'passed': 0,
                    'failed': 0,
                    'errors': 1
                }
            }
        
        try:
            # Identify categorical columns for SynthEval
            cat_cols = [col for col in real_df.columns if real_df[col].dtype == 'object']
            
            # Create a simple holdout split from the real dataset for evaluation
            # Use a deterministic sample for reproducibility
            if len(real_df) >= 10:
                holdout_fraction = 0.2
            else:
                holdout_fraction = 0.5  # small datasets
            df_holdout = real_df.sample(frac=holdout_fraction, random_state=42)
            
            # Suppress any library stdout/stderr during evaluation
            with open(os.devnull, 'w') as devnull, redirect_stdout(devnull), redirect_stderr(devnull):
                evaluator = SynthEval(real_df, holdout_dataframe=df_holdout, cat_cols=cat_cols)
                report = evaluator.evaluate(synth_df, class_lab_col=None, presets_file="privacy")
            
            tests: List[Dict[str, Any]] = []
            
            def add_metric_if_present(key_aliases: List[str], display_name: str) -> None:
                # Look for exact or case-insensitive matches in report dict
                value = None
                for k in report.keys():
                    for alias in key_aliases:
                        if k == alias or k.lower() == alias.lower():
                            value = report[k]
                            break
                    if value is not None:
                        break
                if value is not None:
                    tests.append({
                        'type': display_name,
                        'metric': display_name.lower(),
                        'value': float(value) if isinstance(value, (int, float, np.floating)) else value,
                        'result': 'SUCCESS',
                        'description': f'{display_name} privacy metric from SynthEval'
                    })
            
            add_metric_if_present(['NNDR', 'Nearest Neighbour Distance Ratio'], 'NNDR')
            add_metric_if_present(['NNAA', 'Nearest Neighbour Adversarial Accuracy'], 'NNAA')
            add_metric_if_present(['MIA', 'Membership Inference Attack'], 'MIA')
            
            # If none of the expected keys are present, add a diagnostic entry
            if not tests:
                tests.append({
                    'type': 'SynthEval',
                    'result': 'WARNING',
                    'description': 'No NNDR/NNAA/MIA keys found in SynthEval report; returning raw keys.',
                    'availableMetrics': list(report.keys())
                })
            
            return {
                'testType': 'Privacy Tests',
                'description': 'Privacy assessment using SynthEval (NNDR, NNAA, MIA)',
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
                'description': 'Privacy assessment using SynthEval',
                'tests': [{
                    'type': 'SynthEval',
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
