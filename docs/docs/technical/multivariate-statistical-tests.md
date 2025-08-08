# Multivariate Statistical Tests for Synthetic Data Validation

## Overview

This document describes the comprehensive multivariate statistical tests implemented in the MAVIS validation system for comparing real and synthetic datasets. The tests are designed to detect differences in multivariate distributions and provide robust statistical evidence for data quality assessment.

## Test Categories

### 1. Univariate Tests (Existing)

#### Kolmogorov-Smirnov (KS) Test
- **Type**: Two-sample KS test
- **Purpose**: Compare empirical cumulative distribution functions (CDFs) between real and synthetic data
- **Implementation**: 
  - Calculates maximum difference between empirical CDFs
  - Uses critical value adjusted for sample size: `1.36 * sqrt((n1 + n2) / (n1 * n2))`
  - Supports multiple sampling iterations for robustness
- **Interpretation**: Significant result indicates different univariate distributions

#### Chi-Square Test
- **Type**: Goodness-of-fit test for categorical variables
- **Purpose**: Compare frequency distributions between real and synthetic categorical data
- **Implementation**: 
  - Creates frequency distributions for both datasets
  - Calculates chi-square statistic with degrees of freedom
  - Uses critical value of 3.841 for α = 0.05
- **Interpretation**: Significant result indicates different categorical distributions

### 2. Multivariate Tests (New)

#### Energy Test
- **Type**: Multivariate distribution comparison using energy distance
- **Purpose**: Test if two multivariate distributions are equal
- **Mathematical Foundation**: 
  ```
  Energy Distance = (2 * between_group_distances) / (n1 * n2) 
                   - within_group_distances_real / (n1 * (n1-1))
                   - within_group_distances_synthetic / (n2 * (n2-1))
  ```
- **Implementation**:
  - Calculates Euclidean distances between all pairs of points
  - Computes within-group and between-group distances
  - Uses bootstrap resampling for p-value calculation
- **Advantages**: 
  - Non-parametric (no distributional assumptions)
  - Sensitive to location, scale, and shape differences
  - Works well with high-dimensional data
- **Interpretation**: Significant result indicates different multivariate distributions

#### Total Variation Distance
- **Type**: Probability distribution comparison
- **Purpose**: Measure maximum difference between two probability distributions
- **Mathematical Foundation**:
  ```
  TV Distance = (1/2) * Σ|P_real(x) - P_synthetic(x)|
  ```
- **Implementation**:
  - Creates histograms for each dimension (20 bins)
  - Calculates absolute differences between probability mass functions
  - Averages across dimensions for overall measure
  - Uses bootstrap for significance testing
- **Advantages**:
  - Bounded between 0 and 1
  - Intuitive interpretation
  - Robust to outliers
- **Interpretation**: Values closer to 0 indicate similar distributions

#### KL Divergence (Kullback-Leibler Divergence)
- **Type**: Information-theoretic measure
- **Purpose**: Measure relative entropy between two probability distributions
- **Mathematical Foundation**:
  ```
  KL(P||Q) = Σ P(x) * log(P(x)/Q(x))
  ```
- **Implementation**:
  - Creates histograms for each dimension
  - Calculates KL divergence for each dimension
  - Averages across dimensions
  - Uses small constant (0.0001) to avoid log(0)
  - Bootstrap for significance testing
- **Advantages**:
  - Information-theoretic interpretation
  - Sensitive to differences in probability mass
  - Widely used in machine learning
- **Interpretation**: Higher values indicate more information loss

#### Bootstrap Multivariate Test
- **Type**: Resampling-based significance test
- **Purpose**: Assess significance of multivariate differences using bootstrap
- **Implementation**:
  - Calculates original multivariate distance (Euclidean distance between mean vectors)
  - Generates 1000 bootstrap samples with replacement
  - Compares original statistic to bootstrap distribution
  - Calculates empirical p-value
- **Advantages**:
  - No distributional assumptions
  - Robust to non-normality
  - Provides confidence intervals
- **Interpretation**: Significant result indicates multivariate differences

## Test Execution Order

The validation system executes tests in the following order for optimal statistical analysis:

1. **Range and Domain Statistics** - Basic data bounds and categorical domains
2. **Univariate Distribution Tests** - KS and Chi-square tests
3. **Multivariate Distribution Tests** - Energy, Total Variation, KL Divergence, Bootstrap
4. **Correlation Structure Validation** - Correlation matrix comparison
5. **Statistical Significance Tests** - t-tests for means
6. **Outlier Detection** - Outlier pattern comparison
7. **Quality Metrics** - Completeness and consistency
8. **FDR Correction** - Benjamini-Hochberg procedure
9. **Advanced Tests** - Jennrich test, Privacy tests (if enabled)

## False Discovery Rate (FDR) Correction

