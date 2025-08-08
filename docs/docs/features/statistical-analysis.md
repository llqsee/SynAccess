# Statistical Analysis

MAVIS provides comprehensive statistical analysis tools for comparing real and synthetic data using advanced multivariate tests and robust statistical methods.

## Overview

The statistical analysis system employs a sophisticated approach combining multiple statistical tests with False Discovery Rate (FDR) correction to provide reliable and comprehensive data quality assessment.

## Statistical Test Categories

### Distribution Comparison Tests

#### Kolmogorov-Smirnov Test
- **Purpose**: Tests for distribution similarity between real and synthetic data
- **Application**: Continuous variables and ordinal categorical variables
- **Output**: KS statistic and p-value indicating distribution similarity
- **Interpretation**: Lower p-values indicate significant distribution differences

#### Energy Test
- **Purpose**: Multivariate distribution comparison using energy distance
- **Application**: Multi-dimensional data analysis
- **Advantages**: More powerful than KS test for multivariate data
- **Output**: Energy statistic and p-value for multivariate similarity

#### Total Variation Distance
- **Purpose**: Measures the maximum difference between probability distributions
- **Application**: Discrete and continuous variables
- **Range**: 0 (identical) to 1 (completely different)
- **Interpretation**: Lower values indicate better distribution similarity

### Central Tendency Tests

#### Welch's t-Test
- **Purpose**: Compares means between real and synthetic data
- **Application**: Continuous variables with normal distribution
- **Advantages**: Handles unequal variances and sample sizes
- **Output**: t-statistic, p-value, and confidence intervals

### Categorical Data Tests

#### Chi-Square Test
- **Purpose**: Tests independence and distribution similarity for categorical variables
- **Application**: Nominal and ordinal categorical variables
- **Requirements**: Expected frequencies ≥ 5 per cell
- **Output**: Chi-square statistic and p-value

### Correlation Analysis

#### Pearson Correlation
- **Purpose**: Measures linear correlation between variables
- **Application**: Continuous variables
- **Range**: -1 (perfect negative) to +1 (perfect positive)
- **Preservation**: Ensures synthetic data maintains correlation patterns

#### Spearman Correlation
- **Purpose**: Measures rank correlation between variables
- **Application**: Ordinal variables and non-linear relationships
- **Robustness**: Less sensitive to outliers than Pearson
- **Output**: Rank correlation coefficient and p-value

### Advanced Multivariate Tests

#### KL Divergence
- **Purpose**: Measures information loss between distributions
- **Application**: Continuous and discrete variables
- **Interpretation**: Lower values indicate better distribution preservation
- **Advantages**: Asymmetric measure capturing distribution differences

#### Jensen-Shannon Distance
- **Purpose**: Symmetric measure of distribution similarity
- **Application**: All variable types
- **Range**: 0 (identical) to 1 (completely different)
- **Advantages**: Bounded and symmetric measure

## False Discovery Rate (FDR) Correction

### Multiple Testing Problem
- **Issue**: Running multiple statistical tests increases false positive rate
- **Solution**: FDR correction controls expected proportion of false discoveries
- **Methods**: Benjamini-Hochberg procedure for p-value adjustment

### FDR Implementation
- **Procedure**: Sort p-values, apply correction factor
- **Threshold**: Typically α = 0.05 for significance
- **Output**: Adjusted p-values maintaining statistical rigor
- **Benefits**: Reduces false positives while maintaining power

## Dynamic Sampling Strategy

### Optimal Sample Sizes
- **KS Test**: 1,000 samples (optimal for distribution comparison)
- **t-Test**: 500 samples (optimal for mean comparison)
- **Chi-Square**: 1,000 samples (optimal for categorical comparison)
- **Correlation**: 500 samples (optimal for correlation analysis)
- **Energy Test**: 1,000 samples (optimal for multivariate comparison)
- **Outlier Detection**: 2,000 samples (optimal for outlier patterns)

### Multiple Iterations
- **KS Test**: 5 iterations with different random samples
- **t-Test**: 3 iterations for robust mean comparison
- **Chi-Square**: 3 iterations for categorical analysis
- **Energy Test**: 3 iterations for multivariate analysis
- **Other Tests**: Single iteration for performance

### Result Aggregation
- **Rejection Rate**: Percentage of iterations rejecting null hypothesis
- **Mean Statistics**: Average test statistics across iterations
- **Consensus Decision**: Overall result based on iteration agreement
- **Confidence Intervals**: Statistical uncertainty quantification

## Quality Assessment Framework

### Test Result Structure
```json
{
  "test_name": "Kolmogorov-Smirnov",
  "variable": "feature_name",
  "statistic": 0.123,
  "p_value": 0.045,
  "adjusted_p_value": 0.052,
  "status": "FAIL",
  "severity": "MEDIUM",
  "iterations": 5,
  "rejection_rate": 0.6,
  "confidence_interval": [0.098, 0.148]
}
```

### Severity Classification
- **HIGH**: Significant statistical difference (p < 0.01)
- **MEDIUM**: Moderate difference (0.01 ≤ p < 0.05)
- **LOW**: Minor difference (0.05 ≤ p < 0.1)
- **PASS**: No significant difference (p ≥ 0.1)

### Overall Quality Scoring
- **EXCELLENT**: 90-100% of tests pass
- **GOOD**: 75-89% of tests pass
- **FAIR**: 60-74% of tests pass
- **POOR**: <60% of tests pass

## Statistical Best Practices

### Test Selection
1. **Variable Type**: Choose appropriate test for data type
2. **Sample Size**: Ensure sufficient power for statistical tests
3. **Distribution Assumptions**: Verify test assumptions
4. **Multiple Testing**: Apply FDR correction for multiple comparisons

### Interpretation Guidelines
- **Context Matters**: Consider domain-specific expectations
- **Effect Size**: Consider practical significance beyond statistical significance
- **Confidence Intervals**: Use for uncertainty quantification
- **Replication**: Multiple iterations for robust results

### Reporting Standards
- **Transparency**: Report all test parameters and results
- **Effect Sizes**: Include practical significance measures
- **Confidence Levels**: Specify statistical confidence
- **Limitations**: Acknowledge test assumptions and limitations

## Integration with Validation System

### Comprehensive Assessment
- **Multi-dimensional Analysis**: Combines multiple statistical perspectives
- **Robust Results**: Multiple iterations reduce sampling variability
- **Quality Metrics**: Quantitative assessment of synthetic data quality
- **Actionable Insights**: Specific recommendations for improvement

### Performance Optimization
- **Efficient Sampling**: Optimal sample sizes for reliable results
- **Parallel Processing**: Concurrent execution of multiple tests
- **Memory Management**: Efficient handling of large datasets
- **Progress Tracking**: Real-time status updates during analysis