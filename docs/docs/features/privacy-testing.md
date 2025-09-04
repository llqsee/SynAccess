# Privacy Testing

MAVIS includes comprehensive privacy testing capabilities for synthetic data evaluation using established privacy assessment libraries and methodologies.

## Overview

Privacy testing evaluates how well synthetic data preserves privacy compared to the original dataset. MAVIS integrates privacy assessment into the main validation workflow for a comprehensive view of privacy and quality.

## Privacy Testing Libraries

MAVIS uses industry-standard privacy testing libraries:

### SDMetrics
- **Purpose**: Synthetic data quality and privacy metrics
- **Metrics**: 
  - Diagnostic Report quality score
  - DCRBaselineProtection (privacy)
- **Implementation**: `sdmetrics.reports.single_table.DiagnosticReport`, `sdmetrics.single_table.privacy.DCRBaselineProtection`

## Privacy Test Categories

### 1. Data Quality Assessment (SDMetrics Diagnostic Report)
- **Test Type**: `Data Quality Assessment`
- **Metric**: `sdmetrics_diagnostic_quality`
- **Description**: Overall data quality score from SDMetrics Diagnostic Report
- **Output**: Quality score (0-1) and qualitative level

### 2. DCRBaselineProtection (SDMetrics)
- **Test Type**: `DCRBaselineProtection`
- **Metric**: `dcr_baseline_protection`
- **Description**: Distance between real and synthetic records vs random baseline (higher → better privacy)
- **Output**: Privacy score (0-1), privacy level assessment

## Privacy Level Assessment

MAVIS maps privacy scores to levels and result labels:

- **HIGH** (score > 0.8) → `result`: `ACCEPT`
- **MEDIUM** (score > 0.6) → `result`: `WARNING`
- **LOW** (score ≤ 0.6) → `result`: `REJECT`

## Integration with Quality Metrics

Privacy tests are integrated into the "Quality Metrics" category alongside:
- **Data Completeness**: Missing value analysis
- **Data Consistency**: Data type and format consistency
- **Data Quality Assessment**: Overall quality score (SDMetrics)
- **Privacy Test**: DCRBaselineProtection (SDMetrics)

This integration provides a holistic view of synthetic data quality including privacy characteristics.

## Test Execution

### Automatic Execution
Privacy tests run automatically as part of the validation process when:
- Both real and synthetic datasets are provided
- Required privacy libraries are installed

### Manual Execution
- Not exposed via standalone endpoints. Privacy results are produced within the main validation workflow.

## Error Handling

### Library Availability
If privacy testing libraries are not installed:
- Tests return `LIBRARY_NOT_AVAILABLE` status
- Other validation tests continue normally

### Data Requirements
If insufficient data is available:
- Tests return `INSUFFICIENT_DATA` status where applicable

### Processing Errors
If privacy tests encounter errors:
- Tests return `ERROR` status with error details
- Validation process continues with other tests

## Output Format

### Test Results Structure
Each privacy test returns:
```json
{
  "type": "DCRBaselineProtection",
  "metric": "dcr_baseline_protection",
  "privacy_score": 0.85,
  "privacy_level": "HIGH|MEDIUM|LOW",
  "result": "ACCEPT|WARNING|REJECT",
  "description": "...",
  "interpretation": "..."
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

- **Differential Privacy**: Formal differential privacy guarantees
- **k-Anonymity**: k-anonymity assessment capabilities
- **Custom Metrics**: User-defined privacy assessment criteria
