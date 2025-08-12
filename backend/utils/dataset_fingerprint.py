"""
Dataset fingerprinting utilities for model identification.
"""

import hashlib
import json
import numpy as np
import pandas as pd
from typing import Union, List, Dict, Any, Tuple
from collections import Counter


def generate_dataset_fingerprint(
    real_data: Union[List[List[Any]], np.ndarray, pd.DataFrame],
    synthetic_data: Union[List[List[Any]], np.ndarray, pd.DataFrame],
    real_headers: List[str] = None,
    synthetic_headers: List[str] = None
) -> str:
    """
    Generate a unique fingerprint for a dataset based on its characteristics.
    
    Args:
        real_data: Real dataset
        synthetic_data: Synthetic dataset  
        real_headers: Column headers for real data
        synthetic_headers: Column headers for synthetic data
        
    Returns:
        str: Unique 8-character dataset fingerprint
    """
    # Convert to DataFrames for analysis
    real_df = _to_dataframe(real_data, real_headers)
    synth_df = _to_dataframe(synthetic_data, synthetic_headers)
    
    # Gather characteristics for fingerprinting
    characteristics = {
        'real_shape': real_df.shape,
        'synth_shape': synth_df.shape,
        'real_columns': list(real_df.columns),
        'synth_columns': list(synth_df.columns),
        'real_dtypes': {col: str(dtype) for col, dtype in real_df.dtypes.items()},
        'synth_dtypes': {col: str(dtype) for col, dtype in synth_df.dtypes.items()},
        'real_sample_hash': _sample_hash(real_df),
        'synth_sample_hash': _sample_hash(synth_df)
    }
    
    # Create fingerprint from characteristics
    characteristics_str = json.dumps(characteristics, sort_keys=True)
    full_hash = hashlib.md5(characteristics_str.encode()).hexdigest()
    
    # Return first 8 characters for readability
    return full_hash[:8].upper()


def generate_dataset_summary(
    real_data: Union[List[List[Any]], np.ndarray, pd.DataFrame],
    synthetic_data: Union[List[List[Any]], np.ndarray, pd.DataFrame],
    real_headers: List[str] = None,
    synthetic_headers: List[str] = None
) -> Dict[str, Any]:
    """
    Generate a comprehensive summary of dataset characteristics.
    
    Args:
        real_data: Real dataset
        synthetic_data: Synthetic dataset
        real_headers: Column headers for real data  
        synthetic_headers: Column headers for synthetic data
        
    Returns:
        Dict with dataset summary information
    """
    # Convert to DataFrames for analysis
    real_df = _to_dataframe(real_data, real_headers)
    synth_df = _to_dataframe(synthetic_data, synthetic_headers)
    
    summary = {
        'fingerprint': generate_dataset_fingerprint(real_data, synthetic_data, real_headers, synthetic_headers),
        'real_dataset': _analyze_dataset(real_df, 'Real'),
        'synthetic_dataset': _analyze_dataset(synth_df, 'Synthetic'),
        'comparison': _compare_datasets(real_df, synth_df)
    }
    
    return summary


def generate_human_readable_description(
    real_data: Union[List[List[Any]], np.ndarray, pd.DataFrame],
    synthetic_data: Union[List[List[Any]], np.ndarray, pd.DataFrame],
    real_headers: List[str] = None,
    synthetic_headers: List[str] = None,
    method: str = "UMAP",
    real_dataset_name: str = None,
    synthetic_dataset_name: str = None
) -> str:
    """
    Generate a human-readable description for the model.
    
    Args:
        real_data: Real dataset
        synthetic_data: Synthetic dataset
        real_headers: Column headers for real data
        synthetic_headers: Column headers for synthetic data
        method: Embedding method used
        real_dataset_name: Name of the real dataset (e.g., filename)
        synthetic_dataset_name: Name of the synthetic dataset (e.g., filename)
        
    Returns:
        str: Human-readable model description
    """
    summary = generate_dataset_summary(real_data, synthetic_data, real_headers, synthetic_headers)
    
    real_info = summary['real_dataset']
    synth_info = summary['synthetic_dataset']
    fingerprint = summary['fingerprint']
    
    # Use dataset names if provided, otherwise fall back to fingerprint
    if real_dataset_name or synthetic_dataset_name:
        # Clean up filenames (remove extensions, truncate if too long)
        real_name = _clean_dataset_name(real_dataset_name) if real_dataset_name else "Real"
        synth_name = _clean_dataset_name(synthetic_dataset_name) if synthetic_dataset_name else "Synthetic"
        
        # Create dataset identifier
        if real_name == synth_name:
            dataset_identifier = real_name
        else:
            dataset_identifier = f"{real_name}+{synth_name}"
    else:
        # Fallback to fingerprint
        dataset_identifier = f"({fingerprint})"
    
    # Create descriptive name
    description_parts = [
        f"{method}:",
        dataset_identifier,
        f"{real_info['rows']:,}R+{synth_info['rows']:,}S",
        f"{real_info['columns']}cols"
    ]
    
    # Add data type info
    if real_info['categorical_columns'] > 0:
        description_parts.append(f"{real_info['categorical_columns']}cat")
    if real_info['numeric_columns'] > 0:
        description_parts.append(f"{real_info['numeric_columns']}num")
    
    return " ".join(description_parts)


