# Data Validation

Technical details of MAVIS's data validation framework.

## Validation Framework

### Range Validation
- **Bounds Checking**: Ensure values within expected ranges
- **Outlier Detection**: Identify unrealistic values
- **Data Type Consistency**: Validate categorical/numerical types

### Distribution Validation
- **Kolmogorov-Smirnov Test** (SciPy): Statistical similarity on numeric columns
- **Chi-Square Test** (SciPy): Distribution comparison for categorical columns

### Correlation Validation
- **Element-wise Correlation Comparison**: Pearson correlation matrices compared across real vs synthetic using full datasets
- **Jennrich Test**: Assesses correlation matrix differences (reported under Multivariate Tests)

### Statistical Tests
- **Welch's t-test** (SciPy): Compares means for numeric columns

### Outlier Detection
- **IQR Method**: Identifies outliers per numeric column and compares counts/percentages

### Multivariate Tests
- **Energy Distance** (SciPy): Multivariate distribution difference
- **Total Variation Distance**: 2D histogram-based TV distance on first two numeric dimensions
- **KL Divergence**: 2D histogram-based KL on first two numeric dimensions
- **Jennrich Test**: Frobenius norm between correlation matrices

### Quality Metrics
- **Completeness**: Ratio of non-missing values (synthetic/real)
- **Consistency**: Data type consistency across columns
- **Privacy (Fast Checks)**: NNDR (nearest-neighbour distance ratio), nearest-neighbour distance summary, exact match rate

## Execution Strategy
- Tests operate on full datasets for maximum accuracy and consistency
- FDR correction (Benjamini-Hochberg via statsmodels) is applied per test type when multiple tests of that type exist
- Results are raw statistics; no single composite quality score is produced

## GPU Acceleration
- CuPy is used opportunistically for correlation and distance computations when available and beneficial; CPU fallback is automatic