# MAVIS - Scalable Visualization and Explainability of Synthetic Datasets

> **MAVIS** is a professional web tool for evaluating and comparing synthetic data quality. It provides interactive tools to compare real and synthetic datasets using advanced visualizations and statistical analysis.

---

## 🎯 **Functional Requirements & Rationale**

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
- **Implementation**: Full-dataset tests with p-values, effect sizes, and summaries (no mixed p-values, no overall score)

#### **9. Anomaly Detection**
- **Requirement**: Grid-based ratio analysis for detecting synthetic data anomalies
- **Rationale**: Synthetic data can have subtle quality issues that require specialized detection methods
- **Implementation**: Cell-based analysis with visual overlay and CSV export

### **Performance & Scalability Requirements**

#### **10. GPU Acceleration**
- **Requirement**: Optional GPU support for 2-10x performance improvement
- **Rationale**: Large datasets require significant computational resources. GPU acceleration enables practical analysis times
- **Implementation**: CuPy integration with automatic fallback to CPU

#### **11. Background Processing**
- **Requirement**: Non-blocking computation with progress tracking
- **Rationale**: Long-running analyses should not block the user interface
- **Implementation**: Task queue with real-time progress updates

#### **12. Memory Management**
- **Requirement**: Efficient handling of large datasets without memory overflow
- **Rationale**: Production environments have memory constraints that must be respected
- **Implementation**: Streaming processing and intelligent sampling

### **User Experience Requirements**

#### **13. Intuitive Workflow**
- **Requirement**: Step-by-step guided process from upload to results
- **Rationale**: Complex analysis tools must be accessible to users with varying technical expertise
- **Implementation**: Progressive disclosure with clear status indicators

#### **14. Export Capabilities**
- **Requirement**: Multiple format support for sharing results
- **Rationale**: Users need to integrate results into their existing workflows
- **Implementation**: PDF reports, CSV exports, and model downloads

#### **15. Error Handling**
- **Requirement**: Graceful error handling with helpful messages
- **Rationale**: Users need clear guidance when things go wrong
- **Implementation**: Comprehensive error catching with actionable suggestions

### **Production Requirements**

#### **16. Security**
- **Requirement**: Secure file handling and API endpoints
- **Rationale**: Production environments handle sensitive data that must be protected
- **Implementation**: Input validation, secure file uploads, and API authentication

#### **17. Monitoring & Observability**
- **Requirement**: Real-time performance monitoring and logging
- **Rationale**: Production systems need visibility into performance and issues
- **Implementation**: GPU monitoring, API metrics, and comprehensive logging

#### **18. Containerization**
- **Requirement**: Docker support for easy deployment
- **Rationale**: Production deployments require consistent, reproducible environments
- **Implementation**: Multi-stage Docker builds with GPU support

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **Conda** (recommended) or pip
- **NVIDIA GPU** (optional, for GPU acceleration)

### 2. Environment Setup
```bash
# Create a .env file with your configuration
# Copy the example below and create a .env file:

# Environment
ENVIRONMENT=development
DEBUG=true

# Database Configuration
DATABASE_URL=sqlite:///mavis_dev.db
DATABASE_POOL_SIZE=20
DATABASE_ECHO=false

# API Configuration
API_V1_PREFIX=/api/v1
CORS_ORIGINS=["http://localhost:3000", "http://localhost:8000"]
MAX_REQUEST_SIZE=52428800
REQUEST_TIMEOUT=300

# Security
SECRET_KEY=dev-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Performance & Caching
ENABLE_CACHING=true
CACHE_TTL_SECONDS=3600
MAX_WORKERS=4

# AI/Claude Configuration
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-api-key-here
ENABLE_AI_ANALYSIS=true
CLAUDE_MODEL=claude-3-5-sonnet-20241022
AI_ANALYSIS_TIMEOUT=60

# Embedding Configuration
MAX_DATA_POINTS=999999999
EMBEDDING_TIMEOUT=240
ENABLE_GPU=false

# Node Environment (for frontend)
NODE_ENV=development
```

