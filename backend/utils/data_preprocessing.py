import numpy as np
import pandas as pd
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from typing import Tuple, List, Any

def preprocess_data(real_data: List[List[Any]], synthetic_data: List[List[Any]]) -> Tuple[np.ndarray, np.ndarray]:
    """
    Simple preprocessing: convert to DataFrames, one-hot encode categorical columns, and return clean numeric arrays.
    
    Args:
        real_data: List of lists containing the real dataset
        synthetic_data: List of lists containing the synthetic dataset
        
    Returns:
        Tuple of processed real and synthetic data as numeric numpy arrays
    """
    # Convert to pandas DataFrames
    real_df = pd.DataFrame(real_data)
    synthetic_df = pd.DataFrame(synthetic_data)
    
    categorical_cols = []
    numeric_cols = []
    
    # Identify categorical vs numeric columns
    for col in real_df.columns:
        # Try to convert to numeric
        real_numeric = pd.to_numeric(real_df[col], errors='coerce')
        
        # If most values can't be converted to numeric, treat as categorical
        if real_numeric.isna().sum() / len(real_df) > 0.5:
            categorical_cols.append(col)
        else:
            numeric_cols.append(col)
            # Fill numeric columns
            real_df[col] = real_numeric.fillna(0)
            synthetic_df[col] = pd.to_numeric(synthetic_df[col], errors='coerce').fillna(0)
    
    # Use ColumnTransformer to handle categorical and numeric columns
    if categorical_cols:
        # Create transformer with one-hot encoding for categorical columns
        transformer = ColumnTransformer(
            transformers=[
                ('cat', OneHotEncoder(drop='first', sparse_output=False), categorical_cols)
            ],
            remainder='passthrough'  # Keep numeric columns as-is
        )
        
        # Fit on real data and transform both datasets
        real_processed = transformer.fit_transform(real_df)
        synthetic_processed = transformer.transform(synthetic_df)
    else:
        # No categorical columns, just use numeric data
        real_processed = real_df.values
        synthetic_processed = synthetic_df.values
    
    # Convert to float32
    real_processed = real_processed.astype(np.float32)
    synthetic_processed = synthetic_processed.astype(np.float32)
    
    return real_processed, synthetic_processed

 