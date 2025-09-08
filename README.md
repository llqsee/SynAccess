# MAVIS: Scalable Visualization and Explainability of Synthetic Datasets

MAVIS is a comprehensive platform for analyzing, visualizing, and validating synthetic datasets using advanced dimensionality reduction techniques and statistical anomaly detection.

## 🚀 Features

### 1. **Data Upload & Preprocessing**
- Support for CSV files with automatic data type detection
- Real-time data validation and preprocessing
- Handling of categorical and numerical variables
- Automatic data cleaning and normalization

### 2. **Dimensionality Reduction**
- **UMAP** (Uniform Manifold Approximation and Projection)
- **t-SNE** (t-Distributed Stochastic Neighbor Embedding)
- Configurable parameters for optimal visualization
- Model persistence and reuse capabilities

### 3. **Interactive Visualizations**
- Real-time scatter plots with zoom and pan
- Point selection and filtering
- Distribution analysis with multiple plot types

### 4. **Performance Monitoring**
- Real-time GPU utilization tracking
- Memory usage monitoring
- Processing time analytics
- System resource optimization

### 5. **Job Management**
- Asynchronous processing with progress tracking
- Job history and result storage
- Model reuse with pretrained embeddings
- Dataset fingerprinting for identification

### 6. **AI-Powered Analysis**
- Automated data quality assessment
- Statistical analysis reports
- Anomaly detection insights
- Professional report generation

### 7. **Data Validation**
- Comprehensive statistical tests
- Distribution comparison analysis
- Quality metrics calculation
- Privacy testing with fast NN-based checks (NNDR, nearest distance, exact match)
- Validation report generation

### 8. **Advanced Anomaly Detection**
- Grid-based statistical analysis
- Multiple detection algorithms
- Configurable sensitivity settings
- Detailed anomaly reports

### 9. **Histogram-Based Anomaly Detection**
- **Histogram-based grid sizing** for X and Y dimensions separately
- **Binomial proportion tests** comparing cell proportions to global proportion
- **Two one-sided tests**:
  - Test A: `cell_proportion > global_proportion` (real overpopulation)
  - Test B: `cell_proportion < global_proportion` (synthetic overpopulation)
- **False Discovery Rate (FDR) correction** applied separately to positive and negative tests
- **Binary red/blue coloring** based on FDR-corrected significance
- **Binomial proportion tests** - direct proportion comparison using statistical tests

## 📊 Statistical Methodology

### Anomaly Detection Algorithm
The histogram-based anomaly detection system works as follows:

1. **Grid Creation**: Creates histogram-based grid cells for X and Y dimensions separately using `np.histogram`
2. **Proportion Calculation**: For each cell, calculates `cell_proportion = real_count / total_count`
3. **Global Baseline**: Calculates `global_proportion = total_real / (total_real + total_synthetic)`
4. **Statistical Testing**: Performs binomial proportion tests for each cell:
   - **Test A**: `binomtest(real_count, total_cell, p=global_proportion, alternative='greater')`
   - **Test B**: `binomtest(real_count, total_cell, p=global_proportion, alternative='less')`
5. **FDR Correction**: Applies Benjamini-Hochberg correction separately to positive and negative tests
6. **Coloring**: Colors significant cells red (real overpopulation) or blue (synthetic overpopulation)

### Key Advantages
- **Statistically rigorous**: Uses proper binomial tests for proportion comparison
- **Intuitive interpretation**: Direct proportion comparison without complex transformations
- **Multiple testing correction**: FDR correction controls for false discoveries
- **Flexible grid sizing**: Histogram-based approach adapts to data distribution

## 🛠️ Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- CUDA-compatible GPU (optional, for acceleration)

### Backend Setup
```bash
# Clone the repository
git clone <repository-url>
cd Scalable-Visualization-and-Explainability-of-Synthetic-Datasets

# Create conda environment
conda env create -f environment.yml
conda activate mavis

# Setup database
python setup_database.py

# Start the backend server
python main.py
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

### Docker Setup

#### CPU Development
```bash
# Build and run CPU version
docker compose up --build

