from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from backend.services.validation_service import validation_service

router = APIRouter(prefix="/validation", tags=["validation"])

class ValidationRequest(BaseModel):
    real_data: Dict[str, Any]
    synthetic_data: Dict[str, Any]
    options: Optional[Dict[str, Any]] = {}

class ValidationResponse(BaseModel):
    timestamp: str
    results: Dict[str, Any]
    summary: Dict[str, Any]
    processingTime: float
    datasetInfo: Optional[Dict[str, Any]] = {}
    dataset_info: Optional[Dict[str, Any]] = {}

@router.post("/compute-statistics", response_model=ValidationResponse)
async def compute_validation_statistics(request: ValidationRequest):
    """
    Compute comprehensive validation statistics using Python scientific libraries.
    
    This endpoint performs professional-grade statistical analysis including:
    - Range and domain statistics
    - Distribution tests (KS, Chi-square)
    - Correlation structure validation
    - Statistical tests (t-tests)
    - Outlier detection
    - Quality metrics
    """
    try:
        # Validate input data
        if not request.real_data or not request.synthetic_data:
            raise HTTPException(status_code=400, detail="Both real and synthetic data are required")
        
        if 'data' not in request.real_data or 'headers' not in request.real_data:
            raise HTTPException(status_code=400, detail="Real data must contain 'data' and 'headers' keys")
        
        if 'data' not in request.synthetic_data or 'headers' not in request.synthetic_data:
            raise HTTPException(status_code=400, detail="Synthetic data must contain 'data' and 'headers' keys")
        
        # Validate data structure
        real_data = request.real_data
        synthetic_data = request.synthetic_data
        
        if len(real_data['data']) == 0:
            raise HTTPException(status_code=400, detail="Real data is empty")
        
        if len(synthetic_data['data']) == 0:
            raise HTTPException(status_code=400, detail="Synthetic data is empty")
        
        if len(real_data['headers']) != len(real_data['data'][0]):
            raise HTTPException(status_code=400, detail="Real data headers count doesn't match data columns")
        
        if len(synthetic_data['headers']) != len(synthetic_data['data'][0]):
            raise HTTPException(status_code=400, detail="Synthetic data headers count doesn't match data columns")
        
        # Compute validation statistics
        results = validation_service.compute_validation_statistics(
            real_data, 
            synthetic_data, 
            request.options or {}
        )
        
        # Check for errors
        if 'error' in results:
            raise HTTPException(status_code=500, detail=results['error'])
        
        # Format response
        response = {
            'timestamp': results['timestamp'],
            'results': results['tests'],
            'summary': results['summary'],
            'processingTime': results['processingTime'],
            'datasetInfo': results.get('datasetInfo', {}),
            'dataset_info': results.get('datasetInfo', {})  # Also include for compatibility
        }
        
        return ValidationResponse(**response)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation computation failed: {str(e)}")

@router.get("/status")
async def get_validation_service_status():
    """Get validation service status and capabilities."""
    return {
        "service": "validation",
        "status": "available",
        "capabilities": {
            "range_validation": True,
            "distribution_tests": True,
            "correlation_validation": True,
            "statistical_tests": True,
            "outlier_detection": True,
            "quality_metrics": True,
            "multivariate_tests": True,
            "energy_test": True,
            "total_variation_distance": True,
            "kl_divergence": True,
            "jennrich_test": True
        },
        "libraries": {
            "numpy": True,
            "pandas": True,
            "basic_python": True
        },
        "optimal_sample_sizes": validation_service.optimal_sample_sizes,
        "min_sample_sizes": validation_service.min_sample_sizes
    }

@router.post("/test-correlation")
async def test_correlation_matrices(request: ValidationRequest):
    """
    Test endpoint specifically for correlation matrix comparison.
    Returns detailed correlation analysis with specific variable pair differences.
    """
    try:
        # Validate input data
        if not request.real_data or not request.synthetic_data:
            raise HTTPException(status_code=400, detail="Both real and synthetic data are required")
        
        # Convert to pandas DataFrames
        real_df = pd.DataFrame(request.real_data['data'], columns=request.real_data['headers'])
        synth_df = pd.DataFrame(request.synthetic_data['data'], columns=request.synthetic_data['headers'])
        
        # Get numeric columns
        numeric_cols = real_df.select_dtypes(include=[np.number]).columns.tolist()
        
        if len(numeric_cols) < 2:
            return {
                "result": "SKIP",
                "reason": "Insufficient numeric variables (minimum 2 required)",
                "correlation_analysis": None
            }
        
        # Sample data for efficiency
        sample_size = min(validation_service.optimal_sample_sizes['correlation'], 
                         len(real_df), len(synth_df))
        real_sampled = real_df[numeric_cols].sample(n=sample_size, random_state=42)
        synth_sampled = synth_df[numeric_cols].sample(n=sample_size, random_state=42)
        
        # Calculate correlation matrices
        real_corr = real_sampled.corr()
        synth_corr = synth_sampled.corr()
        
        # Compare correlation matrices
        comparison = validation_service._compare_correlation_matrices(real_corr, synth_corr)
        
        return {
            "result": "SUCCESS",
            "correlation_analysis": {
                "real_correlations": real_corr.to_dict(),
                "synthetic_correlations": synth_corr.to_dict(),
                "comparison": comparison,
                "variables_analyzed": numeric_cols,
                "sample_size": sample_size
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Correlation analysis failed: {str(e)}")

@router.post("/test-distribution")
async def test_distribution_comparison(request: ValidationRequest):
    """
    Test endpoint specifically for distribution comparison.
    Returns detailed KS and Chi-square test results.
    """
    try:
        # Validate input data
        if not request.real_data or not request.synthetic_data:
            raise HTTPException(status_code=400, detail="Both real and synthetic data are required")
        
        # Convert to pandas DataFrames
        real_df = pd.DataFrame(request.real_data['data'], columns=request.real_data['headers'])
        synth_df = pd.DataFrame(request.synthetic_data['data'], columns=request.synthetic_data['headers'])
        
        # Compute distribution statistics
        distribution_stats = validation_service._compute_distribution_statistics(real_df, synth_df)
        
        return {
            "result": "SUCCESS",
            "distribution_analysis": distribution_stats,
            "tests_performed": len(distribution_stats['tests']),
            "ks_tests": len([t for t in distribution_stats['tests'] if t['type'] == 'ks_test']),
            "chi_square_tests": len([t for t in distribution_stats['tests'] if t['type'] == 'chi_square_test'])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Distribution analysis failed: {str(e)}") 