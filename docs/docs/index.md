# MAVIS - Scalable Visualization and Explainability of Synthetic Datasets

> **MAVIS** is a professional web tool for evaluating and comparing synthetic data quality. It provides interactive tools to compare real and synthetic datasets using advanced visualizations and statistical analysis.

---

## Quick Start

=== "Backend Setup"
    ```bash
    conda activate mavis
    cd backend
    python main.py
    ```

=== "Frontend Setup"
    ```bash
    cd frontend
    npm start
    ```

=== "Begin Analysis"
    - Upload your real and synthetic datasets
    - Configure UMAP/t-SNE parameters
    - Generate interactive visualizations
    - Compare distributions and quality metrics
    - Export results and reports

---

## Key Features

!!! info "Interactive Data Upload"
    - Multi-format support: CSV, Excel, and JSON files
    - Real-time validation: Instant feedback on data quality
    - Large dataset handling: Efficient processing of 1M+ samples (hardware dependent)
    - Smart preprocessing: Automatic data type detection and cleaning

!!! info "Advanced Visualizations"
    - Interactive scatter plots: Zoom, pan, and select data points
    - Distribution comparisons: Side-by-side real vs synthetic analysis
    - Statistical overlays: Mean, median, confidence intervals
    - Color-coded analysis: Distinguish real and synthetic data points

!!! info "Statistical Analysis"
    - Kolmogorov-Smirnov tests: Formal distribution similarity testing
    - Chi-square analysis: Categorical variable comparison
    - Correlation analysis: Preserve multivariate relationships
    - Quality metrics: Objective scoring and recommendations

!!! info "Data Validation & Quality Assessment"
    - Comprehensive validation: Range, distribution, correlation tests
    - Quality scoring: EXCELLENT, GOOD, FAIR, POOR classifications
    - Issue detection: Critical, High, Medium, Low priority alerts
    - Recommendations: Specific suggestions for improvement

!!! info "Performance Monitoring & Job Management"
    - Real-time dashboard: API performance and memory usage
    - Background processing: Non-blocking computation with progress tracking
    - Job history: Filter, search, and manage completed analyses
    - Export results: Multiple format support for sharing

---

## Architecture Overview

!!! info "System Architecture"
    - **Frontend**: React + Material-UI + D3.js
    - **Backend**: FastAPI + UMAP/t-SNE
    - **Database**: SQLite
    - **Deployment**: Docker + nginx

---

## Performance Benchmarks

| Speed (Blue)           | Scalability (Blue)      | Accuracy (Blue)           |
|------------------------|-------------------------|---------------------------|
| 100k samples: <30s     | Scalable to millions of samples (hardware dependent) | Statistical tests: 95%+   |
| Real-time updates: <100ms | Memory efficient      | Quality assessment: comprehensive |
| 60fps visualizations   | Background processing   | High-resolution outputs    |

---

## Technical Stack

!!! info "Backend Technologies"
    - FastAPI: High-performance Python web framework
    - UMAP: Advanced dimensionality reduction
    - openTSNE: Alternative visualization technique
    - SQLite: Lightweight database for job management

!!! info "Frontend Technologies"
    - React: Modern JavaScript framework
    - Material-UI: Professional component library
    - D3.js: Interactive data visualizations
    - Plotly.js: Statistical charting library

!!! info "Development Tools"
    - Conda: Environment management
    - Docker: Containerization
    - GitHub Actions: CI/CD pipeline
    - Jest & pytest: Comprehensive testing

---

## Use Cases

!!! info "Research & Academia"
    - Synthetic data evaluation
    - Methodology comparison
    - Publication support
    - Reproducibility

!!! info "Industry Applications"
    - Data privacy
    - Model validation
    - Quality assurance
    - Compliance

!!! info "Education & Training"
    - Data science education
    - Workshop tools
    - Research training
    - Best practices