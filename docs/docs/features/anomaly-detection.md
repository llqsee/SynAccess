# Anomaly Detection

MAVIS provides advanced anomaly detection capabilities using histogram-based grid sizing and statistical proportion testing. This system identifies regions where synthetic data significantly differs from real data patterns.

## Overview

The anomaly detection system uses a **histogram-based grid approach** with **binomial proportion tests** to identify statistically significant differences between real and synthetic data distributions. Unlike traditional methods that use complex transformations, this approach directly compares proportions using rigorous statistical testing.

## How It Works

### 1. Histogram-Based Grid Creation

The system creates a grid overlay on the 2D embedding space using histogram-based binning:

```python
# Create histograms for each dimension separately
_, x_bin_edges = np.histogram(x_coords, bins=x_bins)
_, y_bin_edges = np.histogram(y_coords, bins=y_bins)
```

**Key Features:**
- **Adaptive sizing**: Grid cells adapt to data distribution
- **Separate dimensions**: X and Y dimensions are binned independently
- **Optimal coverage**: Ensures all data points are captured within grid bounds

### 2. Proportion Calculation

For each grid cell, the system calculates the proportion of real data points:

```python
# For each cell (i, j)
real_count = count_of_real_points_in_cell(i, j)
synthetic_count = count_of_synthetic_points_in_cell(i, j)
total_cell = real_count + synthetic_count
cell_proportion = real_count / total_cell

# Global baseline
global_proportion = total_real / (total_real + total_synthetic)
```

### 3. Statistical Testing

The system performs **two one-sided binomial proportion tests** for each cell:

#### Test A: Real Overpopulation
```python
# Test if cell has significantly more real data than expected
test_a = binomtest(real_count, total_cell, p=global_proportion, alternative='greater')
```

#### Test B: Synthetic Overpopulation
```python
# Test if cell has significantly more synthetic data than expected
test_b = binomtest(real_count, total_cell, p=global_proportion, alternative='less')
```

### 4. Multiple Testing Correction

To control for false discoveries when testing multiple cells, the system applies **False Discovery Rate (FDR) correction**:

```python
# Apply FDR correction separately to positive and negative tests
rejected_positive, p_adjusted_positive = fdrcorrection(p_values_positive, alpha=fdr_alpha)
rejected_negative, p_adjusted_negative = fdrcorrection(p_values_negative, alpha=fdr_alpha)
```

### 5. Visualization

Significant cells are colored based on the type of overpopulation detected:

- **Red cells**: Significant real overpopulation (more real data than expected)
- **Blue cells**: Significant synthetic overpopulation (more synthetic data than expected)
- **Gray cells**: No significant difference detected

## Configuration Options

### Grid Parameters

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `x_bins` | Number of bins for X dimension | 20 | 5-100 |
| `y_bins` | Number of bins for Y dimension | 20 | 5-100 |
| `fdr_alpha` | Significance level for FDR correction | 0.05 | 0.001-0.5 |

### Statistical Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `min_points_threshold` | Minimum points required per cell for testing | 5 |
| `test_type` | Type of statistical test | `binomtest` |

## API Usage

### Detect Anomalies

```python
import requests

# Detect anomalies with custom parameters
response = requests.post("http://localhost:8000/api/v1/anomaly/detect-anomalies", json={
    "real_data": [[x1, y1], [x2, y2], ...],
    "synthetic_data": [[x1, y1], [x2, y2], ...],
    "x_bins": 20,
    "y_bins": 20,
    "fdr_alpha": 0.05
})

results = response.json()
```

### Detect Anomalies from Job

```python
# Use data from a previously completed embedding job
response = requests.post("http://localhost:8000/api/v1/anomaly/detect-anomalies-from-job", json={
    "job_id": 123,
    "x_bins": 20,
    "y_bins": 20,
    "fdr_alpha": 0.05
})
```

### Generate CSV Report

```python
# Generate detailed CSV report
response = requests.post("http://localhost:8000/api/v1/anomaly/generate-anomaly-csv", json={
    "real_data": real_data,
    "synthetic_data": synthetic_data,
    "x_bins": 20,
    "y_bins": 20,
    "fdr_alpha": 0.05
})

csv_content = response.json()["csv_content"]
```

## Response Format

### Main Response Structure

```json
{
  "status": "success",
  "message": "Detected X real anomalies and Y synthetic anomalies using histogram-based binomial proportion tests with FDR correction",
  "statistics": {
    "total_real": 1000,
    "total_synthetic": 500,
    "real_anomalies": 25,
    "synthetic_anomalies": 15,
    "real_anomaly_rate": 0.025,
    "synthetic_anomaly_rate": 0.030,
    "x_grid_size": 20,
    "y_grid_size": 20,
    "total_anomaly_cells": 40,
    "positive_tests_conducted": 150,
    "negative_tests_conducted": 120,
    "positive_significant": 25,
    "negative_significant": 15,
    "fdr_alpha": 0.05,
    "global_proportion": 0.667
  },
  "grid_info": {
    "x_bins": [x_min, x1, x2, ..., x_max],
    "y_bins": [y_min, y1, y2, ..., y_max],
    "x_grid_size": 20,
    "y_grid_size": 20,
    "bounds": {
      "x_min": -5.2,
      "x_max": 5.8,
      "y_min": -4.9,
      "y_max": 5.1
    }
  },
  "positive_tests": [...],
  "negative_tests": [...],
  "proportion_thresholds": {
    "global_proportion": 0.667,
    "fdr_alpha": 0.05
  }
}
```

