# Multivariate Statistical Tests for Synthetic Data Validation

## Overview

This document describes the comprehensive multivariate statistical tests implemented in the MAVIS validation system for comparing real and synthetic datasets. The tests are designed to detect differences in multivariate distributions and provide robust statistical evidence for data quality assessment.

## Test Categories

### 1. Univariate Tests (Existing)

#### Kolmogorov-Smirnov (KS) Test
- **Type**: Two-sample KS test (SciPy)
- **Purpose**: Compare empirical cumulative distribution functions (CDFs) between real and synthetic data
- **Interpretation**: Significant result indicates different univariate distributions

#### Chi-Square Test
- **Type**: Goodness-of-fit test for categorical variables (SciPy)
- **Purpose**: Compare frequency distributions between real and synthetic categorical data
- **Interpretation**: Significant result indicates different categorical distributions

### 2. Multivariate Tests

#### Energy Test
- **Type**: Multivariate distribution comparison using energy distance (SciPy)
- **Implementation**: Uses `scipy.stats.energy_distance`
- **Interpretation**: Larger values indicate greater multivariate differences

#### Total Variation Distance
- **Type**: Probability distribution comparison
- **Implementation**: 2D histograms on the first two numeric dimensions; TV = 0.5 * sum(|P - Q|)
- **Interpretation**: Values closer to 0 indicate more similar distributions

#### KL Divergence (Kullback-Leibler Divergence)
- **Type**: Information-theoretic measure
- **Implementation**: 2D histograms on the first two numeric dimensions with epsilon smoothing
- **Interpretation**: Higher values indicate more information loss

#### Jennrich Test
- **Type**: Correlation matrix comparison
- **Implementation**: Frobenius norm of the difference between correlation matrices
- **Interpretation**: Larger values indicate greater correlation structure differences

## Execution Order

The validation system executes tests in the following order for coherent reporting:

1. **Range and Domain Statistics**
2. **Univariate Distribution Tests** (KS and Chi-square)
3. **Correlation Structure Validation** (element-wise correlation comparison)
4. **Statistical Tests** (Welch's t-tests)
5. **Outlier Detection** (IQR-based)
6. **Quality Metrics** (Completeness, Consistency, SDMetrics Diagnostic Report, Privacy DCRBaselineProtection)
7. **Multivariate Distribution Tests** (Energy, Total Variation, KL Divergence, Jennrich)
8. **FDR Correction** (Benjamini-Hochberg per test type)

## FDR Correction

- **Procedure**: Benjamini-Hochberg via `statsmodels` applied per test type when multiple tests of that type exist
- **Benefit**: Controls false discoveries while maintaining statistical power

## Performance Considerations

- Tests operate on full datasets for maximum accuracy and consistency
- GPU acceleration (CuPy) is used opportunistically for correlation and distance computations; CPU fallback is automatic

## Interpretation Guidelines

- Report per-test statistics and p-values where applicable
- Use domain expertise for decision-making; MAVIS does not compute a composite quality score

## References

1. Székely, G. J., & Rizzo, M. L. (2004). Testing for equal distributions in high dimension. InterStat, 5(16.10), 1249-1272.
2. Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate: a practical and powerful approach to multiple testing. Journal of the Royal Statistical Society: Series B, 57(1), 289-300.
3. Kullback, S., & Leibler, R. A. (1951). On information and sufficiency. The Annals of Mathematical Statistics, 22(1), 79-86. 