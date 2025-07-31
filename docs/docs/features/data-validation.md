# Data Validation

MAVIS includes a comprehensive data validation system for synthetic data quality assessment.

## Validation Categories

- **Range Validation**: Bounds checking and outlier detection
- **Distribution Validation**: Statistical similarity tests
- **Correlation Validation**: Feature relationship preservation
- **Statistical Validation**: Mean, variance, skewness, kurtosis

## Quality Scoring

- **Pass Rate**: Percentage of tests that pass validation
- **Status**: PASS/FAIL for test results
- **Severity Levels**: HIGH, MEDIUM, LOW for issue priority
- **Overall Status**: EXCELLENT, GOOD, FAIR, POOR

## Test Results Structure

Each validation test returns:
- **status**: "PASS" or "FAIL" indicating test result
- **severity**: "HIGH", "MEDIUM", or "LOW" indicating issue priority
- **issues**: Array of specific problems found (if any)
- **metadata**: Test-specific information and statistics

## Dynamic Sampling Strategy

MAVIS uses intelligent sampling to ensure reliable statistical test results:

### Optimal Sample Sizes
- **KS Test**: 1,000 samples (optimal for distribution comparison)
- **t-Test**: 500 samples (optimal for mean comparison)
- **Chi-Square**: 1,000 samples (optimal for categorical comparison)
- **Correlation**: 500 samples (optimal for correlation analysis)
- **Outlier Detection**: 2,000 samples (optimal for outlier patterns)
- **Range Validation**: 2,000 samples (optimal for bounds checking)

### Multiple Sampling Iterations
For robust statistical testing, MAVIS runs multiple iterations with different random samples:

- **KS Test**: 5 iterations (different 1,000-sample draws)
- **t-Test**: 3 iterations (different 500-sample draws)
- **Chi-Square**: 3 iterations (different 1,000-sample draws)
- **Other Tests**: Single iteration (for performance)

### Result Aggregation
Multiple iterations are aggregated using:
- **Rejection Rate**: Percentage of iterations that reject the null hypothesis
- **Mean Statistics**: Average test statistics across iterations
- **Consensus Decision**: Overall result based on iteration agreement

### Sampling Methods
- **Full Dataset**: Used for small datasets (≤ optimal size)
- **Optimal Size**: Used for medium datasets (≤ 2× optimal size)
- **Random Sampling**: Used for large datasets (> 2× optimal size)
- **Multiple Iterations**: Different random seeds for each iteration

### Benefits
- **Reliable Results**: Prevents false positives from large sample sizes
- **Robust Testing**: Multiple iterations reduce sampling variability
- **Consistent Performance**: Maintains test speed regardless of dataset size
- **Reproducible**: Uses seeded random sampling for consistent results
- **Adaptive**: Automatically adjusts based on dataset characteristics