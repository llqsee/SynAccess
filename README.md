# MAVIS - Scalable Visualization and Explainability of Synthetic Datasets

A full-stack web application for visualizing and comparing real and synthetic datasets using advanced dimensionality reduction techniques. MAVIS provides an intuitive interface for data scientists and researchers to analyze synthetic data quality through interactive visualizations and statistical comparisons.

## 🚀 Features

- **Interactive Data Upload**: Support for CSV, Excel, and JSON file formats
- **Advanced Dimensionality Reduction**: UMAP and t-SNE implementations with configurable parameters
- **Interactive Visualizations**: 
  - Zoomable and pannable scatter plots with D3.js
  - Real-time point selection and filtering
  - Collapsible distribution sidebar with responsive legend positioning
- **Statistical Analysis**: 
  - Distribution comparisons between real and synthetic data
  - Histogram and violin plot visualizations
  - Categorical and continuous variable analysis
- **Modern UI/UX**: 
  - Material-UI components with responsive design
  - Clean, professional interface optimized for data exploration
  - Full-screen visualization capabilities

## 📁 Project Structure

```
.
├── backend/                 # FastAPI backend
│   ├── main.py             # Main FastAPI application
│   ├── config.py           # Configuration settings
│   ├── services/          # Business logic services
│   │   └── embedding.py   # Embedding computation service
│   ├── routes/            # API route handlers
│   │   ├── embed.py       # Embedding endpoints
│   │   └── distribution.py # Distribution analysis endpoints
│   └── utils/             # Utility functions and data processing
│       ├── data_preprocessing.py
│       └── validation.py
├── frontend/               # React frontend application
│   ├── public/            # Static files
│   ├── src/               # Source code
│   │   ├── components/    # React components
│   │   │   ├── EmbeddingPlot.js    # Main visualization component
│   │   │   ├── DistributionPlot.js # Distribution analysis
│   │   │   ├── Header.js           # Navigation header
│   │   │   ├── LandingPage.js      # Welcome page
│   │   │   ├── Login.js            # Authentication
│   │   │   ├── ResultsPane.js      # Results display
│   │   │   └── Sidebar.js          # Navigation sidebar
│   │   ├── services/     # API communication
│   │   │   └── api.js
│   │   ├── hooks/        # Custom React hooks
│   │   │   ├── useDataUpload.js
│   │   │   └── useEmbedding.js
│   │   ├── contexts/     # React contexts
│   │   │   └── AuthContext.js
│   │   └── utils/        # Frontend utilities
│   │       ├── dataUtils.js
│   │       ├── fileReader.js
│   │       └── security.js
│   └── package.json      # Node.js dependencies
├── notebooks/             # Jupyter notebooks for development
├── reports/               # Generated reports and figures
├── environment.yml        # Conda environment specification
└── README.md             # Project documentation
```

## 🛠️ Setup

### Prerequisites
- [Anaconda](https://www.anaconda.com/products/distribution) or [Miniconda](https://docs.conda.io/en/latest/miniconda.html)
- [Node.js](https://nodejs.org/) (v16 or higher)

### Backend Setup

#### Option 1: Using Conda (Recommended)
1. Create and activate conda environment:
```bash
conda env create -f environment.yml
conda activate mavis
```

2. Run the backend server:
```bash
cd backend
python main.py
```

#### Option 2: Using pip
1. Create and activate virtual environment:
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install fastapi uvicorn numpy pandas scikit-learn matplotlib seaborn openTSNE umap-learn python-dotenv plotly pydantic statsmodels
```

3. Run the backend server:
```bash
cd backend
python main.py
```

The backend will be available at http://localhost:8000

### Frontend Setup

#### Development
1. Install Node.js dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
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

## 🔧 API Documentation

Once the backend is running, visit http://localhost:8000/docs for the interactive API documentation powered by FastAPI's automatic OpenAPI generation.

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

### Code Quality
Make sure the conda environment is activated (`conda activate mavis`), then run:

```bash
# Format code
black .
isort .

# Lint code
flake8 .
```

### Testing
```bash
# Backend tests
cd backend
python -m pytest

# Frontend tests
cd frontend
npm test
```

### Project Maintenance
Use the cleanup script to manage redundant files and keep the project lean:

```bash
# Run the cleanup script
python scripts/cleanup.py
```

This script will:
- Remove Python cache directories (`__pycache__`)
- Clean Jupyter notebook checkpoints (`.ipynb_checkpoints`)
- Clear outputs from Jupyter notebooks to reduce size
- Clean up large generated report files (keeping samples)
- Remove `node_modules` if present
- Show project size analysis

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/) and [React](https://reactjs.org/)
- Visualization powered by [D3.js](https://d3js.org/) and [Plotly](https://plotly.com/)
- Dimensionality reduction using [UMAP](https://umap-learn.readthedocs.io/) and [openTSNE](https://opentsne.readthedocs.io/)
- UI components from [Material-UI](https://mui.com/)

