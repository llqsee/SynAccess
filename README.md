# MAVIS - Scalable Visualization and Explainability of Synthetic Datasets

A full-stack web application for visualizing and comparing real and synthetic datasets using advanced dimensionality reduction techniques. MAVIS provides an intuitive interface for data scientists and researchers to analyze synthetic data quality through interactive visualizations and statistical comparisons.

---

## 🚀 Features
- **Interactive Data Upload**: CSV, Excel, and JSON support
- **Advanced Dimensionality Reduction**: UMAP and t-SNE with live parameter tuning
- **Interactive Visualizations**: D3.js and Plotly-based, zoom/pan, point selection, real vs synthetic toggle
- **Statistical Analysis**: Distribution comparisons, histograms, violin plots, categorical/continuous analysis
- **Data Validation & Quality Assessment**: Range, distribution, correlation, and statistical tests with scoring and recommendations
- **Performance Monitoring**: Real-time dashboard, API/memory/user analytics
- **Job Management & History**: Background processing, job history, export, favorites
- **Modern UI/UX**: Material-UI, responsive, dark mode, authentication
- **Comprehensive Documentation**: Located in `docs/docs/`, with dark mode and logo support

---

## 🏗️ Architecture Overview

The following diagram illustrates MAVIS's complete system architecture, showing the relationships between frontend components, backend services, and external dependencies:

```mermaid
graph TB
    %% User Layer
    User[👤 User] --> Frontend{Frontend<br/>React App}
    
    %% Frontend Components
    Frontend --> Auth[🔐 Authentication<br/>AuthContext]
    Frontend --> Header[📋 Header<br/>Navigation]
    Frontend --> Sidebar[📂 Sidebar<br/>File Upload]
    Frontend --> EmbedPlot[📊 EmbeddingPlot<br/>Interactive Scatter Plot]
    Frontend --> DistPlot[📈 DistributionPlot<br/>Statistical Comparisons]
    Frontend --> History[📜 History<br/>Job Management]
    Frontend --> Results[📄 ResultsPane<br/>Analysis Results]
    Frontend --> SummaryTab[📋 SummaryTab<br/>Validation & Reports]
    Frontend --> ValidationPopup[⚠️ ValidationPopup<br/>Issue Alerts]
    Frontend --> PerformanceDashboard[📊 PerformanceDashboard<br/>Monitoring]
    
    %% Frontend Hooks & Services
    Frontend --> DataHook[🔄 useDataUpload<br/>File Processing]
    Frontend --> EmbedHook[🔄 useEmbedding<br/>Visualization Logic]
    Frontend --> ValidationHook[🔄 useValidation<br/>Data Validation]
    Frontend --> API[🌐 API Service<br/>HTTP Client]
    
    %% Backend Entry Point
    API -->|HTTP Requests| Backend{Backend<br/>FastAPI App}
    
    %% Backend Routes
    Backend --> EmbedRoute[📍 /embed<br/>Embedding Computation]
    Backend --> DistRoute[📍 /distribution<br/>Statistical Analysis]
    Backend --> HistRoute[📍 /history<br/>Job History]
    Backend --> HealthRoute[📍 /health<br/>Status Check]
    
    %% Backend Services
    EmbedRoute --> EmbedService[⚙️ Embedding Service<br/>UMAP/t-SNE Processing]
    EmbedRoute --> JobService[💼 Job Service<br/>Background Processing]
    DistRoute --> DataPreproc[🔧 Data Preprocessing<br/>Validation & Cleaning]
    HistRoute --> JobService
    
    %% Data Processing Pipeline
    EmbedService --> UMAP[🎯 UMAP<br/>Dimensionality Reduction]
    EmbedService --> TSNE[🎯 t-SNE<br/>Dimensionality Reduction]
    EmbedService --> OneHot[🔄 One-Hot Encoding<br/>Categorical Processing]
    
    %% Database Layer
    JobService --> Database[(🗄️ SQLite Database<br/>mavis_dev.db)]
    
    %% File System
    Sidebar -->|File Upload| FileSystem[📁 File System<br/>CSV/Excel/JSON]
    
    %% External Libraries & Dependencies
    UMAP --> UMAPLib[📚 umap-learn]
    TSNE --> TSNELib[📚 openTSNE]
    EmbedPlot --> D3[📚 D3.js<br/>Interactive Visualization]
    DistPlot --> Plotly[📚 Plotly.js<br/>Statistical Charts]
    Frontend --> MUI[📚 Material-UI<br/>Component Library]
    
    %% Deployment & Infrastructure
    Backend --> Docker[🐳 Docker<br/>Containerization]
    Frontend --> Docker
    Docker --> DockerCompose[🔧 Docker Compose<br/>Multi-Service Setup]
    
    %% Configuration & Environment
    Backend --> Config[⚙️ Config<br/>Environment Settings]
    Config --> EnvFile[📄 environment.yml<br/>Conda Dependencies]
    
    %% Testing Infrastructure
    Frontend --> FrontendTests[🧪 Frontend Tests<br/>Jest + React Testing Library]
    Backend --> BackendTests[🧪 Backend Tests<br/>pytest]
    
    %% Monitoring & Logging
    Backend --> Monitoring[📊 Monitoring Service<br/>Metrics Collection]
    Backend --> Logging[📝 Logging<br/>Application Logs]
    
    %% Data Flow
    User -.->|1. Upload Data| FileSystem
    FileSystem -.->|2. Process Files| DataHook
    DataHook -.->|3. Send to Backend| API
    API -.->|4. Compute Embeddings| EmbedService
    EmbedService -.->|5. Return Results| EmbedPlot
    EmbedPlot -.->|6. Interactive Visualization| User
    
    %% Styling
    classDef frontend fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef backend fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef service fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef data fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef external fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef infra fill:#f1f8e9,stroke:#33691e,stroke-width:2px
    
    class Frontend,Auth,Header,Sidebar,EmbedPlot,DistPlot,History,Results,SummaryTab,ValidationPopup,PerformanceDashboard,DataHook,EmbedHook,ValidationHook,API,FrontendTests frontend
    class Backend,EmbedRoute,DistRoute,HistRoute,HealthRoute,BackendTests backend
    class EmbedService,JobService,DataPreproc,Monitoring,Logging service
    class Database,FileSystem,Config,EnvFile data
    class UMAPLib,TSNELib,D3,Plotly,MUI external
    class Docker,DockerCompose infra
```