### Benjamini-Hochberg Procedure
- **Purpose**: Control false discovery rate when conducting multiple hypothesis tests
- **Implementation**:
  1. Sort all p-values in ascending order
  2. For each test i, calculate adjusted p-value: `min(p_i * m / rank_i, 1)`
  3. Find largest k where p_k ≤ (α * k) / m
  4. Reject null hypotheses for tests 1 through k
- **Parameters**:
  - α = 0.05 (significance level)
  - Applied to all test types: distribution, statistical, multivariate, jennrich
- **Benefits**:
  - Controls family-wise error rate
  - More powerful than Bonferroni correction
  - Maintains statistical rigor

## Bootstrapping Strategy

### Why Bootstrapping is Necessary
1. **Multivariate Complexity**: Multivariate tests often lack closed-form p-values
2. **Non-parametric Nature**: Many tests don't assume specific distributions
3. **Sample Size Flexibility**: Works with various sample sizes
4. **Robustness**: Provides empirical significance levels

### Bootstrap Implementation
- **Sample Size**: 1000 bootstrap samples per test
- **Method**: Resampling with replacement
- **P-value Calculation**: Proportion of bootstrap statistics ≥ original statistic
- **Consistency**: Same random seed for reproducibility

## Sampling Strategy

### Optimal Sample Sizes
- **Energy Test**: 800 samples
- **Total Variation**: 1000 samples  
- **KL Divergence**: 800 samples
- **Multivariate**: 600 samples
- **Bootstrap**: 1000 samples

### Multiple Sampling Runs
- **Energy Test**: 3 iterations
- **Total Variation**: 2 iterations
- **KL Divergence**: 3 iterations
- **Multivariate**: 2 iterations

### Adaptive Sampling
- **Small Datasets**: Use full dataset
- **Medium Datasets**: Use optimal size
- **Large Datasets**: Random sampling with optimal size

## Performance Considerations

### Computational Complexity
- **Energy Test**: O(n²d) where n = sample size, d = dimensions
- **Total Variation**: O(nd) for histogram creation
- **KL Divergence**: O(nd) for histogram creation
- **Bootstrap**: O(B * test_complexity) where B = bootstrap samples

### Optimization Strategies
- **Early Termination**: Skip tests with insufficient data
- **Parallel Processing**: Bootstrap samples can be parallelized
- **Memory Management**: Process tests sequentially to avoid memory issues
- **Caching**: Reuse histogram calculations where possible

## Interpretation Guidelines

### Energy Test
- **Statistic Range**: 0 to ∞
- **Interpretation**: Higher values indicate greater distribution differences
- **Threshold**: No fixed threshold, use bootstrap p-value

### Total Variation Distance
- **Statistic Range**: 0 to 1
- **Interpretation**: 
  - 0: Identical distributions
  - 0.1: Similar distributions
  - 0.5: Moderate differences
  - 1.0: Completely different distributions

### KL Divergence
- **Statistic Range**: 0 to ∞
- **Interpretation**:
  - 0: Identical distributions
  - 0.1: Small differences
  - 1.0: Moderate differences
  - >1.0: Large differences

### Bootstrap Test
- **P-value**: Proportion of bootstrap statistics ≥ original
- **Interpretation**: p < 0.05 indicates significant differences

## Recommendations for Use

### When to Use Each Test
1. **Energy Test**: Primary multivariate comparison, robust to outliers
2. **Total Variation**: When bounded measure is preferred
3. **KL Divergence**: Information-theoretic analysis needed
4. **Bootstrap**: When distributional assumptions are questionable

### Reporting Standards
- Always report p-values with FDR correction
- Include effect sizes for all tests
- Provide confidence intervals for bootstrap tests
- Document sample sizes and sampling methods

### Quality Assessment
- **Excellent**: All tests non-significant, low effect sizes
- **Good**: Most tests non-significant, moderate effect sizes
- **Fair**: Some tests significant, moderate to high effect sizes
- **Poor**: Many tests significant, high effect sizes

## Future Enhancements

### Potential Additions
1. **Wasserstein Distance**: Optimal transport-based comparison
2. **Maximum Mean Discrepancy (MMD)**: Kernel-based comparison
3. **Anderson-Darling Test**: More sensitive than KS for tails
4. **Cramér-von Mises Test**: Alternative to KS test

### Performance Improvements
1. **GPU Acceleration**: Parallel bootstrap computation
2. **Approximate Methods**: Fast approximations for large datasets
3. **Incremental Updates**: Efficient updates for streaming data
4. **Caching**: Reuse computations across test types

## References

1. Székely, G. J., & Rizzo, M. L. (2004). Testing for equal distributions in high dimension. InterStat, 5(16.10), 1249-1272.
2. Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate: a practical and powerful approach to multiple testing. Journal of the Royal Statistical Society: Series B, 57(1), 289-300.
3. Kullback, S., & Leibler, R. A. (1951). On information and sufficiency. The Annals of Mathematical Statistics, 22(1), 79-86.
4. Efron, B., & Tibshirani, R. J. (1994). An introduction to the bootstrap. CRC press. 