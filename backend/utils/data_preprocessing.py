import numpy as np
import pandas as pd
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from typing import Tuple, List, Any, Union

def preprocess_data(real_data: Union[List[List[Any]], np.ndarray, pd.DataFrame], 
                   synthetic_data: Union[List[List[Any]], np.ndarray, pd.DataFrame],
                   transformer: ColumnTransformer = None,
                   return_transformer: bool = False) -> Union[Tuple[np.ndarray, np.ndarray], Tuple[np.ndarray, np.ndarray, ColumnTransformer]]:
    """
    Simple preprocessing: convert to DataFrames, one-hot encode categorical columns, and return clean numeric arrays.
    
    Args:
        real_data: Real dataset (List of lists, numpy array, or pandas DataFrame)
        synthetic_data: Synthetic dataset (List of lists, numpy array, or pandas DataFrame)
        transformer: Pre-fitted ColumnTransformer to reuse (for pretrained models)
        return_transformer: Whether to return the fitted transformer
        
    Returns:
        Tuple of processed real and synthetic data as numeric numpy arrays
        If return_transformer=True, also returns the fitted ColumnTransformer
    """
    # Convert to pandas DataFrames
    if isinstance(real_data, list):
        real_df = pd.DataFrame(real_data)
    elif isinstance(real_data, np.ndarray):
        real_df = pd.DataFrame(real_data)
    elif isinstance(real_data, pd.DataFrame):
        real_df = real_data.copy()
    else:
        raise ValueError(f"Unsupported real_data type: {type(real_data)}")
    
    if isinstance(synthetic_data, list):
        synthetic_df = pd.DataFrame(synthetic_data)
    elif isinstance(synthetic_data, np.ndarray):
        synthetic_df = pd.DataFrame(synthetic_data)
    elif isinstance(synthetic_data, pd.DataFrame):
        synthetic_df = synthetic_data.copy()
    else:
        raise ValueError(f"Unsupported synthetic_data type: {type(synthetic_data)}")
    
    # Ensure both DataFrames have the same columns
    if len(real_df.columns) != len(synthetic_df.columns):
        # If column counts don't match, use numeric indices
        real_df.columns = range(len(real_df.columns))
        synthetic_df.columns = range(len(synthetic_df.columns))
    
    # If transformer is provided (pretrained model), use it directly
    if transformer is not None:
        # Use the pre-fitted transformer (FAST PATH for pretrained models)
        real_processed = transformer.transform(real_df)
        synthetic_processed = transformer.transform(synthetic_df)
    else:
        # Original preprocessing logic (SLOW PATH for new models)
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
            # Use handle_unknown='ignore' to gracefully handle new categories in pretrained models
            transformer = ColumnTransformer(
                transformers=[
                    ('cat', OneHotEncoder(drop='first', sparse_output=False, handle_unknown='ignore'), categorical_cols)
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
            transformer = None  # No transformer needed for all-numeric data
    
    # Convert to float32
    real_processed = real_processed.astype(np.float32)
    synthetic_processed = synthetic_processed.astype(np.float32)
    
    if return_transformer:
        return real_processed, synthetic_processed, transformer
    else:
        return real_processed, synthetic_processed

 