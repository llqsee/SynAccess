"""
Privacy testing service for synthetic data validation.

This service implements comprehensive privacy tests using SDMetrics for robust privacy assessment.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple, Optional
import warnings
import logging

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

# Import privacy libraries with fallback
try:
    import sdmetrics
except ImportError:
    sdmetrics = None

class PrivacyTestingService:
    """
    Comprehensive privacy testing service using SDMetrics for privacy assessment.
    
    Implements privacy tests using:
    1. DCRBaselineProtection - Distance between real and synthetic records vs random baseline
    """
    
    def __init__(self):
        """Initialize the privacy testing service."""
        self.privacy_scores = {}
        
    def compute_privacy_tests(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """
        Compute comprehensive privacy tests using SDMetrics.
        
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
                'description': 'Comprehensive privacy assessment using SDMetrics',
                'tests': [],
                'summary': {
                    'total': 0,
                    'passed': 0,
                    'failed': 0,
                    'errors': 0
                }
            }
        
        tests = []
        
        # DCRBaselineProtection - Distance between real and synthetic records vs random baseline
        dcr_baseline_test = self._test_dcr_baseline_protection(real_df, synth_df)
        tests.append(dcr_baseline_test)
        
        return {
            'testType': 'Privacy Tests',
            'description': 'Comprehensive privacy assessment using SDMetrics',
            'tests': tests,
            'summary': {
                'total': len(tests),
                'passed': sum(1 for test in tests if test.get('result') == 'PASS'),
                'failed': sum(1 for test in tests if test.get('result') == 'FAIL'),
                'errors': sum(1 for test in tests if test.get('result') in ['ERROR', 'LIBRARY_NOT_AVAILABLE'])
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
    
    def _test_dcr_baseline_protection(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """
        Test privacy using SDMetrics DCRBaselineProtection.
        Distance between real and synthetic records compared against a random baseline.
        Higher score = better privacy.
        """
        if sdmetrics is None:
            return {
                'type': 'DCRBaselineProtection',
                'result': 'LIBRARY_NOT_AVAILABLE',
                'reason': 'SDMetrics library not installed. Install with: pip install sdmetrics',
                'description': 'Distance between real and synthetic records vs random baseline'
            }
        
        try:
            from sdmetrics.single_table.privacy import DCRBaselineProtection
            
            # Create metadata for DCR baseline protection
            metadata = {
                'columns': {
                    col: {'sdtype': 'categorical' if real_df[col].dtype == 'object' else 'numerical'}
                    for col in real_df.columns
                }
            }
            
            # Compute DCR baseline protection with metadata
            dcr_score = DCRBaselineProtection.compute(real_df, synth_df, metadata)
            
            # Determine privacy level (higher score = better privacy)
            if dcr_score > 0.8:
                privacy_level = 'HIGH'
                result = 'ACCEPT'
            elif dcr_score > 0.6:
                privacy_level = 'MEDIUM'
                result = 'WARNING'
            else:
                privacy_level = 'LOW'
                result = 'REJECT'
            
            return {
                'type': 'DCRBaselineProtection',
                'metric': 'dcr_baseline_protection',
                'privacy_score': float(dcr_score),
                'privacy_level': privacy_level,
                'result': result,
                'description': f'DCR Baseline Protection: {dcr_score:.3f}',
                'interpretation': f'Distance between real and synthetic records vs random baseline: {dcr_score:.3f} indicates {privacy_level.lower()} privacy protection'
            }
            
        except Exception as e:
            return {
                'type': 'DCRBaselineProtection',
                'result': 'ERROR',
                'error': str(e),
                'description': 'Distance between real and synthetic records vs random baseline'
            }
    
    def get_sdmetrics_diagnostic_score(self, real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict:
        """
        Get SDMetrics Diagnostic Report score for quality metrics.
        This is now separate from privacy tests and used for overall data quality assessment.
        """
        if sdmetrics is None:
            return {
                'type': 'Data Quality Assessment',
                'result': 'LIBRARY_NOT_AVAILABLE',
                'reason': 'SDMetrics library not installed. Install with: pip install sdmetrics',
                'description': 'SDMetrics Diagnostic Report for overall data quality'
            }
        
        try:
            from sdmetrics.reports.single_table.diagnostic_report import DiagnosticReport
            
            # Create metadata for the diagnostic report
            metadata = {
                'columns': {
                    col: {'sdtype': 'categorical' if real_df[col].dtype == 'object' else 'numerical'}
                    for col in real_df.columns
                }
            }
            
            # Generate diagnostic report with metadata
            report = DiagnosticReport()
            report.generate(real_df, synth_df, metadata)
            
            # Get the overall score
            quality_score = report.get_score()
            
            # Determine quality level
            if quality_score > 0.8:
                quality_level = 'EXCELLENT'
                result = 'ACCEPT'
            elif quality_score > 0.6:
                quality_level = 'GOOD'
                result = 'WARNING'
            else:
                quality_level = 'POOR'
                result = 'REJECT'
            
            return {
                'type': 'Data Quality Assessment',
                'metric': 'sdmetrics_diagnostic_quality',
                'quality_score': float(quality_score),
                'quality_level': quality_level,
                'result': result,
                'description': f'SDMetrics Diagnostic Report quality score: {quality_score:.3f}',
                'interpretation': f'Overall data quality score of {quality_score:.3f} indicates {quality_level.lower()} quality'
            }
            
        except Exception as e:
            return {
                'type': 'Data Quality Assessment',
                'result': 'ERROR',
                'error': str(e),
                'description': 'SDMetrics Diagnostic Report for overall data quality'
            }

# Global instance
privacy_service = PrivacyTestingService()
