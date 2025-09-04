# Data Validation

MAVIS includes a comprehensive data validation system for synthetic data quality assessment.

## Validation Categories

- **Range Validation**: Bounds checking and outlier detection
- **Distribution Validation**: Statistical similarity tests
- **Correlation Validation**: Feature relationship preservation
- **Statistical Validation**: Mean, variance, skewness, kurtosis

## Validation Outputs

- Per-test raw results: statistics, p-values, effect sizes, and metadata
- No overall EXCELLENT/GOOD/FAIR/POOR scoring is produced
- Avoid mixing p-values across test families; apply FDR per family where applicable

## Test Results Structure

Each validation test returns:
- **statistic**: Test statistic value
- **p_value** and optionally **adjusted_p_value** (FDR-corrected)
- **effect_size** (when applicable)
- **metadata**: Test-specific additional information

## Execution Strategy

- All validation tests operate on full datasets for maximum accuracy and consistency.
- False Discovery Rate (FDR) correction is applied per test type (e.g., KS tests together), not across different families of tests.
- Tests return raw statistics and p-values where applicable; MAVIS does not compute a single composite quality score.