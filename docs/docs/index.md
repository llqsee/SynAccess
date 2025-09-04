# MAVIS - Scalable Visualization and Explainability of Synthetic Datasets

> **MAVIS** is a professional web tool for evaluating and comparing synthetic data quality. It provides interactive tools to compare real and synthetic datasets using advanced visualizations and statistical analysis.

---

## 🎯 **Functional Requirements & Rationale**

### **GPU Acceleration Requirements**

#### **1. Optional GPU Support**
- **Requirement**: Provide 2-10x performance improvement for large datasets
- **Rationale**: Large datasets require significant computational resources. GPU acceleration enables practical analysis times
- **Implementation**: CuPy integration with automatic fallback to CPU

#### **2. Smart Performance Optimization**
- **Requirement**: Automatically use GPU only when beneficial (dataset size thresholds)
- **Rationale**: GPU overhead for small datasets can be counterproductive
- **Implementation**: Configurable thresholds (≥1000 points for validation, ≥500 for anomaly detection)

#### **3. Graceful Fallback**
- **Requirement**: Seamless fallback to CPU when GPU unavailable or fails
- **Rationale**: System must remain functional regardless of GPU availability
- **Implementation**: Comprehensive error handling with automatic CPU fallback

### **Core Data Processing Requirements**

#### **1. Multi-Format Data Upload**
- **Requirement**: Support CSV, Excel, and JSON file formats
- **Rationale**: Real-world datasets come in various formats. Users need flexibility to upload their existing data without preprocessing
- **Implementation**: File validation, type detection, and automatic preprocessing

#### **2. Large Dataset Handling**
- **Requirement**: Process datasets with 1M+ samples efficiently
- **Rationale**: Synthetic data generation often produces large datasets. The tool must scale to handle production workloads
- **Implementation**: Intelligent sampling, memory management, and background processing

#### **3. Real-time Data Validation**
- **Requirement**: Provide instant feedback on data quality and format issues
- **Rationale**: Users need immediate feedback to correct issues before proceeding with analysis
- **Implementation**: Client-side validation with detailed error messages

### **Advanced Visualization Requirements**

#### **4. Interactive Dimensionality Reduction**
- **Requirement**: Support UMAP and t-SNE with configurable parameters
- **Rationale**: Different algorithms reveal different aspects of data structure. Users need control over the visualization process
- **Implementation**: Parameter tuning, GPU acceleration, and progress tracking

#### **5. Real-time Interactive Plots**
- **Requirement**: 60fps zoom, pan, and selection capabilities
- **Rationale**: Large datasets require smooth interaction for effective exploration
- **Implementation**: D3.js with optimized rendering and efficient data structures

#### **6. Distribution Comparison Visualizations**
- **Requirement**: Side-by-side real vs synthetic data analysis
- **Rationale**: Users need to visually compare distributions to assess synthetic data quality
- **Implementation**: Histograms, box plots, and statistical overlays

### **Statistical Analysis Requirements**

#### **7. Comprehensive Statistical Testing**
- **Requirement**: Implement KS tests, Chi-square, Energy tests, and multivariate analysis
- **Rationale**: Different tests detect different types of distribution differences. Comprehensive testing ensures robust quality assessment
- **Implementation**: Scientific libraries with FDR correction and bootstrap validation

#### **8. Validation Output Philosophy**
- **Requirement**: Return raw validation results without composite scores or pass/fail labels
- **Rationale**: Different tests are not directly comparable; raw outputs enable expert interpretation and reporting
- **Implementation**: Full-dataset tests with p-values and effect sizes (no mixed p-values, no overall score)

#### **9. Anomaly Detection**
- **Requirement**: Grid-based ratio analysis for detecting synthetic data anomalies
- **Rationale**: Synthetic data can have subtle quality issues that require specialized detection methods
- **Implementation**: Cell-based analysis with visual overlay and CSV export

#### **10. Privacy Testing**
- **Requirement**: Comprehensive privacy assessment using established libraries (SDMetrics)
- **Rationale**: Synthetic data must preserve privacy while maintaining utility. Robust assessment using industry-standard metrics
- **Implementation**: Industry-standard privacy metrics integrated into quality validation workflow

### **Performance & Scalability Requirements**

#### **11. GPU Acceleration**
- **Requirement**: Optional GPU support for 2-10x performance improvement
- **Rationale**: Large datasets require significant computational resources. GPU acceleration enables practical analysis times
- **Implementation**: CuPy integration with automatic fallback to CPU

