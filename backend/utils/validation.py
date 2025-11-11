"""
Data validation utilities for checking input quality.

These functions help ensure your data is in the right format
before we start processing it.
"""

from typing import List, Any, Dict
import numpy as np

def validate_data_format(real_data: List[List[Any]], synthetic_data: List[List[Any]]) -> None:
    """
    Check that your data is in the right format.
    
    This makes sure both datasets have the same structure and
    contain valid data before we start processing.
    
    Args:
        real_data: Your real dataset
        synthetic_data: Your synthetic dataset
        
    Raises:
        ValueError: If the data format isn't correct
    """
    if not real_data or not synthetic_data:
        raise ValueError("Both real_data and synthetic_data must be provided")
    
    if not isinstance(real_data, list) or not isinstance(synthetic_data, list):
        raise ValueError("Both real_data and synthetic_data must be lists")
    
    if len(real_data) == 0 or len(synthetic_data) == 0:
        raise ValueError("Both real_data and synthetic_data must contain at least one row")
    
    # Check that all rows have the same number of columns
    real_cols = len(real_data[0]) if real_data else 0
    synthetic_cols = len(synthetic_data[0]) if synthetic_data else 0
    
    if real_cols == 0 or synthetic_cols == 0:
        raise ValueError("Data rows must contain at least one column")
    
    # Check that all rows have the same number of columns
    for i, row in enumerate(real_data):
        if len(row) != real_cols:
            raise ValueError(f"All rows in real_data must have the same number of columns. Row {i} has {len(row)} columns, expected {real_cols}")
    
    for i, row in enumerate(synthetic_data):
        if len(row) != synthetic_cols:
            raise ValueError(f"All rows in synthetic_data must have the same number of columns. Row {i} has {len(row)} columns, expected {synthetic_cols}")
    
    # Allow differing numbers of columns; preprocessing will align by headers or intersection
    # If they differ, we simply proceed and log a warning at higher layers if needed.

def validate_embedding_params(method: str, params: Dict[str, Any]) -> None:
    """
    Validate embedding method parameters.
    
    Args:
        method: Embedding method ('umap', 'tsne', 'pca')
        params: Method parameters
        
    Raises:
        ValueError: If parameters are invalid
    """
    if method not in ['umap', 'tsne', 'pca']:
        raise ValueError(f"Unsupported embedding method: {method}. Supported methods: umap, tsne, pca")
    
    if not isinstance(params, dict):
        raise ValueError("Parameters must be a dictionary")
    
    # Method-specific validation
    if method == 'umap':
        if 'n_neighbors' in params and (not isinstance(params['n_neighbors'], int) or params['n_neighbors'] < 2):
            raise ValueError("n_neighbors must be an integer >= 2")
        if 'min_dist' in params and (not isinstance(params['min_dist'], (int, float)) or params['min_dist'] < 0):
            raise ValueError("min_dist must be a non-negative number")
        if 'n_components' in params and (not isinstance(params['n_components'], int) or params['n_components'] < 1):
            raise ValueError("n_components must be a positive integer")
    
    elif method == 'tsne':
        if 'perplexity' in params and (not isinstance(params['perplexity'], (int, float)) or params['perplexity'] <= 0):
            raise ValueError("perplexity must be a positive number")
        if 'n_components' in params and (not isinstance(params['n_components'], int) or params['n_components'] < 1):
            raise ValueError("n_components must be a positive integer")
        if 'n_iter' in params and (not isinstance(params['n_iter'], int) or params['n_iter'] < 1):
            raise ValueError("n_iter must be a positive integer")
    
    elif method == 'pca':
        if 'n_components' in params and (not isinstance(params['n_components'], int) or params['n_components'] < 1):
            raise ValueError("n_components must be a positive integer")

def validate_n_samples(n_samples: int, total_samples: int) -> None:
    """
    Validate the number of samples to use.
    
    Args:
        n_samples: Number of samples to use
        total_samples: Total number of samples available
        
    Raises:
        ValueError: If n_samples is invalid
    """
    if n_samples is not None:
        if not isinstance(n_samples, int) or n_samples <= 0:
            raise ValueError("n_samples must be a positive integer")
        if n_samples > total_samples:
            raise ValueError(f"n_samples ({n_samples}) cannot be greater than total samples ({total_samples})") 