# Architecture

MAVIS is built with a modern, scalable architecture designed for synthetic data analysis.

## System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   (SQLite)      │
│                 │    │                 │    │                 │
│ • D3.js         │    │ • UMAP/t-SNE    │    │ • Job History   │
│ • Material-UI   │    │ • Statistical   │    │ • User Data     │
│ • Interactive   │    │   Analysis      │    │ • Results       │
│   Visualizations│    │ • Validation     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Frontend Components

- **React**: Modern UI framework with component-based architecture
- **Material-UI**: Professional design system with responsive components
- **D3.js**: Interactive data visualizations
- **Plotly**: Statistical charting library

## Backend Services

- **FastAPI**: High-performance API framework
- **UMAP/t-SNE**: Dimensionality reduction algorithms
- **Statistical Analysis**: Comprehensive data validation
- **Job Management**: Background processing and history

## Data Layer

- **SQLite**: Lightweight database for job history and metadata
- **File System**: Direct file handling for data uploads
- **Caching**: Optimized performance for repeated operations

### Anomaly detection data flow
- The UI (sidebar) determines the number of real and synthetic samples (e.g., 1000/1000). This selection is the single source of truth for anomaly analysis.
- `EmbeddingPlot` sends the exact 2D embedding points for those user-selected samples to `/anomaly/detect`.
- The backend computes `cell_anomalies` and returns `grid_info` including exact `x_bins`/`y_bins` which the frontend uses to render rectangles and tooltips.
- CSV export serializes Infinity/NaN as strings and includes global statistics.

*This page is under construction. More detailed content will be added soon.* 