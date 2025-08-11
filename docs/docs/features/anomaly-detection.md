# Anomaly Detection

MAVIS includes advanced anomaly detection capabilities for identifying potential issues in synthetic data generation and distribution patterns.

## Overview

The anomaly detection system uses an adaptive logit-based approach to analyze the spatial distribution of real and synthetic data points, identifying areas where the synthetic data may not accurately represent the real data distribution.

## Grid-Based Analysis

### Visualization
- **Colored Grid Cells**: Anomalous regions are highlighted as rectangles (no circles). High severity cells are red; medium severity cells are amber.
- **Concurrent Interactions**: Grid rectangles are non-interactive; point tooltips and circular selection remain active. Off-point hover shows grid cell info.
- **Point Opacity**: Real and synthetic points render at opacity 0.5 for clarity.

### Spatial Partitioning
- **Data Space Division**: Divides the data space into uniform grid cells
- **Density Analysis**: Calculates point density within each cell
- **Logit Transformation**: Applies logit transformation for robust statistical analysis
- **Coverage Assessment**: Identifies sparse or crowded regions

### Cell Analysis Process
1. **Grid Creation**: Divides data space into configurable grid size
2. **Point Counting**: Counts real and synthetic points in each cell
3. **Logit Calculation**: Computes logit values for each cell
4. **Adaptive Threshold Detection**: Identifies cells with unusual logit values
5. **Pattern Analysis**: Detects systematic distribution issues

## Detection Methods

### Adaptive Logit-Based Detection
- **Global Baseline**: Calculates global logit baseline from dataset characteristics
- **Standard Deviation**: Uses dataset standard deviation for adaptive thresholds
- **Z-Score Analysis**: Identifies cells with significant z-score deviations
- **Statistical Significance**: Uses statistical tests to validate anomalies

### Coverage Analysis
- **Sparse Regions**: Identifies areas with insufficient synthetic data coverage
- **Crowded Regions**: Detects areas with excessive synthetic data concentration
- **Gap Detection**: Finds regions where synthetic data is missing
- **Overlap Assessment**: Analyzes spatial overlap between real and synthetic data

### Mode Collapse Detection
- **Concentration Analysis**: Identifies areas where synthetic data is overrepresented
- **Diversity Assessment**: Measures variety in synthetic data distribution
- **Pattern Recognition**: Detects repetitive or clustered synthetic data patterns
- **Quality Metrics**: Quantifies mode collapse severity

## Anomaly Types

### High Priority Anomalies
- **High Z-Score Deviations**: Cells with |z| > 2 (strong deviation from baseline)
- **Complete Coverage Gaps**: Areas with no synthetic data coverage
- **Mode Collapse**: Significant overrepresentation of synthetic data
- **Statistical Outliers**: Cells with statistically significant anomalies

### Medium Priority Anomalies
- **Medium Z-Score Deviations**: Cells with 1 < |z| ≤ 2 (moderate deviation)
- **Partial Coverage Issues**: Areas with reduced synthetic data coverage
- **Distribution Skews**: Systematic distribution pattern issues

### Low Priority Anomalies
- **Minor Deviations**: Small z-score differences within acceptable ranges (|z| ≤ 1)
- **Edge Cases**: Anomalies in low-density regions
- **Sampling Effects**: Expected variations due to sampling

## Configuration Options

### Grid Parameters
- **Grid Size**: Configurable number of cells per dimension
- **Minimum Density**: Threshold for minimum points per cell
- **Statistical Tests**: Choice of statistical methods for validation

### Analysis Settings
- **Sampling Strategy**: Uses the exact number of points the user selects in the sidebar (e.g., 1000 real + 1000 synthetic). No additional sampling is applied for backend anomaly detection or frontend cell counting. Visualization will render the same set; if totals are <= 8000 there is no downsampling.
- **Iteration Count**: Number of analysis iterations for robustness
- **Confidence Levels**: Statistical confidence thresholds
- **Output Format**: Detailed or summary reporting options

## Results Interpretation

### Anomaly Reports
- **CSV Export**: Global statistics (Global Probability, Global Logit, Logit SD) are guaranteed. Special values (Infinity, -Infinity, NaN) are serialized as strings in the CSV. No threshold parameter is included in CSV.
- **Cell-Level Analysis**: Detailed analysis of each grid cell
- **Pattern Identification**: Recognition of systematic distribution issues
- **Severity Assessment**: Priority-based anomaly classification using z-scores
- **Recommendations**: Specific suggestions for improvement

### Quality Metrics
- **Global Logit**: Baseline logit value for the entire dataset
- **Logit Standard Deviation**: Measure of dataset variability
- **Z-Score Distribution**: Statistical distribution of cell-level deviations
- **Anomaly Rates**: Percentage of anomalous cells and points

## Technical Details

### Logit Transformation
The system uses the logit transformation: `logit(p) = ln(p/(1-p))` where:
- `p` is the proportion of real data in a cell
- The transformation creates an unbounded, symmetric scale
- Facilitates robust statistical analysis

### Adaptive Thresholds (Internal)
We compute global logit and logit SD to characterize dataset behavior. These are used internally to classify anomalies and report z-scores, but are not exposed as user-configurable thresholds nor exported as a separate threshold field in CSV.

### Z-Score Calculation
Z-scores are calculated as:
- `z_score = (logit_cell - logit_global) / logit_sd`
- Used for severity classification and color assignment

### Severity Classification
- **High Severity**: |z| > 2 (Dark Red color)
- **Medium Severity**: 1 < |z| ≤ 2 (Golden Yellow color)
- **Normal**: |z| ≤ 1 (Neutral Gray color)

## Usage

### API Endpoints
- `POST /api/v1/anomaly/detect`: Detect anomalies in provided data
- `POST /api/v1/anomaly/detect-from-job`: Detect anomalies using job data
- `POST /api/v1/anomaly/csv`: Generate CSV report
- `GET /api/v1/anomaly/health`: Health check

### Request Format
```json
{
  "real_data": [[x1, y1], [x2, y2], ...],
  "synthetic_data": [[x1, y1], [x2, y2], ...],
  "grid_size": 20
}
```

### Response Format
```json
{
  "status": "success",
  "statistics": {
    "total_real": 100,
    "total_synthetic": 100,
    "real_anomalies": 10,
    "synthetic_anomalies": 15,
    "logit_global": 0.69,
    "logit_sd": 0.5
  },
  "cell_anomalies": [
    {
      "cell_x": 0,
      "cell_y": 0,
      "p_cell": 0.33,
      "logit_value": -0.405,
      "z_score": -2.19,
      "anomaly_type": "synthetic_overrepresentation",
      "severity": "high",
      "color": "#8B0000"
    }
  ],
  "grid_info": {...}
}
``` 