### Test Results Structure

Each test result contains:

```json
{
  "cell_x": 5,
  "cell_y": 3,
  "real_count": 8,
  "synthetic_count": 2,
  "total_count": 10,
  "cell_proportion": 0.8,
  "global_proportion": 0.667,
  "proportion_diff": 0.133,
  "p_value": 0.0234,
  "p_value_adjusted": 0.0456,
  "is_significant": true,
  "test_type": "real_overpopulation",
  "color": "#FF0000"
}
```

## CSV Report Format

The CSV report includes:

### Header Section
```csv
# Histogram-Based Anomaly Detection Results (Binomial Proportion Tests)
# Grid Size: 20x20
# Global Proportion: 0.667
# FDR Alpha Level: 0.05
# Total Real Points: 1000
# Total Synthetic Points: 500
# Real Anomalies Detected: 25
# Synthetic Anomalies Detected: 15
# Positive Tests Conducted: 150
# Negative Tests Conducted: 120
# Positive Significant: 25
# Negative Significant: 15
```

### Cell-Level Analysis
```csv
cell_x,cell_y,real_count,synthetic_count,total_count,cell_proportion,global_proportion,proportion_diff,p_value,p_value_adjusted,is_significant,test_type,color
5,3,8,2,10,0.800,0.667,0.133,0.0234,0.0456,true,real_overpopulation,#FF0000
```

### Point-Level Data
```csv
index,grid_cell_x,grid_cell_y,is_anomaly,data_type
0,5,3,true,real
1,5,3,true,real
2,4,2,false,synthetic
```

## Statistical Interpretation

### Understanding Results

1. **Cell Proportions**: Each cell shows the ratio of real data points to total points
2. **Global Baseline**: The overall proportion of real data in the entire dataset
3. **Statistical Significance**: Cells with p-values below the FDR-corrected threshold
4. **Effect Size**: The difference between cell proportion and global proportion

### Interpreting Colors

- **Red cells**: These regions have significantly more real data than expected
  - May indicate areas where synthetic data generation is insufficient
  - Could represent regions of high complexity in the original data

- **Blue cells**: These regions have significantly more synthetic data than expected
  - May indicate over-generation in certain areas
  - Could represent regions where synthetic data is too concentrated

### Quality Assessment

- **Few significant cells**: Good synthetic data quality
- **Many red cells**: Synthetic data may be missing important patterns
- **Many blue cells**: Synthetic data may be over-generating in certain areas
- **Balanced distribution**: Ideal synthetic data should match real data proportions

## Advantages of This Approach

### Statistical Rigor
- **Proper hypothesis testing**: Uses binomial tests appropriate for proportion data
- **Multiple testing correction**: FDR correction controls false discoveries
- **Effect size consideration**: Reports actual proportion differences

### Intuitive Interpretation
- **Direct proportion comparison**: No complex transformations required
- **Clear visual feedback**: Red/blue coloring immediately shows problem areas
- **Comprehensive reporting**: Detailed statistics for each cell

### Flexibility
- **Adaptive grid sizing**: Histogram-based approach adapts to data distribution
- **Configurable parameters**: Adjustable grid size and significance levels
- **Multiple output formats**: API responses, CSV reports, and visual overlays

## Best Practices

### Parameter Selection

1. **Grid Size**: 
   - Too small: May miss fine-grained patterns
   - Too large: May have insufficient data per cell
   - Recommended: 15-25 bins per dimension

2. **FDR Alpha**:
   - Lower values: More conservative, fewer false positives
   - Higher values: More sensitive, may include false positives
   - Recommended: 0.05 for most applications

3. **Minimum Points Threshold**:
   - Ensures sufficient data for reliable statistical testing
   - Recommended: 5-10 points per cell minimum

### Data Requirements

- **Minimum dataset size**: At least 100 points total
- **Balanced representation**: Both real and synthetic data should be present
- **2D coordinates**: Requires UMAP or t-SNE embedding results

### Interpretation Guidelines

1. **Consider context**: Anomalies may be expected in certain regions
2. **Check sample sizes**: Ensure sufficient data in each cell
3. **Review global proportions**: Understand the baseline distribution
4. **Examine effect sizes**: Focus on cells with large proportion differences

## Troubleshooting

### Common Issues

1. **No significant cells detected**:
   - Check if FDR alpha is too conservative
   - Verify sufficient data points per cell
   - Consider reducing grid size

2. **Too many significant cells**:
   - Increase FDR alpha for more conservative testing
   - Check data quality and preprocessing
   - Consider increasing grid size

3. **Extreme proportions (0% or 100%)**:
   - May indicate data separation issues
   - Check embedding quality
   - Consider adjusting UMAP/t-SNE parameters

### Performance Optimization

- **Large datasets**: Use larger grid sizes to reduce computation time
- **Memory usage**: Monitor cell count and adjust parameters accordingly
- **Real-time analysis**: Consider caching results for repeated analysis