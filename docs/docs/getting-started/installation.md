# Installation Guide

This guide will help you set up MAVIS on your system. MAVIS requires both Python (for the backend) and Node.js (for the frontend).

## Prerequisites

Before installing MAVIS, ensure you have the following installed:

- **Python 3.8+**: Required for the backend
- **Node.js 16+**: Required for the frontend
- **Git**: For cloning the repository
- **Conda** (recommended): For environment management

## Quick Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Netcodez/Scalable-Visualization-and-Explainability-of-Synthetic-Datasets.git
cd Scalable-Visualization-and-Explainability-of-Synthetic-Datasets
```

### 2. Set Up the Backend

#### Option A: Using Conda (Recommended)

```bash
# Create and activate conda environment
conda env create -f environment.yml
conda activate mavis

# Install additional dependencies
pip install -r requirements.txt
```

#### Option B: Using pip

```bash
# Create virtual environment
python -m venv mavis-env
source mavis-env/bin/activate  # On Windows: mavis-env\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Set Up the Frontend

```bash
cd frontend
npm install
```

### 4. Initialize the Database

```bash
# From the project root
python setup_database.py
```

## Detailed Installation

### Backend Setup

The backend is built with FastAPI and includes several key components:

#### Core Dependencies

- **FastAPI**: Web framework for building APIs
- **UMAP**: Dimensionality reduction for visualization
- **t-SNE**: Alternative dimensionality reduction method
- **SQLite**: Database for job history and metadata
- **Pandas**: Data manipulation and analysis
- **NumPy**: Numerical computing
- **Scikit-learn**: Machine learning utilities

#### Installation Steps

1. **Environment Setup**:
   ```bash
   conda env create -f environment.yml
   conda activate mavis
   ```

2. **Database Initialization**:
   ```bash
   python setup_database.py
   ```

3. **Verify Installation**:
   ```bash
   python -c "import umap; import fastapi; print('Backend setup complete!')"
   ```

### Frontend Setup

The frontend is built with React and includes several key libraries:

#### Core Dependencies

- **React**: UI framework
- **Material-UI**: Component library
- **D3.js**: Data visualization
- **Plotly**: Statistical charts
- **Axios**: HTTP client

#### Installation Steps

1. **Navigate to Frontend**:
   ```bash
   cd frontend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Verify Installation**:
   ```bash
   npm run build
   ```

## Docker Installation

For containerized deployment, MAVIS includes Docker support:

### Using Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

### Manual Docker Build

```bash
# Build the image
docker build -t mavis-app .

# Run the container
docker run -p 8000:8000 mavis-app
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=sqlite:///mavis_dev.db

# API Settings
API_HOST=0.0.0.0
API_PORT=8000

# Frontend
REACT_APP_API_URL=http://localhost:8000

# Development
DEBUG=True
```

### Backend Configuration

The backend configuration is in `backend/config.py`:

```python
# Database settings
DATABASE_URL = "sqlite:///mavis_dev.db"

# API settings
API_HOST = "0.0.0.0"
API_PORT = 8000

# UMAP settings
UMAP_N_NEIGHBORS = 15
UMAP_MIN_DIST = 0.1
UMAP_N_COMPONENTS = 2
```

## Verification

### Test the Backend

```bash
# Start the backend server
cd backend
python main.py

# Test the API
curl http://localhost:8000/api/v1/health
```

### Test the Frontend

```bash
# Start the frontend development server
cd frontend
npm start

# Open http://localhost:3000 in your browser
```

## Troubleshooting

### Common Issues

#### 1. Conda Environment Issues

```bash
# If conda environment creation fails
conda env remove -n mavis
conda env create -f environment.yml
```

#### 2. Node.js Dependencies

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 3. Database Issues

```bash
# Remove existing database
rm mavis_dev.db

# Reinitialize
python setup_database.py
```

#### 4. Port Conflicts

If ports 3000 or 8000 are in use:

```bash
# Check what's using the ports
lsof -i :3000
lsof -i :8000

# Kill the processes or change ports in configuration
```

### Performance Optimization

#### For Large Datasets

1. **Increase Memory Limits**:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

2. **Optimize UMAP Parameters**:
   ```python
   # In backend/config.py
   UMAP_N_NEIGHBORS = 30  # For larger datasets
   ```

3. **Enable Caching**:
   ```python
   # Enable Redis for caching (optional)
   CACHE_URL = "redis://localhost:6379"
   ```

## Next Steps

After successful installation:

1. **Quick Start**: Follow the [Quick Start Guide](quick-start.md)
2. **User Guide**: Explore detailed usage in the [User Guide](../user-guide/upload-data.md)
3. **API Documentation**: Review the [API Reference](../technical/api-reference.md)
4. **Development**: Set up for [Development](../development/setup.md)

## Support

If you encounter issues during installation:

- **Check the logs**: Look for error messages in the terminal
- **Verify prerequisites**: Ensure all required software is installed
- **GitHub Issues**: Report bugs and request help
- **Documentation**: Review the troubleshooting section above

MAVIS is designed to be easy to install and use. If you follow these steps carefully, you should have a working installation ready for synthetic data analysis! 