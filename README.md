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

- **Frontend**: React (Material-UI), custom hooks, interactive components
- **Backend**: FastAPI, RESTful routes, business logic services, SQLite
- **Docs**: MkDocs Material, with custom dark mode and logo
- **Testing**: Backend (pytest), Frontend (Jest + React Testing Library)
- **Deployment**: Docker, Conda, Node.js

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
Frontend runs at http://localhost:3000

---

## 📖 Documentation

- Documentation source: `docs/docs/`
- Built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)
- Custom dark mode and logo supported
- To build/serve locally:
  ```bash
  cd docs
  mkdocs serve
  ```
- "Edit this page" and "View source" buttons use the `main` branch and correct file paths

---

## 🧪 Testing

**Backend:**
```bash
conda activate mavis
cd backend
python -m pytest
```
- Tests in `backend/tests/` (services, routes, utils, database)

**Frontend:**
```bash
cd frontend
npm test
```
- Tests in `frontend/src/services/__tests__/`, `frontend/src/hooks/__tests__/`, `frontend/src/utils/__tests__/`

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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/) and [React](https://reactjs.org/)
- Visualization powered by [D3.js](https://d3js.org/) and [Plotly](https://plotly.com/)
- Dimensionality reduction using [UMAP](https://umap-learn.readthedocs.io/) and [openTSNE](https://opentsne.readthedocs.io/)
- UI components from [Material-UI](https://mui.com/)
- Documentation with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)

