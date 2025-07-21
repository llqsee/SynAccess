#!/usr/bin/env python3
"""
Script to create placeholder files for all missing documentation pages.
"""

import os

# Define the missing files and their content
missing_files = {
    # Features
    "features/statistical-analysis.md": """# Statistical Analysis

MAVIS provides comprehensive statistical analysis tools for comparing real and synthetic data.

## Distribution Comparisons

- **Histograms**: Visual comparison of distributions
- **Violin Plots**: Density-based distribution analysis
- **Statistical Tests**: Kolmogorov-Smirnov and Chi-square tests

## Correlation Analysis

- **Feature Relationships**: Preserves correlation patterns
- **Covariance Analysis**: Ensures multivariate relationships
- **Dependency Structure**: Validates conditional dependencies

*This page is under construction. More detailed content will be added soon.*""",

    "features/data-validation.md": """# Data Validation

MAVIS includes a comprehensive data validation system for synthetic data quality assessment.

## Validation Categories

- **Range Validation**: Bounds checking and outlier detection
- **Distribution Validation**: Statistical similarity tests
- **Correlation Validation**: Feature relationship preservation
- **Statistical Validation**: Mean, variance, skewness, kurtosis

## Quality Scoring

- **Pass Rate**: Percentage of tests that pass validation
- **Severity Levels**: Critical, High, Medium, Low priority
- **Overall Status**: EXCELLENT, GOOD, FAIR, POOR

*This page is under construction. More detailed content will be added soon.*""",

    "features/performance-monitoring.md": """# Performance Monitoring

MAVIS includes real-time performance monitoring and analytics.

## Monitoring Features

- **Real-time Metrics**: Response times, memory usage
- **API Performance**: Call tracking and error analysis
- **User Interactions**: Behavior patterns and analytics
- **System Health**: Overall application stability

## Dashboard Features

- **Performance Dashboard**: Real-time metrics display
- **Resource Monitoring**: CPU and memory utilization
- **User Analytics**: Interaction patterns and feature usage
- **Error Tracking**: Categorization and analysis

*This page is under construction. More detailed content will be added soon.*""",

    "features/job-management.md": """# Job Management

MAVIS provides comprehensive job management for background processing.

## Job Features

- **Background Processing**: Non-blocking computation
- **Progress Tracking**: Real-time progress indicators
- **Job History**: Complete history with filtering
- **Export Capabilities**: Multiple format support

## Management Tools

- **Job History**: View all completed embeddings
- **Favorites**: Save important jobs for quick access
- **Search and Filter**: Find specific jobs quickly
- **Export Results**: Download visualizations and reports

*This page is under construction. More detailed content will be added soon.*""",

    # User Guide
    "user-guide/upload-data.md": """# Upload Data

Learn how to upload and prepare your data for analysis in MAVIS.

## File Requirements

- **Supported Formats**: CSV, Excel (.xlsx, .xls), JSON
- **File Size**: Maximum 100MB per file
- **Data Types**: Numeric, categorical, datetime
- **Structure**: Real and synthetic datasets must have same columns

## Upload Process

1. **Navigate to Data Upload tab**
2. **Select real dataset file**
3. **Select synthetic dataset file**
4. **Review validation results**
5. **Proceed to analysis**

*This page is under construction. More detailed content will be added soon.*""",

    "user-guide/configure-parameters.md": """# Configure Parameters

Learn how to configure UMAP and t-SNE parameters for optimal results.

## UMAP Parameters

- **n_neighbors**: Number of neighboring points (2-200)
- **min_dist**: Minimum distance between points (0.0-0.99)
- **n_components**: Target dimensionality (2 or 3)

## Parameter Presets

- **Detailed View**: n_neighbors=5, min_dist=0.05
- **Balanced View**: n_neighbors=15, min_dist=0.1
- **Overview Mode**: n_neighbors=50, min_dist=0.5

*This page is under construction. More detailed content will be added soon.*""",

    "user-guide/generate-embeddings.md": """# Generate Embeddings

Learn how to generate dimensionality reduction embeddings in MAVIS.

## Generation Process

1. **Upload your datasets**
2. **Configure parameters**
3. **Click "Generate Embeddings"**
4. **Wait for processing**
5. **Explore results**

## Processing Options

- **UMAP**: Recommended for most datasets
- **t-SNE**: Alternative for local structure
- **Parameter Tuning**: Real-time adjustments
- **Progress Tracking**: Live progress indicators

*This page is under construction. More detailed content will be added soon.*""",

    "user-guide/explore-results.md": """# Explore Results

Learn how to explore and interact with your visualization results.

## Navigation Controls

- **Zoom**: Scroll wheel or pinch gestures
- **Pan**: Click and drag to move around
- **Reset View**: Double-click to reset
- **Point Selection**: Click and drag to select

## Interactive Features

- **Hover Information**: See original data values
- **Legend Toggle**: Show/hide datasets
- **Distribution Sidebar**: Statistical comparisons
- **Variable Selection**: Switch between features

*This page is under construction. More detailed content will be added soon.*""",

    "user-guide/validate-data.md": """# Validate Data Quality

Learn how to validate synthetic data quality using MAVIS.

## Validation Process

1. **Navigate to Summary tab**
2. **Click "Run Validation"**
3. **Review quality scores**
4. **Address critical issues**
5. **Export validation report**

## Validation Types

- **Range Validation**: Check data bounds
- **Distribution Validation**: Statistical similarity
- **Correlation Validation**: Feature relationships
- **Overall Quality Score**: Percentage passed

*This page is under construction. More detailed content will be added soon.*""",

    "user-guide/monitor-performance.md": """# Monitor Performance

Learn how to monitor system performance and user analytics.

## Performance Dashboard

- **Real-time Metrics**: Response times, memory usage
- **API Performance**: Call tracking and analysis
- **User Interactions**: Behavior patterns
- **System Health**: Overall stability

## Analytics Features

- **Performance Trends**: Historical analysis
- **Resource Usage**: CPU and memory patterns
- **User Experience**: Page load times
- **Error Tracking**: Categorization and alerts

*This page is under construction. More detailed content will be added soon.*""",

    "user-guide/manage-jobs.md": """# Manage Jobs

Learn how to manage your background processing jobs.

## Job Management

- **View History**: All completed embeddings
- **Search Jobs**: Find specific results
- **Filter Options**: By date, status, type
- **Favorites**: Save important jobs

## Job Actions

- **Export Results**: Download visualizations
- **Delete Jobs**: Remove old results
- **Rename Jobs**: Custom labels
- **Share Results**: Export for collaboration

*This page is under construction. More detailed content will be added soon.*""",

    "user-guide/export-results.md": """# Export Results

Learn how to export your analysis results and visualizations.

## Export Formats

- **Images**: PNG, SVG for visualizations
- **Reports**: PDF with all charts
- **Data**: CSV for external analysis
- **Configurations**: Save parameter settings

## Export Options

- **High Resolution**: For publications
- **Interactive**: HTML with JavaScript
- **Batch Export**: Multiple files at once
- **Custom Formatting**: Branded reports

*This page is under construction. More detailed content will be added soon.*""",

    # Technical
    "technical/api-reference.md": """# API Reference

Complete API documentation for MAVIS backend services.

## Endpoints

### Embedding Generation
- `POST /api/v1/embed` - Generate embeddings
- `GET /api/v1/embed/{job_id}` - Get embedding results

### Distribution Analysis
- `POST /api/v1/distribution` - Analyze distributions
- `GET /api/v1/distribution/{job_id}` - Get analysis results

### Job Management
- `GET /api/v1/history` - Get job history
- `DELETE /api/v1/history/{job_id}` - Delete job

### Health Check
- `GET /api/v1/health` - System health status

*This page is under construction. More detailed content will be added soon.*""",

    "technical/umap-configuration.md": """# UMAP Configuration

Detailed guide to UMAP parameters and configuration in MAVIS.

## Core Parameters

### n_neighbors
- **Range**: 2-200
- **Default**: 15
- **Effect**: Controls local vs global structure balance

### min_dist
- **Range**: 0.0-0.99
- **Default**: 0.1
- **Effect**: Controls point spacing in visualization

### n_components
- **Options**: 2 or 3
- **Default**: 2
- **Effect**: Output dimensionality

## Advanced Parameters

### metric
- **Options**: euclidean, manhattan, cosine
- **Default**: euclidean
- **Effect**: Distance calculation method

### random_state
- **Type**: integer
- **Default**: 42
- **Effect**: Reproducible results

*This page is under construction. More detailed content will be added soon.*""",

    "technical/data-validation.md": """# Data Validation

Technical details of MAVIS's data validation framework.

## Validation Framework

### Range Validation
- **Bounds Checking**: Ensure values within expected ranges
- **Outlier Detection**: Identify unrealistic values
- **Data Type Consistency**: Validate categorical/numerical types

### Distribution Validation
- **Kolmogorov-Smirnov Test**: Statistical similarity
- **Percentile Analysis**: Key percentile preservation
- **Density Estimation**: Kernel density comparison

### Correlation Validation
- **Feature Relationships**: Preserve correlation patterns
- **Covariance Analysis**: Multivariate relationships
- **Dependency Structure**: Conditional dependencies

*This page is under construction. More detailed content will be added soon.*""",

    "technical/performance-monitoring.md": """# Performance Monitoring

Technical details of MAVIS's performance monitoring system.

## Monitoring Architecture

### Client-side Monitoring
- **Component Render Times**: React performance tracking
- **User Interactions**: Click and hover analytics
- **Memory Usage**: Browser memory monitoring
- **Error Boundaries**: JavaScript error tracking

### Server-side Metrics
- **API Response Times**: Endpoint performance
- **Database Queries**: Query optimization
- **Background Jobs**: Processing metrics
- **System Resources**: CPU and memory usage

## Analytics Features

### Real-time Dashboard
- **Live Metrics**: Current system status
- **Historical Trends**: Performance over time
- **Alert System**: Threshold-based notifications
- **Export Capabilities**: Data export for analysis

*This page is under construction. More detailed content will be added soon.*""",

    # Development
    "development/setup.md": """# Development Setup

Guide for setting up the MAVIS development environment.

## Prerequisites

- **Python 3.10+**: Core runtime
- **Node.js 16+**: Frontend development
- **Git**: Version control
- **Conda**: Environment management

## Backend Setup

```bash
# Create environment
conda env create -f environment.yml
conda activate mavis

# Install dependencies
cd backend
pip install -r requirements.txt

# Run development server
python main.py
```

## Frontend Setup

```bash
# Install dependencies
cd frontend
npm install

# Run development server
npm start
```

*This page is under construction. More detailed content will be added soon.*""",

    "development/testing.md": """# Testing

Testing procedures and guidelines for MAVIS development.

## Test Structure

### Backend Tests
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **Performance Tests**: Load and stress testing

### Frontend Tests
- **Component Tests**: React component testing
- **Integration Tests**: User interaction testing
- **Visual Tests**: UI regression testing

## Running Tests

```bash
# Backend tests
cd backend
python -m pytest

# Frontend tests
cd frontend
npm test
```

*This page is under construction. More detailed content will be added soon.*""",

    "development/deployment.md": """# Deployment

Guide for deploying MAVIS to production environments.

## Deployment Options

### Docker Deployment
```bash
# Build and run with Docker Compose
docker compose up
```

### Manual Deployment
```bash
# Backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm run build
```

## Production Considerations

- **Environment Variables**: Configuration management
- **Database Setup**: Production database configuration
- **SSL/TLS**: HTTPS configuration
- **Monitoring**: Logging and metrics

*This page is under construction. More detailed content will be added soon.*""",

    "development/contributing.md": """# Contributing

Guidelines for contributing to the MAVIS project.

## Getting Started

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests**
5. **Submit a pull request**

## Code Standards

### Python
- **Style**: Black formatting
- **Linting**: Flake8
- **Type Hints**: Required for new code

### JavaScript
- **Style**: Prettier formatting
- **Linting**: ESLint
- **Testing**: Jest and React Testing Library

## Pull Request Process

1. **Update documentation**
2. **Add tests for new features**
3. **Ensure all tests pass**
4. **Update changelog**
5. **Request review**

*This page is under construction. More detailed content will be added soon.*""",

    # Project
    "project/structure.md": """# Project Structure

Overview of the MAVIS codebase organization.

## Directory Structure

```
.
├── backend/                 # FastAPI backend
│   ├── main.py             # Main application
│   ├── services/           # Business logic
│   ├── routes/             # API endpoints
│   └── utils/              # Utility functions
├── frontend/               # React frontend
│   ├── src/                # Source code
│   │   ├── components/     # React components
│   │   ├── services/       # API communication
│   │   └── utils/          # Frontend utilities
│   └── public/             # Static files
├── docs/                   # Documentation
│   ├── mkdocs.yml          # MkDocs configuration
│   └── ...                 # Documentation pages
└── environment.yml         # Conda environment
```

## Key Files

- **environment.yml**: Python dependencies
- **package.json**: Node.js dependencies
- **docker-compose.yml**: Container configuration
- **README.md**: Project overview

*This page is under construction. More detailed content will be added soon.*""",

    "project/license.md": """# License

MAVIS is licensed under the MIT License.

## MIT License

Copyright (c) 2024 Netochukwu Onyiaji

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.""",

    "project/acknowledgments.md": """# Acknowledgments

Thanks to all contributors and libraries that make MAVIS possible.

## Core Technologies

- **[FastAPI](https://fastapi.tiangolo.com/)**: High-performance web framework
- **[React](https://reactjs.org/)**: Frontend framework
- **[UMAP](https://umap-learn.readthedocs.io/)**: Dimensionality reduction
- **[D3.js](https://d3js.org/)**: Data visualization
- **[Material-UI](https://mui.com/)**: UI component library

## Research Community

- **Synthetic Data Researchers**: For inspiration and use cases
- **Open Source Contributors**: For the amazing tools we build upon
- **Academic Community**: For feedback and validation

## Personal Thanks

- **University of Leeds**: For academic support
- **Open Source Community**: For the incredible ecosystem
- **Users and Testers**: For valuable feedback

*This page is under construction. More detailed content will be added soon.*"""
}

def create_placeholders():
    """Create all missing placeholder files."""
    print("Creating placeholder files for missing documentation pages...")
    
    for file_path, content in missing_files.items():
        # Create directory if it doesn't exist
        dir_path = os.path.dirname(file_path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path)
            print(f"Created directory: {dir_path}")
        
        # Create the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Created: {file_path}")
    
    print("\n✅ All placeholder files created successfully!")
    print("You can now run 'python -m mkdocs serve' without 404 errors.")

if __name__ == "__main__":
    create_placeholders() 