"""Application configuration."""
from pathlib import Path
from typing import Dict, Any

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

# Default parameters
DEFAULT_UMAP_PARAMS: Dict[str, Any] = {
    "n_neighbors": 15,
    "min_dist": 0.1,
    "n_components": 2,
    "random_state": 42
}

DEFAULT_TSNE_PARAMS: Dict[str, Any] = {
    "perplexity": 30.0,
    "early_exaggeration": 12.0,
    "n_components": 2,
    "random_state": 42
}

# API Configuration
API_V1_PREFIX = "/api/v1"
CORS_ORIGINS = [
    "http://localhost:3000",  # React development server
    "http://localhost:8000"   # FastAPI development server
] 