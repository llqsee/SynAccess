# MAVIS - Data Visualization and Analysis Tool

A full-stack web application for visualizing and comparing real and synthetic datasets using dimensionality reduction techniques.

## Project Structure

```
.
├── backend/                 # FastAPI backend
│   ├── main.py             # Main FastAPI application
│   ├── config.py           # Configuration settings
│   ├── services/          # Business logic services
│   │   └── embedding.py   # Embedding computation service
│   ├── routes/            # API route handlers
│   └── utils/             # Utility functions and data processing
├── frontend/               # React frontend application
│   ├── public/            # Static files
│   ├── src/               # Source code
│   │   ├── components/    # React components
│   │   ├── services/     # API communication
│   │   ├── hooks/        # Custom React hooks
│   │   └── utils/        # Frontend utilities
│   └── package.json      # Node.js dependencies
├── environment.yml        # Conda environment specification
└── README.md             # Project documentation
```

## Setup

### Prerequisites
- [Anaconda](https://www.anaconda.com/products/distribution) or [Miniconda](https://docs.conda.io/en/latest/miniconda.html)
- [Node.js](https://nodejs.org/) - JavaScript runtime

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
pip install fastapi uvicorn numpy pandas scikit-learn matplotlib seaborn opentsne umap-learn python-dotenv plotly
```

3. Run the backend server:
```bash
cd backend
python main.py
```

The backend will be available at http://localhost:8000

## Production Deployment

### Using uvicorn directly:
```bash
# From project root
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4

# With gunicorn (recommended for production)
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend Production Deployment:

#### Option 1: Static File Server (nginx)
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
    }
}
```

#### Option 2: Node.js Server
```javascript
// server.js
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'build')));

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(3000);
```

#### Option 3: Docker Full-Stack
```dockerfile
# Backend
FROM python:3.10-slim as backend
WORKDIR /app
COPY environment.yml .
RUN pip install conda && conda env create -f environment.yml
COPY backend/ ./backend/
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Frontend
FROM node:18-alpine as frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Production
FROM nginx:alpine
COPY --from=frontend /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

#### Option 4: CDN Deployment (Netlify/Vercel)
```bash
# Build and deploy to Netlify
cd frontend
npm run build
netlify deploy --prod --dir=build

# Or Vercel
cd frontend
vercel --prod
```

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

## Features

- Upload and compare real and synthetic datasets
- Visualize data using UMAP or t-SNE dimensionality reduction
- Interactive scatter plots with zoom and pan capabilities
- Statistical analysis of datasets
- Real-time computation of embeddings
- Configurable visualization parameters

## Development

### Backend Development

The backend is built with FastAPI and provides:
- REST API endpoints for data processing
- Embedding computation using UMAP and t-SNE
- Data validation and error handling
- CORS support for frontend communication

### Frontend Development

The frontend is built with React and features:
- Modern Material-UI components
- D3.js for interactive visualizations
- Axios for API communication
- File processing utilities
- Responsive layout

## API Documentation

Once the backend is running, visit http://localhost:8000/docs for the interactive API documentation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Development

### Code Formatting and Linting

Make sure the conda environment is activated (`conda activate mavis`), then run:

```bash
# Format code
black .
isort .

# Lint code
flake8 .
```

### Environment Management

The project uses conda for dependency management. Make sure to activate the environment before development:

```bash
conda activate mavis
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

