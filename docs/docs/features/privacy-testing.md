# Privacy Testing

MAVIS includes fast, practical privacy checks for synthetic data evaluation, integrated directly into the validation workflow.

## Overview

Privacy testing evaluates how well synthetic data preserves privacy compared to the original dataset. MAVIS integrates privacy assessment into the main validation workflow for a comprehensive view of privacy and quality.

## Privacy Metrics Implemented

The privacy block focuses on fast metrics that scale to large datasets:

- **NNDR (Nearest Neighbour Distance Ratio)**
  - Ratio of nearest to second-nearest real neighbor distance for each synthetic row (lower suggests potential similarity to a specific real record).
- **Nearest Neighbor Distance**
  - Distance from each synthetic row to its closest real neighbor; reported via median/mean/quantiles.
- **Exact Match Rate**
  - Percentage of synthetic rows that exactly match any real row (row-wise collision).

## Privacy Test Categories

Privacy tests appear in the "Quality Metrics" category as individual tests with their specific names, e.g.,
`Test Type: privacy test (NNDR)`, `Test Type: privacy test (nearest neighbor distance)`, and `Test Type: privacy test (exact match rate)`.

## Notes on Interpretation

- NNDR and nearest-distance are comparative signals; lower NNDR or very small nearest distances may indicate higher privacy risk.
- Exact-match rate directly flags verbatim copies of real rows. For very large datasets, this check can be disabled via an environment flag (planned).

## Integration with Quality Metrics

Privacy tests are integrated into the "Quality Metrics" category alongside:
- **Data Completeness**: Missing value analysis
- **Data Consistency**: Data type and format consistency
- **Data Quality Assessment**: Overall quality score (SDMetrics)
- **Privacy Test**: DCRBaselineProtection (SDMetrics)

This integration provides a holistic view of synthetic data quality including privacy characteristics.

## Test Execution

### Automatic Execution
Privacy tests run automatically as part of the validation process when both real and synthetic datasets are provided.

### Manual Execution
- Not exposed via standalone endpoints. Privacy results are produced within the main validation workflow.

## Error Handling

### Library Availability
No external privacy libraries are required for the fast checks.

### Data Requirements
If insufficient data is available:
- Tests return `INSUFFICIENT_DATA` status where applicable

### Processing Errors
If privacy tests encounter errors:
- Tests return `ERROR` status with error details
- Validation process continues with other tests

## Output Format

### Test Results Structure
Each privacy test returns structured JSON, for example (NNDR):
```json
{
  "type": "NNDR",
  "metric": "nearest_neighbor_distance_ratio",
  "median": 0.42,
  "mean": 0.45,
  "q25": 0.31,
  "q75": 0.56,
  "result": "SUCCESS",
  "description": "Ratio of nearest to second-nearest real neighbor distances for synthetic samples"
}
```

### Summary Statistics
Privacy test summary includes:
- **Total Tests**: Number of privacy tests executed
- **Status Counts**: ACCEPT/WARNING/REJECT/ERROR totals

## Best Practices

- Use privacy scores alongside statistical quality metrics to balance utility and privacy
- Consider domain-specific risk tolerance when interpreting privacy levels

## Future Enhancements

- **Env flag & threshold**: Option to disable exact-match scanning or auto-disable above a row threshold.
- **Differential Privacy**: Formal guarantees.
- **k-Anonymity**: Additional structural privacy metrics.
