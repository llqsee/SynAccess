#!/usr/bin/env python3
"""
Test script for FDR correction in the professional validation service
"""

import sys
import json
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from backend.services.validation_service import validation_service
import numpy as np

def test_fdr_correction():
    """Test FDR correction with multiple tests."""
    
    # Create sample data with multiple variables to trigger multiple tests
    np.random.seed(42)
    n_samples = 100
    
    # Generate real data with multiple variables
    real_data = {
        'data': [
            [float(np.random.normal(0, 1)), 
             float(np.random.normal(0, 1)), 
             float(np.random.normal(0, 1)),
             float(np.random.normal(0, 1))]
            for _ in range(n_samples)
        ],
        'headers': ['var1', 'var2', 'var3', 'var4']
    }
    
    # Generate synthetic data with some differences
    synthetic_data = {
        'data': [
            [float(np.random.normal(0.2, 1.1)), 
             float(np.random.normal(0.1, 1.2)), 
             float(np.random.normal(0, 1)),
             float(np.random.normal(0.3, 1.1))]
            for _ in range(n_samples)
        ],
        'headers': ['var1', 'var2', 'var3', 'var4']
    }
    
    print("Testing FDR correction...")
    print("Real data shape:", len(real_data['data']), "x", len(real_data['headers']))
    print("Synthetic data shape:", len(synthetic_data['data']), "x", len(synthetic_data['headers']))
    
    try:
        # Test validation service
        results = validation_service.compute_validation_statistics(
            real_data, 
            synthetic_data, 
            {}
        )
        
        print("\nFDR correction test successful!")
        
        # Check if FDR correction was applied
        if 'fdrCorrection' in results:
            fdr_results = results['fdrCorrection']
            print(f"\nFDR Correction Results (by test type):")
            
            for test_type, type_results in fdr_results.items():
                print(f"  - {test_type}:")
                if 'error' in type_results:
                    print(f"    Error: {type_results['error']}")
                elif 'note' in type_results:
                    print(f"    Note: {type_results['note']}")
                else:
                    print(f"    Total tests: {type_results['totalTests']}")
                    print(f"    Significant before FDR: {type_results['significantBeforeFDR']}")
                    print(f"    Significant after FDR: {type_results['significantAfterFDR']}")
                    print(f"    Method: {type_results['method']}")
                    print(f"    Alpha: {type_results['alpha']}")
        else:
            print("FDR correction not found in results")
            return False
        
        # Check individual test results for FDR correction
        print(f"\nIndividual Test Results with FDR:")
        for test_category, test_data in results['tests'].items():
            if 'tests' in test_data:
                for test in test_data['tests']:
                    if 'pValue' in test:
                        print(f"  - {test.get('type', 'unknown')}:")
                        print(f"    Original p-value: {test.get('pValue', 'N/A')}")
                        print(f"    Corrected p-value: {test.get('pValueCorrected', 'N/A')}")
                        print(f"    FDR rejected: {test.get('fdrRejected', 'N/A')}")
                        print(f"    Result: {test.get('result', 'N/A')}")
                        if 'fdrNote' in test:
                            print(f"    FDR Note: {test['fdrNote']}")
        
        return True
        
    except Exception as e:
        print(f"\nFDR correction test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_fdr_imports():
    """Test that the validation service with FDR can be imported."""
    try:
        from backend.services.validation_service import validation_service
        print("FDR validation service import successful")
        return True
    except Exception as e:
        print(f"FDR validation service import failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing FDR Correction")
    print("=" * 50)
    
    # Test imports
    import_success = test_fdr_imports()
    
    if import_success:
        # Test FDR correction
        fdr_success = test_fdr_correction()
        
        if fdr_success:
            print("\nAll FDR correction tests passed!")
            exit(0)
        else:
            print("\nFDR correction tests failed!")
            exit(1)
    else:
        print("\nImport tests failed!")
        exit(1) 