#### **12. Background Processing**
- **Requirement**: Non-blocking computation with progress tracking
- **Rationale**: Long-running analyses should not block the user interface
- **Implementation**: Task queue with real-time progress updates

#### **13. Memory Management**
- **Requirement**: Efficient handling of large datasets without memory overflow
- **Rationale**: Production environments have memory constraints that must be respected
- **Implementation**: Streaming processing and intelligent sampling

### **User Experience Requirements**

#### **14. Intuitive Workflow**
- **Requirement**: Step-by-step guided process from upload to results
- **Rationale**: Complex analysis tools must be accessible to users with varying technical expertise
- **Implementation**: Progressive disclosure with clear status indicators

#### **15. Export Capabilities**
- **Requirement**: Multiple format support for sharing results
- **Rationale**: Users need to integrate results into their existing workflows
- **Implementation**: PDF reports, CSV exports, and model downloads

#### **16. Error Handling**
- **Requirement**: Graceful error handling with helpful messages
- **Rationale**: Users need clear guidance when things go wrong
- **Implementation**: Comprehensive error catching with actionable suggestions

### **Production Requirements**

#### **17. Security**
- **Requirement**: Secure file handling and API endpoints
- **Rationale**: Production environments handle sensitive data that must be protected
- **Implementation**: Input validation, secure file uploads, and API authentication

#### **18. Monitoring & Observability**
- **Requirement**: Real-time performance monitoring and logging
- **Rationale**: Production systems need visibility into performance and issues
- **Implementation**: GPU monitoring, API metrics, and comprehensive logging

#### **19. Containerization**
- **Requirement**: Docker support for easy deployment
- **Rationale**: Production deployments require consistent, reproducible environments
- **Implementation**: Multi-stage Docker builds with GPU support

---

## Quick Start

=== "CPU Installation"
    ```bash
    # Clone repository
    git clone https://github.com/Netcodez/Scalable-Visualization-and-Explainability-of-Synthetic-Datasets.git
    cd Scalable-Visualization-and-Explainability-of-Synthetic-Datasets
    
    # Setup backend
    conda env create -f environment.yml
    conda activate mavis
    python setup_database.py
    
    # Setup frontend
    cd frontend && npm install && cd ..
    
    # Start services
    cd backend && python main.py &
    cd frontend && npm start
    ```

=== "GPU Installation"
    ```bash
    # Clone repository
    git clone https://github.com/Netcodez/Scalable-Visualization-and-Explainability-of-Synthetic-Datasets.git
    cd Scalable-Visualization-and-Explainability-of-Synthetic-Datasets
    
    # Setup GPU backend
    conda env create -f environment-gpu.yml
    conda activate mavis-gpu
    export ENABLE_GPU=true
    python setup_database.py
    
    # Setup frontend
    cd frontend && npm install && cd ..
    
    # Start services
    cd backend && python main.py &
    cd frontend && npm start
    ```

=== "Docker Installation"
    ```bash
    # Clone repository
    git clone https://github.com/Netcodez/Scalable-Visualization-and-Explainability-of-Synthetic-Datasets.git
    cd Scalable-Visualization-and-Explainability-of-Synthetic-Datasets
    
    # Start with Docker Compose
    docker compose up --build
    
    # Access at http://localhost:80
    ```

=== "Begin Analysis"
    - Upload your real and synthetic datasets
    - Configure UMAP/t-SNE parameters
    - Generate interactive visualizations
    - Compare distributions and quality metrics
    - Run comprehensive validation tests
    - Detect anomalies using grid-based analysis
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
    - Distribution comparisons: Real vs synthetic histograms via sidebar
    - Strict grid overlays: Frontend uses backend x_bins/y_bins and bounds for anomaly visualization
    - Concurrent interactions: Anomaly overlay + point tooltips + selection all work together

!!! info "Statistical Analysis"
    - Kolmogorov-Smirnov tests: Formal distribution similarity testing
    - Chi-square analysis: Categorical variable comparison
    - Correlation analysis: Preserve multivariate relationships
    - Raw outputs only: No overall score; interpreted by experts/AI analysis