# Access the application
# Frontend: http://localhost:80 (via nginx)
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

#### GPU Development
```bash
# Build and run GPU version
ENV_FILE=environment-gpu.yml GPU_ENABLED=true ENABLE_GPU=true CONDA_ENV_NAME=mavis-gpu docker compose up --build

# Or use GPU override file
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

#### Production Deployment
```bash
# Production with nginx
docker compose --profile production up --build

# GPU production
ENV_FILE=environment-gpu.yml GPU_ENABLED=true ENABLE_GPU=true CONDA_ENV_NAME=mavis-gpu docker compose --profile production up --build
```

**📖 [Complete Docker Documentation](docs/docs/development/docker.md)**

## 📖 Usage

### 1. Data Upload
- Navigate to the upload section
- Select your CSV file containing both real and synthetic data
- Ensure your data has a label column indicating "Real" vs "Synthetic"

### 2. Embedding Generation
- Choose between UMAP or t-SNE
- Configure parameters (n_neighbors, min_dist, perplexity, etc.)
- Start the embedding process
- Monitor progress in real-time

### 3. Visualization
- Explore the 2D embedding interactively
- Use point selection tools to filter data
- Generate distribution plots for selected points
- Export visualizations in various formats

### 4. Anomaly Detection
- Click "Detect Anomalies" to run histogram-based detection
- Configure grid parameters (x_bins, y_bins, fdr_alpha)
- View significant cells colored red (real overpopulation) or blue (synthetic overpopulation)
- Export detailed CSV reports with statistical results

### 5. Analysis & Reports
- Generate AI-powered analysis reports
- Export validation results
- Download comprehensive CSV reports
- View performance metrics

## 🔧 Configuration

### Backend Configuration
```python
# config.py
API_V1_PREFIX = "/api/v1"
DEBUG = True
DATABASE_URL = "sqlite:///./mavis.db"
```

### Frontend Configuration
```javascript
// .env
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_DEBUG=1
```

## 📁 Project Structure

```
Scalable-Visualization-and-Explainability-of-Synthetic-Datasets/
├── backend/                    # FastAPI backend application
│   ├── routes/                # API endpoints and request handlers
│   │   ├── embed.py           # Embedding generation endpoints
│   │   ├── anomaly_detection.py # Anomaly detection API
│   │   ├── validation.py      # Data validation endpoints
│   │   ├── history.py         # Job history management
│   │   ├── ai_analysis.py     # AI-powered analysis
│   │   ├── gpu.py             # GPU monitoring endpoints
│   │   ├── distribution.py    # Distribution analysis
│   │   └── queue.py           # Task queue management
│   ├── services/              # Business logic and core services
│   │   ├── embedding.py       # UMAP/t-SNE implementation
│   │   ├── anomaly_detection_service.py # Anomaly detection logic
│   │   ├── validation_service.py # Statistical validation
│   │   ├── job_service.py     # Job management and storage
│   │   ├── ai_analysis_service.py # AI integration
│   │   ├── gpu_monitoring.py  # GPU performance monitoring
│   │   ├── task_queue.py      # Background task processing
│   │   └── compression_service.py # Data compression utilities
│   ├── database/              # Database models and connection
│   ├── utils/                 # Utility functions and helpers
│   ├── tests/                 # Backend test suite
│   ├── config.py              # Application configuration
│   └── main.py                # FastAPI application entry point
├── frontend/                  # React frontend application
│   ├── src/                   # Source code
│   │   ├── components/        # React components
│   │   ├── services/          # API service functions
│   │   ├── hooks/             # Custom React hooks
│   │   ├── contexts/          # React contexts
│   │   └── utils/             # Frontend utilities
│   ├── public/                # Static assets
│   └── package.json           # Node.js dependencies
├── docs/                      # Documentation
│   └── docs/                  # MkDocs documentation site
├── data/                      # Sample datasets and data files
├── notebooks/                 # Jupyter notebooks for analysis
├── figures/                   # Generated figures and plots
├── reports/                   # Generated reports
├── logs/                      # Application logs
├── environment.yml            # CPU conda environment
├── environment-gpu.yml        # GPU-enabled conda environment
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Container orchestration
├── docker-compose.gpu.yml     # GPU Docker configuration
├── nginx.conf                 # Nginx reverse proxy configuration
├── setup_database.py          # Database initialization script
├── run_tests.py               # Test runner script
└── README.md                  # Project documentation
```

## 📊 API Endpoints

### Embedding Generation
- `POST /api/v1/embed/generate` - Generate new embeddings
- `POST /api/v1/embed/generate-with-pretrained` - Use pretrained models
- `GET /api/v1/embed/available-models` - List available models

### Anomaly Detection
- `POST /api/v1/anomaly/detect-anomalies` - Detect anomalies with direct data
- `POST /api/v1/anomaly/detect-anomalies-from-job` - Detect anomalies from job data
- `POST /api/v1/anomaly/generate-anomaly-csv` - Generate CSV reports
- `POST /api/v1/anomaly/generate-anomaly-csv-from-job` - Generate CSV from job data

### Job Management
- `GET /api/v1/history/jobs` - List all jobs
- `GET /api/v1/history/job/{job_id}` - Get specific job details
- `DELETE /api/v1/history/job/{job_id}` - Delete job

### Performance Monitoring
- `GET /api/v1/gpu/status` - Get GPU status
- `GET /api/v1/gpu/memory` - Get memory usage

## 🧪 Testing

### Backend Tests
```bash
cd backend
conda activate mavis
python -m pytest tests/ -v
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
# Run full test suite
python run_tests.py
```

## 📈 Performance

### Optimization Features
- **Asynchronous processing** with background tasks
- **GPU acceleration** for UMAP/t-SNE computations
- **Model persistence** for faster repeated runs
- **Memory-efficient** data handling
- **Real-time monitoring** of system resources

### Scalability
- **Horizontal scaling** support via Docker
- **Database optimization** for large datasets
- **Caching mechanisms** for improved performance
- **Resource management** for concurrent users

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow PEP 8 for Python code
- Use ESLint for JavaScript code
- Write comprehensive tests
- Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **UMAP**: McInnes, L., Healy, J., & Melville, J. (2018). UMAP: Uniform Manifold Approximation and Projection for Dimension Reduction.
- **t-SNE**: van der Maaten, L., & Hinton, G. (2008). Visualizing Data using t-SNE.
- **D3.js**: Bostock, M., Ogievetsky, V., & Heer, J. (2011). D³: Data-Driven Documents.
- **FastAPI**: Ramírez, S. (2018). FastAPI: Modern, Fast Web Framework for Building APIs.

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in the `docs/` folder
- Review the API reference in `docs/docs/technical/api-reference.md`

## 🔄 Changelog

### Version 2.1.0
- **Major Update**: Implemented fast privacy checks (NNDR, nearest distance, exact match rate)
- **Added**: Privacy tests integrated into Quality Metrics category
- **Enhanced**: Lightweight implementation; no external privacy libraries required
- **Updated**: Documentation to reflect new privacy approach

### Version 2.0.0
- **Major Update**: Implemented histogram-based binomial proportion test anomaly detection
- **Improved**: Direct proportion comparison without complex transformations
- **Enhanced**: More intuitive statistical interpretation
- **Added**: Comprehensive FDR correction for multiple testing
- **Updated**: All documentation and API endpoints

### Version 1.0.0
- Initial release with UMAP/t-SNE support
- Basic anomaly detection capabilities
- Interactive visualization features
- Job management system

