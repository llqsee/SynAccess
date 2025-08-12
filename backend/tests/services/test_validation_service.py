#!/usr/bin/env python3
"""
Test script for the professional validation service using scientific libraries
"""

import sys
import json
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from backend.services.validation_service import validation_service
import numpy as np

def test_professional_validation_service():
    """Test the professional validation service with sample data."""
    
    # Create sample real data with more variables for multivariate tests
    np.random.seed(42)
    n_samples = 100
    
    # Generate correlated multivariate data
    x1 = np.random.normal(0, 1, n_samples)
    x2 = x1 + np.random.normal(0, 0.5, n_samples)  # Correlated with x1
    x3 = np.random.normal(0, 1, n_samples)
    
    real_data = {
        'data': [[float(x1[i]), float(x2[i]), float(x3[i])] for i in range(n_samples)],
        'headers': ['x1', 'x2', 'x3']
    }
    
    # Generate slightly different synthetic data
    y1 = np.random.normal(0.1, 1.1, n_samples)  # Slightly different mean and std
    y2 = y1 + np.random.normal(0, 0.6, n_samples)  # Slightly different correlation
    y3 = np.random.normal(0, 1, n_samples)
    
    synthetic_data = {
        'data': [[float(y1[i]), float(y2[i]), float(y3[i])] for i in range(n_samples)],
        'headers': ['x1', 'x2', 'x3']
    }
    
    print("Testing professional validation service...")
    print("Real data shape:", len(real_data['data']), "x", len(real_data['headers']))
    print("Synthetic data shape:", len(synthetic_data['data']), "x", len(synthetic_data['headers']))
    
    try:
        # Test validation service
        results = validation_service.compute_validation_statistics(
            real_data, 
            synthetic_data, 
            {}
        )
        
        print("\nProfessional validation service test successful!")
        print(f"Processing time: {results.get('processingTime', 0):.2f} seconds")
        print(f"Total tests: {results.get('summary', {}).get('totalTests', 0)}")
        
        # Print test categories
        if 'tests' in results:
            print("\nTest categories:")
            for category, test_data in results['tests'].items():
                print(f"  - {category}: {test_data.get('summary', {}).get('total', 0)} tests")
        
        # Print summary
        summary = results.get('summary', {})
        print(f"\nSummary:")
        print(f"  - Passed: {summary.get('passed', 0)}")
        print(f"  - Warnings: {summary.get('warnings', 0)}")
        print(f"  - Failures: {summary.get('failures', 0)}")
        print(f"  - Critical: {summary.get('critical', 0)}")
        
        # Check for multivariate tests
        if 'Multivariate Tests' in results.get('tests', {}):
            multivariate_tests = results['tests']['Multivariate Tests']
            print(f"\nMultivariate Tests:")
            print(f"  - Total tests: {multivariate_tests.get('summary', {}).get('total', 0)}")
            print(f"  - Energy tests: {multivariate_tests.get('summary', {}).get('energyTests', 0)}")
            print(f"  - Total variation tests: {multivariate_tests.get('summary', {}).get('totalVariationTests', 0)}")
            print(f"  - KL divergence tests: {multivariate_tests.get('summary', {}).get('klDivergenceTests', 0)}")
            print(f"  - Jennrich tests: {multivariate_tests.get('summary', {}).get('jennrichTests', 0)}")
            
            # Print individual test results
            for test in multivariate_tests.get('tests', []):
                print(f"    - {test.get('type', 'unknown')}: {test.get('result', 'unknown')} (statistic: {test.get('statistic', 'N/A')})")
        
        # Check which methods were used (should all be SciPy)
        if 'Distribution Tests' in results.get('tests', {}):
            distribution_tests = results['tests']['Distribution Tests']
            scipy_methods = 0
            basic_methods = 0
            
            for test in distribution_tests.get('tests', []):
                if test.get('method') == 'scipy':
                    scipy_methods += 1
                elif test.get('method') == 'basic':
                    basic_methods += 1
            
            print(f"\nMethod Usage:")
            print(f"  - SciPy methods: {scipy_methods}")
            print(f"  - Basic methods: {basic_methods}")
            
            # Verify that only SciPy methods are used
            if basic_methods == 0:
                print("  - SUCCESS: Only SciPy methods used (no basic fallbacks)")
                return True
            else:
                print("  - WARNING: Basic methods used (SciPy import may have failed)")
                return False
        
        return True
        
    except Exception as e:
        print(f"Professional validation service test failed: {e}")
        return False

def test_validation_service_imports():
    """Test that the validation service can be imported and initialized."""
    try:
        from backend.services.validation_service import validation_service
        print("Validation service import successful")
        return True
    except Exception as e:
        print(f"Validation service import failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing Validation Service")
    print("=" * 50)
    
    # Test imports
    import_success = test_validation_service_imports()
    
    if import_success:
        # Test full validation service
        validation_success = test_professional_validation_service()
        
        if validation_success:
            print("\nAll validation service tests passed!")
            exit(0)
        else:
            print("\nValidation service tests failed!")
            exit(1)
    else:
        print("\nImport tests failed!")
        exit(1) 