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
- The backend computes `cell_anomalies` and returns `grid_info` including exact `x_bins`/`y_bins` and bounds which the frontend uses to render rectangles.
- Frontend: grid rectangles are non-interactive; point tooltips/selection remain active; off-point hover shows grid cell info.
- CSV export serializes Infinity/NaN as strings and always includes global statistics (Global Probability, Global Logit, Logit SD). No threshold parameter is exported.

### Pretrained fast path and model packages
- Embedding jobs save a model package: embedding model + data transformer + metadata (dataset identification and training metadata).
- Pretrained executions reuse the saved `ColumnTransformer` for preprocessing (fast path) to reduce runtime and guarantee identical preprocessing.
- Jobs store human‑readable dataset names (e.g., "Dataset: Insurance") alongside fingerprints to aid user selection in history and sidebar tooltips.