!!! info "Data Validation & Quality Assessment"
    - Comprehensive validation: Professional backend implementation with scientific libraries
    - Statistical tests: KS test, Chi-square, Welch's t-test, Energy test, Total variation distance
    - Output: Raw results only (no EXCELLENT/GOOD/FAIR/POOR scoring)
    - Recommendations: Provided via AI analysis or expert review

!!! info "Anomaly Detection"
    - Grid-based analysis: Divide data space into cells for density analysis
    - Ratio-based detection: Compare real-to-synthetic ratios in each cell
    - Strict backend bins: Frontend uses exact x_bins/y_bins and bounds from backend
    - CSV guarantees: Global Proportion, FDR Alpha Level, and detailed test results always included

!!! info "AI-Powered Analysis"
    - Expert AI analysis: Professional data quality assessment using Claude 3 Sonnet
    - Automatic report generation: Executive summaries and technical insights
    - Risk assessment: Comprehensive risk evaluation with mitigation strategies
    - Professional PDF reports: Stakeholder-ready documentation with expert recommendations

!!! info "Performance Monitoring & Job Management"
    - Real-time dashboard: API performance and memory usage
    - Background processing: Non-blocking computation with progress tracking
    - Job history: Filter, search, and manage completed analyses
    - Export results: Multiple format support for sharing

!!! info "Pretrained Model Support"
    - Model history: Access previously trained UMAP/t-SNE models
    - Fast path: Reuse saved ColumnTransformer for preprocessing to speed up runs
    - Dataset-aware naming: Human-readable names (e.g., "Dataset: Insurance") in history and tooltips
    - Job management: Track and manage model training jobs

---

## Architecture Overview

!!! info "System Architecture"
    - **Frontend**: React + Material-UI + D3.js
    - **Backend**: FastAPI + UMAP/t-SNE + Scientific Libraries
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
    - Scientific Libraries: NumPy, Pandas, SciPy, scikit-learn, statsmodels

!!! info "Frontend Technologies"
    - React: Modern JavaScript framework
    - Material-UI: Professional component library
    - D3.js: Interactive data visualizations
    - Plotly.js: Statistical charting library

!!! info "Development Tools"
    - Conda: Environment management
    - Jest: Frontend testing framework
    - pytest: Backend testing framework
    - Docker: Containerization

---

## Data Validation Features

### Statistical Tests Available

!!! success "Distribution Tests"
    - **Kolmogorov-Smirnov Test**: Compare distribution shapes
    - **Chi-Square Test**: Categorical variable comparison
    - **Welch's t-test**: Mean comparison for continuous variables

!!! success "Multivariate Tests"
    - **Energy Test**: Multivariate distribution similarity
    - **Total Variation Distance**: Measure distribution differences
    - **KL Divergence**: Information-theoretic comparison
    - **Jennrich Test**: Correlation matrix comparison

!!! success "Quality Assessment"
    - **FDR Correction**: Benjamini-Hochberg method for multiple testing
    - **Effect Size Analysis**: Practical significance beyond p-values
    - **Comprehensive Reporting**: Detailed analysis with recommendations

### Anomaly Detection

!!! success "Grid-Based Analysis"
    - **Spatial Division**: Divide data space into grid cells
    - **Density Analysis**: Count points in each cell
    - **Ratio Comparison**: Compare real-to-synthetic ratios
    - **Threshold Detection**: Identify unusual density patterns

!!! success "Detection Methods"
    - **Sparse Regions**: Areas with insufficient synthetic data
    - **Crowded Regions**: Areas with excessive synthetic data
    - **Distribution Mismatch**: Cells with unusual real-to-synthetic ratios
    - **Coverage Analysis**: Overall spatial distribution assessment

---

## API Documentation

Once the backend is running, visit http://localhost:8000/docs for the interactive API documentation powered by FastAPI's automatic OpenAPI generation.

---

## Documentation

### Building Documentation
```bash
cd docs
mkdocs serve
```
Documentation will be available at http://localhost:8000

### Documentation Features
- **Dark mode support** with custom styling
- **Logo integration** for branding
- **Edit this page** buttons linking to GitHub
- **View source** buttons for raw markdown
- **Comprehensive guides** for users and developers

### Documentation Structure
- **Getting Started**: Installation, quick start, overview
- **Features**: Detailed feature documentation
- **User Guide**: Step-by-step usage instructions
- **Technical**: API reference, architecture, configuration
- **Development**: Setup, testing, contributing guidelines

---

## 🚀 Production Deployment

### Backend Deployment

