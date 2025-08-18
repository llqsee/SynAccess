# Histogram-Based Anomaly Detection

MAVIS includes advanced anomaly detection capabilities using histogram-based grid sizing with statistical testing for identifying potential issues in synthetic data generation and distribution patterns.

## Overview

The anomaly detection system uses a histogram-based approach with rigorous statistical testing to analyze the spatial distribution of real and synthetic data points, identifying areas where the synthetic data may not accurately represent the real data distribution.

## Histogram-Based Grid Analysis

### Key Features
- **Histogram-Based Grid Sizing**: X and Y dimensions are binned separately using optimal histogram edges for better data distribution coverage
- **Statistical Testing**: Two one-sided t-tests for mean comparison (real vs synthetic overpopulation)
- **False Discovery Rate (FDR) Correction**: Applied separately to positive and negative tests for robust multiple comparison correction
- **Binary Coloring**: Red for real overpopulation, blue for synthetic overpopulation based on FDR-corrected significance

### Visualization
- **Colored Grid Cells**: Significant anomalous regions are highlighted with binary red/blue coloring based on statistical significance
- **Concurrent Interactions**: Grid rectangles are non-interactive; point tooltips and circular selection remain active. Off-point hover shows grid cell info.
- **Point Opacity**: Real and synthetic points render at opacity 0.5 for clarity.

### Spatial Partitioning
- **Histogram-Based Binning**: Uses numpy histogram functionality to determine optimal bin edges for each dimension separately
- **Flexible Grid Sizes**: Supports different grid sizes for X and Y dimensions (e.g., 20x25 grid)
- **Data-Driven Boundaries**: Grid boundaries are determined by actual data distribution rather than fixed uniform spacing
- **Coverage Assessment**: Identifies sparse or crowded regions with statistical validation

## Statistical Testing Framework

### Two One-Sided Tests
1. **Positive Test**: Tests for real data overpopulation (H1: logit_cell > global_logit)
2. **Negative Test**: Tests for synthetic data overpopulation (H1: logit_cell < global_logit)

### Test Process
1. **Global Logit Calculation**: Computes baseline logit from entire dataset: `logit_global = ln(p_global/(1-p_global))`
2. **Cell-Level Analysis**: For each grid cell with sufficient data points (≥5):
   - Calculate cell-level logit: `logit_cell = ln(p_cell/(1-p_cell))`
   - Compute difference: `logit_diff = logit_cell - logit_global`
   - Estimate standard error using Fisher information
   - Perform one-sample t-test against global mean
3. **Statistical Validation**: Calculate t-statistic and p-values for each test direction
4. **FDR Correction**: Apply Benjamini-Hochberg FDR correction separately to positive and negative test results

### False Discovery Rate (FDR) Correction
- **Separate Correction**: Positive and negative tests are corrected independently
- **Benjamini-Hochberg Method**: Controls false discovery rate at specified α level (default: 0.05)
- **Statistical Rigor**: Ensures robust detection while controlling for multiple comparisons

## Anomaly Types

