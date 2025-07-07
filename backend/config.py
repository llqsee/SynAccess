"""Enhanced application configuration with performance and security optimizations."""
import os
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import Field
from pydantic_settings import BaseSettings

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
LOGS_DIR = BASE_DIR / "logs"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)

class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Environment
    environment: str = Field(default="development", env="ENVIRONMENT")
    debug: bool = Field(default=True, env="DEBUG")
    
    # Database Configuration
    database_url: str = Field(default=f"sqlite:///{BASE_DIR}/mavis_dev.db", env="DATABASE_URL")
    database_pool_size: int = Field(default=20, env="DATABASE_POOL_SIZE")
    database_echo: bool = Field(default=False, env="DATABASE_ECHO")
    
    # API Configuration
    api_v1_prefix: str = "/api/v1"
    cors_origins: list = Field(default=["http://localhost:3000", "http://localhost:8000"], env="CORS_ORIGINS")
    max_request_size: int = Field(default=50 * 1024 * 1024, env="MAX_REQUEST_SIZE")  # 50MB
    request_timeout: int = Field(default=300, env="REQUEST_TIMEOUT")  # 5 minutes
    
    # Security
    secret_key: str = Field(default="dev-secret-key-change-in-production", env="SECRET_KEY")
    access_token_expire_minutes: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, env="REFRESH_TOKEN_EXPIRE_DAYS")
    
    # Performance & Caching
    enable_caching: bool = Field(default=True, env="ENABLE_CACHING")
    cache_ttl_seconds: int = Field(default=3600, env="CACHE_TTL_SECONDS")  # 1 hour
    max_workers: int = Field(default=4, env="MAX_WORKERS")
    
    # Embedding Configuration
    max_data_points: int = Field(default=999999999, env="MAX_DATA_POINTS")
    embedding_timeout: int = Field(default=600, env="EMBEDDING_TIMEOUT")  # 10 minutes
    enable_gpu: bool = Field(default=False, env="ENABLE_GPU")
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Create settings instance
settings = Settings()

# Database Configuration
DATABASE_URL = settings.database_url
DATABASE_CONFIG = {
    "url": DATABASE_URL,
    "pool_size": settings.database_pool_size,
    "echo": settings.database_echo,
    "pool_pre_ping": True,
    "pool_recycle": 3600,  # 1 hour
}

# Default parameters with performance optimizations
DEFAULT_UMAP_PARAMS: Dict[str, Any] = {
    "n_neighbors": 15,
    "min_dist": 0.1,
    "n_components": 2,
    "random_state": 42,
    "low_memory": True,
    "n_jobs": -1 if settings.max_workers > 1 else 1,
    "metric": "euclidean",
    "learning_rate": 1.0,
    "init": "spectral",
    "spread": 1.0,
}

DEFAULT_TSNE_PARAMS: Dict[str, Any] = {
    "perplexity": 30.0,
    "early_exaggeration": 12.0,
    "n_components": 2,
    "random_state": 42,
    "learning_rate": 200.0,
    "n_iter": 1000,
    "n_iter_without_progress": 300,
    "min_grad_norm": 1e-7,
    "metric": "euclidean",
    "init": "random",
    "verbose": 0,
    "n_jobs": -1 if settings.max_workers > 1 else 1,
}

# API Configuration
API_V1_PREFIX = settings.api_v1_prefix
CORS_ORIGINS = settings.cors_origins

# Performance Configuration
PERFORMANCE_CONFIG = {
    "max_request_size": settings.max_request_size,
    "request_timeout": settings.request_timeout,
    "max_workers": settings.max_workers,
    "embedding_timeout": settings.embedding_timeout,
    "max_data_points": settings.max_data_points,
}

# Caching Configuration
CACHE_CONFIG = {
    "enabled": settings.enable_caching,
    "ttl": settings.cache_ttl_seconds,
    "max_size": 1000,  # Maximum number of cached items
    "key_prefix": "mavis:",
}

# Logging Configuration
LOGGING_CONFIG = {
    "log_level": "DEBUG" if settings.debug else "INFO",
    "log_file": str(LOGS_DIR / "mavis.log"),
    "max_file_size": 10 * 1024 * 1024,  # 10MB
    "backup_count": 5,
    "enable_console": True,
    "enable_json": not settings.debug,
    "request_logging": {
        "enabled": True,
        "log_body": settings.debug,
        "max_body_size": 1024,
        "exclude_paths": ["/health", "/docs", "/openapi.json", "/redoc"],
    }
}

# Security Configuration
SECURITY_CONFIG = {
    "secret_key": settings.secret_key,
    "access_token_expire_minutes": settings.access_token_expire_minutes,
    "refresh_token_expire_days": settings.refresh_token_expire_days,
    "bcrypt_rounds": 12,
    "rate_limiting": {
        "enabled": True,
        "requests_per_minute": 60,
        "burst_limit": 120,
    }
}

# Data Processing Configuration
DATA_PROCESSING_CONFIG = {
    "chunk_size": 10000,
    "max_categorical_unique": 50,
    "missing_value_threshold": 0.5,
    "enable_preprocessing_cache": True,
    "parallel_processing": settings.max_workers > 1,
}

# Export environment-specific configurations
def get_config() -> Dict[str, Any]:
    """Get complete configuration dictionary."""
    return {
        "settings": settings,
        "database": DATABASE_CONFIG,
        "api": {
            "prefix": API_V1_PREFIX,
            "cors_origins": CORS_ORIGINS,
        },
        "performance": PERFORMANCE_CONFIG,
        "cache": CACHE_CONFIG,
        "logging": LOGGING_CONFIG,
        "security": SECURITY_CONFIG,
        "data_processing": DATA_PROCESSING_CONFIG,
        "embedding": {
            "umap_defaults": DEFAULT_UMAP_PARAMS,
            "tsne_defaults": DEFAULT_TSNE_PARAMS,
            "gpu_enabled": settings.enable_gpu,
        }
    }

# Validation functions
def validate_config():
    """Validate configuration settings."""
    errors = []
    
    if settings.environment == "production":
        if settings.secret_key == "dev-secret-key-change-in-production":
            errors.append("SECRET_KEY must be changed in production")
        
        if settings.debug:
            errors.append("DEBUG should be False in production")
    
    if settings.max_data_points > 100000:
        errors.append("MAX_DATA_POINTS should not exceed 100,000 for performance reasons")
    
    if errors:
        raise ValueError(f"Configuration errors: {'; '.join(errors)}")

# Environment detection
def is_production() -> bool:
    """Check if running in production environment."""
    return settings.environment.lower() == "production"

def is_development() -> bool:
    """Check if running in development environment."""
    return settings.environment.lower() == "development"

def is_testing() -> bool:
    """Check if running in testing environment."""
    return settings.environment.lower() == "testing" 