#### Using uvicorn:
```bash
# From project root
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

#### Using gunicorn (recommended):
```bash
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend Deployment

#### Static File Server (nginx):
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        root /path/to/frontend/build;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Docker Deployment:
```dockerfile
# Multi-stage build
FROM python:3.10-slim as backend
WORKDIR /app
COPY environment.yml .
RUN pip install conda && conda env create -f environment.yml
COPY backend/ ./backend/
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM node:18-alpine as frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=frontend /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

---

## 🧪 Development

### Testing

**Run all tests using the test runner script:**
```bash
conda activate mavis
python run_tests.py --ci --coverage --lint --verbose
```

**Individual test options:**
```bash
# Backend tests only
python run_tests.py --backend --coverage

# Frontend tests only  
python run_tests.py --frontend --coverage

# With specific test patterns
python run_tests.py --pattern "embedding"
```

**Manual testing:**
```bash
# Backend tests
conda activate mavis
cd backend
python -m pytest

# Frontend tests
cd frontend
npm test
```

### Code Quality
Make sure the conda environment is activated (`conda activate mavis`), then run:

```bash
# Format code
black backend/
isort backend/

# Lint code
flake8 backend/
```

### CI/CD Pipeline
- **Automated testing** on pull requests to `main` branch
- **Automated testing** on pushes to `initial-dev` branch
- **Coverage reports** uploaded to Codecov
- **Manual testing** available via GitHub Actions

---

## 🚀 GitHub Codespaces (Live Development)

For the best development experience with live testing, use **GitHub Codespaces**:

### **Quick Start:**
1. **Open Codespace**: Click the green "Code" button on your GitHub repo
2. **Select "Codespaces"** tab
3. **Click "Create codespace on main"**
4. **Wait for setup** (takes 2-3 minutes)

### **What You Get:**
- **Full VS Code environment** in your browser
- **Application running live** on ports 8000 (backend) and 3000 (frontend)
- **Automatic port forwarding** with preview links
- **Pre-configured extensions** for Python, React, Docker
- **Conda environment** activated automatically
- **Tests run automatically** on startup

### **Access Your Application:**
- **Backend API**: http://localhost:8000
- **Frontend**: http://localhost:3000  
- **API Docs**: http://localhost:8000/docs
- **Test Results**: Available in the terminal

### **Development Features:**
- **Real-time editing** with live preview
- **Integrated terminal** for running commands
- **Git integration** for commits and pushes
- **Debugging** with breakpoints
- **Collaborative development** with team members

### **Commands in Codespace:**
```bash
# Run tests
python run_tests.py --ci --coverage --verbose

# Start development servers
cd backend && python main.py
cd frontend && npm start

# Build Docker images
docker-compose build

# Run in Docker
docker-compose up -d

# Database operations
python setup_database.py  # Initialize database
sqlite3 backend/mavis_dev.db  # Direct database access
```

### **Database Setup:**
- **SQLite database** automatically initialized on startup
- **Database file**: `/app/backend/mavis_dev.db`
- **SQL Tools extension** for database management
- **Data persistence** across sessions
- **Automatic migrations** run on startup

### **Database Features:**
- **Job history** storage and retrieval
- **User sessions** and authentication data
- **Processing queues** and task management
- **Performance metrics** and analytics
- **Data validation** results storage

### **Database Commands:**
```bash
# View database schema
sqlite3 backend/mavis_dev.db ".schema"

# Check job history
sqlite3 backend/mavis_dev.db "SELECT * FROM jobs LIMIT 10;"

# Reset database
rm backend/mavis_dev.db && python setup_database.py

# Backup database
cp backend/mavis_dev.db backend/mavis_backup.db
```

### **Benefits:**
- ✅ **No local setup** required
- ✅ **Consistent environment** across team
- ✅ **Live testing** with real data
- ✅ **Full IDE features** in browser
- ✅ **Easy sharing** and collaboration

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request to the `main` branch

- To edit documentation, use the "Edit this page" button or edit files in `docs/docs/` on the `main` branch

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/) and [React](https://reactjs.org/)
- Visualization powered by [D3.js](https://d3js.org/) and [Plotly](https://plotly.com/)
- Dimensionality reduction using [UMAP](https://umap-learn.readthedocs.io/) and [openTSNE](https://opentsne.readthedocs.io/)
- UI components from [Material-UI](https://mui.com/)
- Documentation with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)