### Real Overpopulation (Red Cells)
- **Detection**: Positive test significant after FDR correction
- **Interpretation**: Areas where real data is overrepresented relative to synthetic data
- **Color**: Red (#FF0000)
- **Significance**: FDR-corrected p-value < α

### Synthetic Overpopulation (Blue Cells)
- **Detection**: Negative test significant after FDR correction
- **Interpretation**: Areas where synthetic data is overrepresented relative to real data
- **Color**: Blue (#0000FF)
- **Significance**: FDR-corrected p-value < α

### Normal Regions
- **Detection**: Neither test significant after FDR correction
- **Interpretation**: Areas with balanced real/synthetic representation
- **Color**: No highlighting (transparent)

## Configuration Options

### Grid Parameters
- **X Bins**: Number of bins for X dimension (default: 20)
- **Y Bins**: Number of bins for Y dimension (default: 20)
- **FDR Alpha**: Significance level for FDR correction (default: 0.05)
- **Minimum Points**: Threshold for minimum points per cell for testing (5 points)

### Analysis Settings
- **Sampling Strategy**: Uses the exact number of points the user selects in the sidebar (e.g., 1000 real + 1000 synthetic). No additional sampling is applied for backend anomaly detection or frontend cell counting.
- **Statistical Method**: One-sample t-tests with FDR correction
- **Test Direction**: Two one-sided tests (positive and negative)
- **Output Format**: Detailed test statistics and corrected p-values

## Results Interpretation

### Statistical Output
- **CSV Export**: Includes FDR-corrected p-values, test statistics, and global parameters
- **Test Results**: Separate positive and negative test results with statistical details
- **Global Parameters**: Global probability, global logit, and FDR alpha level
- **Cell-Level Analysis**: Detailed statistics for each tested grid cell

### Quality Metrics
- **Global Logit**: Baseline logit value for the entire dataset
- **Global Probability**: Overall proportion of real data points
- **Test Counts**: Number of positive and negative tests conducted
- **Significance Counts**: Number of significant results after FDR correction
- **FDR Alpha**: Significance level used for correction

## Technical Details

### Histogram-Based Grid Creation
```python
# X and Y dimensions binned separately
_, x_bin_edges = np.histogram(x_coords, bins=x_bins)
_, y_bin_edges = np.histogram(y_coords, bins=y_bins)
```

### Statistical Testing
```python
# One-sample t-test for cell vs global mean
t_stat = logit_diff / se_logit
p_positive = 1 - stats.t.cdf(t_stat, df)  # Real overpopulation
p_negative = stats.t.cdf(t_stat, df)      # Synthetic overpopulation
```

### FDR Correction
```python
# Applied separately to each test type
rejected, p_adjusted = fdrcorrection(p_values, alpha=fdr_alpha, method='indep')
```

### Standard Error Estimation
Standard error for logit scale using Fisher information:
```python
fisher_info = total_cell * p_cell * (1 - p_cell)
se_logit = 1.0 / sqrt(fisher_info)
```

## Usage

### API Endpoints
- `POST /api/v1/anomaly/detect`: Detect anomalies in provided data
- `POST /api/v1/anomaly/detect-from-job`: Detect anomalies using job data
- `POST /api/v1/anomaly/csv`: Generate CSV report with test statistics
- `GET /api/v1/anomaly/health`: Health check

### Request Format
```json
{
  "real_data": [[x1, y1], [x2, y2], ...],
  "synthetic_data": [[x1, y1], [x2, y2], ...],
  "x_bins": 20,
  "y_bins": 20,
  "fdr_alpha": 0.05
}
```

### Response Format
```json
{
  "status": "success",
  "statistics": {
    "total_real": 100,
    "total_synthetic": 100,
    "real_anomalies": 5,
    "synthetic_anomalies": 8,
    "positive_tests_conducted": 15,
    "negative_tests_conducted": 12,
    "positive_significant": 3,
    "negative_significant": 5,
    "global_logit": 0.693,
    "p_global": 0.667,
    "fdr_alpha": 0.05
  },
  "positive_tests": [
    {
      "cell_x": 2,
      "cell_y": 3,
      "real_count": 8,
      "synthetic_count": 2,
      "total_count": 10,
      "p_cell": 0.8,
      "logit_cell": 1.386,
      "logit_diff": 0.693,
      "t_stat": 2.45,
      "p_value": 0.01,
      "p_value_adjusted": 0.03,
      "is_significant": true,
      "test_type": "real_overpopulation",
      "color": "#FF0000"
    }
  ],
  "negative_tests": [
    {
      "cell_x": 5,
      "cell_y": 7,
      "real_count": 1,
      "synthetic_count": 9,
      "total_count": 10,
      "p_cell": 0.1,
      "logit_cell": -2.197,
      "logit_diff": -2.890,
      "t_stat": -4.12,
      "p_value": 0.002,
      "p_value_adjusted": 0.008,
      "is_significant": true,
      "test_type": "synthetic_overpopulation",
      "color": "#0000FF"
    }
  ],
  "grid_info": {
    "x_bins": [x_bin_edges],
    "y_bins": [y_bin_edges],
    "x_grid_size": 20,
    "y_grid_size": 20,
    "bounds": {
      "x_min": -2.5,
      "x_max": 2.5,
      "y_min": -2.0,
      "y_max": 2.0
    }
  }
}
```