### Key Architecture Components:

- **Frontend (Light Blue)**: React-based user interface with Material-UI components, custom hooks for state management, and interactive visualization components
- **Backend (Purple)**: FastAPI application with RESTful routes for embedding computation, statistical analysis, and job management
- **Services (Orange)**: Core business logic including embedding computation, job processing, and data preprocessing
- **Data Layer (Green)**: SQLite database for persistence and file system integration for data uploads
- **External Libraries (Pink)**: Scientific computing libraries (UMAP, t-SNE), visualization frameworks (D3.js, Plotly), and UI components
- **Infrastructure (Light Green)**: Docker containerization and deployment configuration

The numbered data flow shows the typical user journey from data upload through processing to interactive visualization.

---

## 📁 Project Structure

```
.
├── backend/                 # FastAPI backend
│   ├── main.py             # Main FastAPI application
│   ├── config.py           # Configuration settings
│   ├── services/           # Business logic (embedding, jobs, compression, queue)
│   ├── routes/             # API route handlers (embed, distribution, history, queue)
│   ├── utils/              # Utility functions (validation, monitoring, logging, etc.)
│   ├── database/           # DB connection, models, migrations
│   ├── models/             # (reserved for ORM models)
│   ├── data/               # (data files, if any)
│   ├── tests/              # Backend tests (services, routes, utils, database)
│   └── logs/               # Log files
├── frontend/                # React frontend
│   ├── public/             # Static files
│   └── src/                # Source code
│       ├── components/     # React components (EmbeddingPlot, DistributionPlot, etc.)
│       ├── services/       # API and validation services
│       ├── hooks/          # Custom React hooks
│       ├── contexts/       # React contexts (AuthContext)
│       ├── utils/          # Frontend utilities
│       └── __tests__/      # Frontend tests (services, hooks, utils)
├── docs/
│   └── docs/               # MkDocs documentation source (index.md, features/, user-guide/, etc.)
│       ├── images/         # Documentation images (logo, etc.)
│       ├── stylesheets/    # Custom CSS (extra.css for dark mode)
│       ├── javascripts/    # Custom JS
│       └── ...             # Markdown docs
├── notebooks/              # Jupyter notebooks and figures
├── reports/                # Generated reports and figures
├── environment.yml         # Conda environment
├── Dockerfile, docker-compose.yml
└── README.md               # Project documentation
```

