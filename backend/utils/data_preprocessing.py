import numpy as np
import pandas as pd
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from typing import Tuple, List, Any, Union, Dict, Optional

def preprocess_data(real_data: Union[List[List[Any]], np.ndarray, pd.DataFrame], 
                   synthetic_data: Union[List[List[Any]], np.ndarray, pd.DataFrame],
                   transformer: ColumnTransformer = None,
                   return_transformer: bool = False,
                   real_headers: Optional[List[str]] = None,
                   synthetic_headers: Optional[List[str]] = None,
                   alignment_strategy: str = "intersect") -> Union[
                       Tuple[np.ndarray, np.ndarray],
                       Tuple[np.ndarray, np.ndarray, ColumnTransformer],
                       Tuple[np.ndarray, np.ndarray, ColumnTransformer, Dict[str, Any]]
                   ]:
    """
    Clean and prepare your data for analysis.
    
    This function converts your data to the right format, handles
    categorical variables by encoding them, and ensures everything
    is ready for the embedding algorithms.
    
    Args:
        real_data: Your real dataset
        synthetic_data: Your synthetic dataset  
        transformer: Pre-trained transformer (for reusing models)
        return_transformer: Whether to return the transformer for reuse
        
    Returns:
        Cleaned numeric arrays ready for analysis
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
    
    # Establish original headers if provided; fallback to indices
    if real_headers and len(real_headers) == real_df.shape[1]:
        real_df.columns = real_headers
    else:
        real_df.columns = [f"col_{i}" for i in range(real_df.shape[1])]

    if synthetic_headers and len(synthetic_headers) == synthetic_df.shape[1]:
        synthetic_df.columns = synthetic_headers
    else:
        synthetic_df.columns = [f"col_{i}" for i in range(synthetic_df.shape[1])]

    alignment_info: Dict[str, Any] = {
        "strategy": alignment_strategy,
        "real_columns_original": list(real_df.columns),
        "synthetic_columns_original": list(synthetic_df.columns)
    }

    # Align columns according to strategy when counts differ or names differ
    if alignment_strategy == "intersect":
        common_cols = [c for c in real_df.columns if c in synthetic_df.columns]
        if not common_cols:
            # Fallback: positional min length
            min_len = min(real_df.shape[1], synthetic_df.shape[1])
            real_df = real_df.iloc[:, :min_len]
            synthetic_df = synthetic_df.iloc[:, :min_len]
            new_cols = [f"col_{i}" for i in range(min_len)]
            real_df.columns = new_cols
            synthetic_df.columns = new_cols
            alignment_info["mode"] = "positional_truncate"
        else:
            real_df = real_df[common_cols]
            synthetic_df = synthetic_df[common_cols]
            alignment_info["mode"] = "intersection"
            alignment_info["aligned_columns"] = common_cols
    elif alignment_strategy == "union":
        # Build union and add missing columns filled with NaN
        union_cols = list(dict.fromkeys(list(real_df.columns) + list(synthetic_df.columns)))
        for c in union_cols:
            if c not in real_df.columns:
                real_df[c] = np.nan
            if c not in synthetic_df.columns:
                synthetic_df[c] = np.nan
        real_df = real_df[union_cols]
        synthetic_df = synthetic_df[union_cols]
        alignment_info["mode"] = "union"
        alignment_info["aligned_columns"] = union_cols
    elif alignment_strategy == "positional":
        # Truncate to min length by position, renaming to col_i
        min_len = min(real_df.shape[1], synthetic_df.shape[1])
        real_df = real_df.iloc[:, :min_len]
        synthetic_df = synthetic_df.iloc[:, :min_len]
        new_cols = [f"col_{i}" for i in range(min_len)]
        real_df.columns = new_cols
        synthetic_df.columns = new_cols
        alignment_info["mode"] = "positional_truncate"
        alignment_info["aligned_columns"] = new_cols
    else:
        alignment_info["mode"] = "none"  # No special alignment
    
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
        return real_processed, synthetic_processed, transformer, alignment_info
    else:
        return real_processed, synthetic_processed

 