def _clean_dataset_name(filename: str) -> str:
    """Clean up dataset filename for display."""
    if not filename:
        return "Unknown"
    
    # Remove file extension
    name = filename.rsplit('.', 1)[0] if '.' in filename else filename
    
    # Truncate if too long
    if len(name) > 20:
        name = name[:17] + "..."
    
    # Replace problematic characters
    name = name.replace('_', ' ').replace('-', ' ')
    
    return name


def _to_dataframe(data: Union[List[List[Any]], np.ndarray, pd.DataFrame], headers: List[str] = None) -> pd.DataFrame:
    """Convert data to pandas DataFrame."""
    if isinstance(data, pd.DataFrame):
        return data.copy()
    elif isinstance(data, np.ndarray):
        df = pd.DataFrame(data)
    elif isinstance(data, list):
        df = pd.DataFrame(data)
    else:
        raise ValueError(f"Unsupported data type: {type(data)}")
    
    # Set headers if provided
    if headers and len(headers) == len(df.columns):
        df.columns = headers
    
    return df


def _sample_hash(df: pd.DataFrame, n_samples: int = 100) -> str:
    """Generate hash from a sample of the data."""
    if len(df) == 0:
        return "empty"
    
    # Sample a few rows for hashing (deterministic)
    sample_size = min(n_samples, len(df))
    sample_df = df.head(sample_size)
    
    # Convert to string representation and hash
    sample_str = sample_df.to_string()
    return hashlib.md5(sample_str.encode()).hexdigest()[:8]


def _analyze_dataset(df: pd.DataFrame, dataset_type: str) -> Dict[str, Any]:
    """Analyze a single dataset and return characteristics."""
    if len(df) == 0:
        return {
            'type': dataset_type,
            'rows': 0,
            'columns': 0,
            'numeric_columns': 0,
            'categorical_columns': 0,
            'column_names': [],
            'data_types': {}
        }
    
    # Identify column types
    numeric_cols = []
    categorical_cols = []
    
    for col in df.columns:
        try:
            pd.to_numeric(df[col], errors='raise')
            numeric_cols.append(col)
        except (ValueError, TypeError):
            categorical_cols.append(col)
    
    return {
        'type': dataset_type,
        'rows': len(df),
        'columns': len(df.columns),
        'numeric_columns': len(numeric_cols),
        'categorical_columns': len(categorical_cols),
        'column_names': list(df.columns),
        'data_types': {col: str(dtype) for col, dtype in df.dtypes.items()},
        'numeric_column_names': numeric_cols,
        'categorical_column_names': categorical_cols
    }


def _compare_datasets(real_df: pd.DataFrame, synth_df: pd.DataFrame) -> Dict[str, Any]:
    """Compare real and synthetic datasets."""
    return {
        'same_columns': list(real_df.columns) == list(synth_df.columns),
        'same_shape': real_df.shape == synth_df.shape,
        'column_count_diff': len(synth_df.columns) - len(real_df.columns),
        'row_count_diff': len(synth_df) - len(real_df),
        'common_columns': list(set(real_df.columns) & set(synth_df.columns)),
        'real_only_columns': list(set(real_df.columns) - set(synth_df.columns)),
        'synth_only_columns': list(set(synth_df.columns) - set(real_df.columns))
    }