---

## 🛠️ Setup

### Prerequisites
- [Anaconda/Miniconda](https://www.anaconda.com/products/distribution)
- [Node.js](https://nodejs.org/) (v16 or higher)

### Backend Setup

**Using Conda (Recommended):**
```bash
conda env create -f environment.yml
conda activate mavis
cd backend
python main.py
```

**Using pip:**
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
pip install fastapi uvicorn numpy pandas scikit-learn matplotlib seaborn openTSNE umap-learn python-dotenv plotly pydantic statsmodels
cd backend
python main.py
```

Backend runs at http://localhost:8000

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

The frontend will be available at http://localhost:3000

#### Production Build
1. Build the production bundle:
```bash
cd frontend
npm run build
```

2. The optimized static files will be in `frontend/build/` directory

## 📊 Usage

1. **Upload Data**: Navigate to the Data Upload tab and select your real and synthetic datasets
2. **Configure Parameters**: Choose embedding method (UMAP/t-SNE) and adjust parameters
3. **Generate Embeddings**: Click "Generate Embeddings" to create visualizations
4. **Explore Results**: 
   - Use the interactive scatter plot to explore data distribution
   - Toggle the distribution sidebar to view statistical comparisons
   - Select points to analyze specific data subsets
5. **Export Results**: Save visualizations and analysis reports

## 🎯 UMAP Configuration & Parameters

UMAP (Uniform Manifold Approximation and Projection) is a powerful dimensionality reduction technique that preserves both local and global data structures. MAVIS provides comprehensive parameter control for optimal visualization results.

### Key UMAP Parameters

| Parameter | Range | Default | Description | Use Case |
|-----------|-------|---------|-------------|----------|
| **n_neighbors** | 2-200 | 15 | Number of neighboring points used in local approximations | • **Low (2-10)**: Focus on local structure, fine details<br/>• **High (50-200)**: Emphasize global structure, broad patterns |
| **min_dist** | 0.0-0.99 | 0.1 | Minimum distance between points in low-dimensional space | • **Low (0.0-0.1)**: Tight clusters, detailed structure<br/>• **High (0.5-0.99)**: Spread out points, overview perspective |
| **n_components** | 2 | Target dimensionality for visualization | • **2D**: Standard scatter plots, easier interpretation |

### UMAP Functionality Features

#### 🔧 **Interactive Parameter Tuning**
- **Real-time Preview**: Adjust parameters and see immediate effects on visualization
- **Parameter Presets**: Quick-select configurations for different data types:
  - *Detailed View*: n_neighbors=5, min_dist=0.05 (fine-grained analysis)
  - *Balanced View*: n_neighbors=15, min_dist=0.1 (default, general purpose)
  - *Overview Mode*: n_neighbors=50, min_dist=0.5 (broad patterns)

#### 📊 **Advanced Visualization Options**
- **Color Mapping**: 
  - Categorical variables with distinct color palettes
  - Continuous variables with gradient color scales
  - Custom color schemes for accessibility
- **Point Styling**:
  - Adjustable point sizes for data density representation
  - Opacity control for overlapping point visualization
  - Shape differentiation for multiple categories

#### ⚡ **Performance Optimization**
- **Batch Processing**: Handles large datasets (>100k points) efficiently
- **Progressive Rendering**: Shows intermediate results during computation
- **Memory Management**: Automatic optimization for available system resources
- **Background Processing**: Non-blocking computation with progress indicators

#### 🎨 **Interactive Features**
- **Zoom & Pan**: Smooth navigation through embedding space
- **Point Selection**: Click and drag to select data subsets
- **Hover Information**: Detailed tooltips showing original data values
- **Real vs Synthetic Toggle**: Switch between dataset visualizations

## 🎯 openTSNE Configuration & Parameters

t-SNE (t-Distributed Stochastic Neighbor Embedding) is a powerful dimensionality reduction technique that excels at preserving local structure and revealing clusters in high-dimensional data. MAVIS provides comprehensive parameter control for optimal t-SNE visualization results.

### Key openTSNE Parameters

| Parameter | Range | Default | Description | Use Case |
|-----------|-------|---------|-------------|----------|
| **perplexity** | 5-50 | 30 | Balance between local and global structure | • **Low (5-15)**: Focus on local clusters, fine details<br/>• **High (30-50)**: Emphasize global structure, broad patterns |
| **early_exaggeration** | 4-20 | 12 | Initial separation of clusters | • **Low (4-8)**: Subtle cluster separation<br/>• **High (12-20)**: Strong initial cluster formation |
| **n_components** | 2 | Target dimensionality for visualization | • **2D**: Standard scatter plots, easier interpretation |

### openTSNE Functionality Features

#### 🔧 **Interactive Parameter Tuning**
- **Real-time Preview**: Adjust parameters and see immediate effects on visualization
- **Parameter Presets**: Quick-select configurations for different data types:
  - *Detailed View*: perplexity=10, learning_rate=100 (fine-grained analysis)
  - *Balanced View*: perplexity=30, learning_rate=200 (default, general purpose)
  - *Overview Mode*: perplexity=50, learning_rate=500 (broad patterns)

#### 📊 **Advanced Visualization Options**
- **Color Mapping**: 
  - Categorical variables with distinct color palettes
  - Continuous variables with gradient color scales
  - Custom color schemes for accessibility
- **Point Styling**:
  - Adjustable point sizes for data density representation
  - Opacity control for overlapping point visualization
  - Shape differentiation for multiple categories

#### ⚡ **Performance Optimization**
- **Batch Processing**: Handles large datasets (>100k points) efficiently
- **Progressive Rendering**: Shows intermediate results during computation
- **Memory Management**: Automatic optimization for available system resources
- **Background Processing**: Non-blocking computation with progress indicators

#### 🎨 **Interactive Features**
- **Zoom & Pan**: Smooth navigation through embedding space
- **Point Selection**: Click and drag to select data subsets
- **Hover Information**: Detailed tooltips showing original data values
- **Real vs Synthetic Toggle**: Switch between dataset visualizations

#### 🔄 **Algorithm-Specific Features**
- **Perplexity Optimization**: Automatic perplexity selection based on dataset size
- **Early Exaggeration**: Enhanced initial cluster separation for better visualization
- **Gradient Descent Monitoring**: Real-time convergence tracking
- **Barnes-Hut Approximation**: Efficient computation for large datasets

### UMAP vs t-SNE Comparison

| Aspect | UMAP | openTSNE |
|--------|------|-------|
| **Local Structure** | Excellent | Excellent |
| **Global Structure** | Good | Limited |
| **Computation Speed** | Fast | Moderate |
| **Memory Usage** | Low | Moderate |
| **Parameter Sensitivity** | Low | High |
| **Scalability** | Excellent (>100k points) | Good (<50k points) |
| **Cluster Preservation** | Good | Excellent |
| **Reproducibility** | High | Moderate |

### When to Use Each Algorithm

**Choose UMAP when:**
- Working with large datasets (>50k points)
- Need to preserve both local and global structure
- Want faster computation times
- Need consistent results across runs

**Choose t-SNE when:**
- Focus is on local cluster structure
- Working with smaller datasets (<50k points)
- Need maximum cluster separation
- Analyzing fine-grained local patterns

## 📈 Distribution Analysis & Chart Functionalities

MAVIS provides comprehensive statistical comparison tools through interactive distribution visualizations, enabling detailed quality assessment of synthetic data.

### Distribution Chart Types

MAVIS automatically selects appropriate chart types based on your data:

**For Numeric/Continuous Variables:**
- **Histogram**: Default for continuous data
- **Violin Plot**: Alternative showing density distributions with quartile information

**For Categorical Variables:**
- **Bar Chart**: Frequency/percentage comparisons between categories

#### 📊 **Histogram Comparisons**
- **Overlapping Histograms**: Direct visual comparison of real vs synthetic distributions
- **Customizable Binning**: 
  - Automatic optimal bin selection using Sturges' rule
  - Manual bin count adjustment (5-100 bins)
  - Adaptive binning for different data ranges
- **Statistical Overlays**:
  - Mean and median lines with confidence intervals
  - Standard deviation bands
  - Quartile markers and outlier identification

#### 🎻 **Violin Plots**
- **Density Estimation**: Kernel density estimation for smooth distribution curves
- **Embedded Box Plot**: Quartile information (Q1, median, Q3) displayed within violin shape
- **Mean Line**: Clearly marked mean value for quick reference  
- **Comparative Layout**: Side-by-side real vs synthetic comparisons
- **Interactive Features**:
  - Hover to see exact density values
  - Clear visualization of distribution shape and spread
  - Automatic bandwidth optimization for optimal density curves

#### 🔄 **Categorical Distribution Charts**
- **Bar Charts**: Frequency comparisons for categorical variables
- **Proportional Analysis**: Percentage-based comparisons
- **Chi-square Integration**: Statistical significance testing for category distributions
- **Missing Value Analysis**: Visualization of data completeness

### Distribution Functionality Features

#### 🎛️ **Interactive Controls**
- **Variable Selection**: 
  - Dropdown menu for quick variable switching
  - Multi-variable comparison in grid layout
  - Search and filter capabilities for large datasets
- **Chart Type Toggle**: Seamless switching between histogram and violin plots (numeric data) or bar charts (categorical data)
- **Scale Options**:
  - Linear vs logarithmic scaling
  - Normalized vs absolute count scales
  - Percentage vs frequency displays

#### 📊 **Statistical Analysis Integration**
- **Kolmogorov-Smirnov (KS) Test**: Automated distribution similarity testing for continuous variables (tests if two datasets come from the same distribution)
- **Chi-square Test**: Categorical distribution comparison with statistical significance testing
- **Effect Size Calculation**: Cohen's d for practical significance assessment beyond statistical significance
- **Confidence Intervals**: Bootstrap-based uncertainty quantification for robust statistical inference

#### 🎨 **Visualization Enhancements**
- **Color Coding**: 
  - Consistent real (blue) vs synthetic (orange) color scheme
  - Accessibility-friendly color palettes
  - Custom theme support
- **Annotation System**:
  - Statistical test results displayed on charts
  - Significance indicators (*, **, ***)
  - Effect size interpretations

#### 📱 **Responsive Design**
- **Collapsible Sidebar**: Space-efficient design for different screen sizes
- **Mobile Optimization**: Touch-friendly controls and gesture support
- **Export Options**:
  - High-resolution PNG/SVG downloads
  - PDF report generation with all charts
  - CSV data export for external analysis

#### 🔍 **Advanced Features**
- **Distribution Filtering**: 
  - Filter by value ranges to focus on specific data regions
  - Exclude outliers for cleaner comparisons
  - Subset analysis based on other variables
- **Real-time Updates**: 
  - Dynamic chart updates when embedding selection changes
  - Synchronized highlighting between scatter plot and distributions
  - Live statistical recalculation

### Quality Assessment Indicators

#### ⚠️ **Visual Alert System**
- **Distribution Mismatch Warnings**: Automatic detection of significant differences
- **Sample Size Alerts**: Warnings for insufficient data in categories
- **Data Quality Flags**: Missing values, extreme outliers, or unusual patterns

#### 📋 **Statistical Summary Panel**
- **Key Metrics Dashboard**: Mean, std, skewness, kurtosis comparisons
- **Similarity Scores**: Overall distribution similarity percentages
- **Recommendation Engine**: Automated suggestions for data generation improvement

## 🔧 API Documentation

Once the backend is running, visit http://localhost:8000/docs for the interactive API documentation powered by FastAPI's automatic OpenAPI generation.

## 📚 Documentation

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request to the `main` branch

- To edit documentation, use the "Edit this page" button or edit files in `docs/docs/` on the `main` branch

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/) and [React](https://reactjs.org/)
- Visualization powered by [D3.js](https://d3js.org/) and [Plotly](https://plotly.com/)
- Dimensionality reduction using [UMAP](https://umap-learn.readthedocs.io/) and [openTSNE](https://opentsne.readthedocs.io/)
- UI components from [Material-UI](https://mui.com/)
- Documentation with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)