**⚠️ Security Note**: Never commit your `.env` file to version control. It's already in `.gitignore`.

### 3. Backend Setup
```bash
# Create and activate conda environment
conda env create -f environment.yml
conda activate mavis

# Install dependencies
pip install -r requirements.txt

# Initialize database
python backend/setup_database.py

# Start backend server
python backend/main.py
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm start
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

---

## 🚀 GPU Acceleration

MAVIS supports optional GPU acceleration for UMAP computations, significantly speeding up dimensionality reduction on large datasets.

### GPU Features
- **Automatic Detection**: GPU availability is automatically detected
- **Fallback Support**: Gracefully falls back to CPU if GPU is unavailable
- **Performance Boost**: 2-10x faster UMAP computations on supported hardware
- **Memory Efficient**: Optimized for large datasets with GPU memory management
- **Real-time Monitoring**: GPU usage and performance monitoring
- **Docker Support**: Full GPU support in Docker containers

### GPU Requirements
- **NVIDIA GPU** with CUDA 11.x or higher
- **CUDA Toolkit** installed on the system
- **CuPy** library for GPU array operations
- **NVIDIA Container Runtime** (for Docker GPU support)

### Using GPU Acceleration

#### Local Installation
1. **Install GPU environment:**
   ```bash
   conda env create -f environment-gpu.yml
   conda activate mavis-gpu
   ```

2. **Enable GPU in API calls:**
   ```json
   {
     "method": "umap",
     "params": {
       "use_gpu": true,
       "n_neighbors": 15,
       "min_dist": 0.1
     }
   }
   ```

3. **Monitor GPU usage:**
   - GPU utilization is tracked in the API response metadata
   - Access GPU monitoring endpoints: `/api/v1/gpu/status`, `/api/v1/gpu/usage`

#### Docker GPU Support
1. **Build GPU-enabled container:**
   ```bash
   ENV_FILE=environment-gpu.yml GPU_ENABLED=true docker build --build-arg ENV_FILE=environment-gpu.yml --build-arg GPU_ENABLED=true -t mavis:gpu .
   ```

2. **Run with GPU support:**
   ```bash
   GPU_RUNTIME=nvidia ENV_FILE=environment-gpu.yml GPU_ENABLED=true ENABLE_GPU=true docker compose up --build
   ```

3. **GPU monitoring in Docker:**
   - Container includes GPU monitoring capabilities
   - Access GPU endpoints from within container
   - Real-time GPU usage tracking

### GPU Monitoring Endpoints
- `GET /api/v1/gpu/status` - Overall GPU status
- `GET /api/v1/gpu/info` - Detailed GPU information
- `GET /api/v1/gpu/usage` - GPU usage summary
- `GET /api/v1/gpu/availability` - GPU availability check

---

## 🐳 Docker Deployment

### CPU-only Deployment
```bash
# Build and run CPU version
docker compose up --build
```

### GPU-enabled Deployment
```bash
# Build and run GPU version
ENV_FILE=environment-gpu.yml GPU_ENABLED=true ENABLE_GPU=true docker compose up --build
```

### Production Deployment
```bash
# Run with nginx reverse proxy
docker compose --profile production up --build
```

### Docker Features
- **Multi-stage builds** for optimized image size
- **GPU runtime support** with NVIDIA Container Runtime
- **Health checks** for container monitoring
- **Volume mounting** for persistent data
- **Environment variable** configuration
- **Production-ready** with nginx reverse proxy

---

## 📊 Key Features

### Interactive Data Upload
- Multi-format support: CSV, Excel, and JSON files
- Real-time validation: Instant feedback on data quality
- Large dataset handling: Efficient processing of 1M+ samples (hardware dependent)
- Smart preprocessing: Automatic data type detection and cleaning

### Advanced Visualizations
- Interactive scatter plots: Zoom, pan, and select data points
- Distribution comparisons: Side-by-side real vs synthetic analysis
- Statistical overlays: Mean, median, confidence intervals
- Color-coded analysis: Distinguish real and synthetic data points

### Statistical Analysis
- Kolmogorov-Smirnov tests: Formal distribution similarity testing
- Chi-square analysis: Categorical variable comparison
- Correlation analysis: Preserve multivariate relationships
- Raw outputs only: No overall scores; intended for expert interpretation

### Data Validation & Quality Assessment
- Comprehensive validation: Professional backend implementation with scientific libraries
- Statistical tests: KS test, Chi-square, Welch's t-test, Energy test, Total variation distance
- Output: Raw results only (no EXCELLENT/GOOD/FAIR/POOR scoring)
- Recommendations: Interpreted via AI analysis or expert review

### Anomaly Detection
- Grid-based analysis: Divide data space into cells for density analysis
- Ratio-based detection: Compare real-to-synthetic ratios in each cell
- Strict backend bins: Frontend uses exact x_bins/y_bins and bounds from backend
- CSV guarantees: Global Probability, Global Logit, Logit Std Dev always included (no threshold parameter in CSV)

### Performance Monitoring & Job Management
- Real-time dashboard: API performance and memory usage
- Background processing: Non-blocking computation with progress tracking
- Job history: Filter, search, and manage completed analyses
- Export results: Multiple format support for sharing
- GPU monitoring: Real-time GPU usage and performance tracking

### Pretrained Model Support
- Model history: Access previously trained UMAP/t-SNE models
- Fast path: Reuse saved ColumnTransformer for preprocessing to speed up runs
- Dataset-aware naming: Human-readable names (e.g., "Dataset: Insurance") in history and tooltips
- Job management: Track and manage model training jobs

---

## 🏗️ Architecture Overview

### System Architecture
- **Frontend**: React + Material-UI + D3.js
- **Backend**: FastAPI + UMAP/t-SNE + Scientific Libraries
- **Database**: SQLite
- **Deployment**: Docker + nginx
- **GPU Support**: CUDA + CuPy + NVIDIA Container Runtime

### Performance Benchmarks

| Speed (Blue)           | Scalability (Blue)      | Accuracy (Blue)           |
|------------------------|-------------------------|---------------------------|
| 100k samples: <30s     | Scalable to millions of samples (hardware dependent) | Statistical tests: 95%+   |
| Real-time updates: <100ms | Memory efficient      | Quality assessment: comprehensive |
| 60fps visualizations   | Background processing   | High-resolution outputs    |
| GPU acceleration: 2-10x faster | GPU memory management | GPU monitoring: real-time |

---

## 🛠️ Technical Stack

### Backend
- **FastAPI**: Modern, fast web framework
- **UMAP/t-SNE**: Dimensionality reduction algorithms
- **Scientific Libraries**: NumPy, Pandas, SciPy, scikit-learn
- **GPU Support**: CuPy, NVIDIA CUDA Toolkit
- **Database**: SQLAlchemy with SQLite
- **Task Queue**: Background job processing
- **AI Integration**: Anthropic Claude API

### Frontend
- **React**: Modern JavaScript framework
- **Material-UI**: Component library
- **D3.js**: Data visualization
- **Axios**: HTTP client
- **React Router**: Navigation

### DevOps
- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration
- **Nginx**: Reverse proxy (production)
- **GitHub Actions**: CI/CD pipeline

---

## 📁 Project Structure

```
Scalable-Visualization-and-Explainability-of-Synthetic-Datasets/
├── backend/                    # FastAPI backend
│   ├── routes/                # API endpoints
│   ├── services/              # Business logic
│   ├── models/                # Database models
│   ├── utils/                 # Utilities
│   └── tests/                 # Backend tests
├── frontend/                  # React frontend
│   ├── src/                   # Source code
│   ├── public/                # Static assets
│   └── tests/                 # Frontend tests
├── docs/                      # Documentation
├── data/                      # Sample datasets
├── environment.yml            # CPU conda environment
├── environment-gpu.yml        # GPU-enabled conda environment
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Container orchestration
└── README.md                  # This file
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **UMAP**: For the dimensionality reduction algorithm
- **FastAPI**: For the modern web framework
- **React**: For the frontend framework
- **Anthropic**: For the AI analysis capabilities

