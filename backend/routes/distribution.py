from fastapi import APIRouter, HTTPException
from typing import List, Any, Optional
import numpy as np
import pandas as pd
from pydantic import BaseModel
from collections import Counter
from utils.data_preprocessing import preprocess_data



router = APIRouter()

class DistributionRequest(BaseModel):
    real_data: List[List[Any]]
    synthetic_data: List[List[Any]]
    column: str
    plot_type: str
    real_headers: Optional[List[str]] = None
    synthetic_headers: Optional[List[str]] = None    

def get_column_data(data, headers, column_name):
    """Extract column data from the dataset using existing headers."""
    if headers and column_name in headers:
        column_index = headers.index(column_name)
        return [row[column_index] for row in data if len(row) > column_index]
    else:
        raise ValueError(f"Column '{column_name}' not found in headers")

def classify_column_type(real_data: List[List[Any]], synthetic_data: List[List[Any]], 
                        real_headers: List[str], synthetic_headers: List[str], column: str):
    """
    Use the same data type classification logic as data_preprocessing.py
    but return the classification without modifying the data.
    """
    # Convert to DataFrames (same as preprocessing)
    real_df = pd.DataFrame(real_data, columns=real_headers)
    synthetic_df = pd.DataFrame(synthetic_data, columns=synthetic_headers)
    
    if column not in real_df.columns:
        raise ValueError(f"Column '{column}' not found in real data headers")
    if column not in synthetic_df.columns:
        raise ValueError(f"Column '{column}' not found in synthetic data headers")
    
    # Use the exact same logic as data_preprocessing.py
    real_numeric = pd.to_numeric(real_df[column], errors='coerce')
    synthetic_numeric = pd.to_numeric(synthetic_df[column], errors='coerce')
    
    # Same 50% threshold as preprocessing
    real_na_ratio = real_numeric.isna().sum() / len(real_df)
    synthetic_na_ratio = synthetic_numeric.isna().sum() / len(synthetic_df)
    
    is_numeric = real_na_ratio <= 0.5    
   
    
    if is_numeric:
        # Return cleaned numeric values (same as preprocessing)
        real_clean = real_numeric.fillna(0).tolist()
        synthetic_clean = synthetic_numeric.fillna(0).tolist()
        return 'numeric', real_clean, synthetic_clean
    else:
        # Return original categorical values
        real_clean = real_df[column].tolist()
        synthetic_clean = synthetic_df[column].tolist()
        return 'categorical', real_clean, synthetic_clean

@router.post("/distribution")
async def generate_distribution_plot(request: DistributionRequest):
    """
    Generate distribution comparison plots for real and synthetic data.
    Uses the same data type classification logic as data_preprocessing.py for consistency.
    
    Args:
        request: DistributionRequest containing:
            - real_data: Real dataset
            - synthetic_data: Synthetic dataset
            - column: Column name to analyze
            - plot_type: Type of plot to generate
            - real_headers: Optional list of real data headers
            - synthetic_headers: Optional list of synthetic data headers
            
    Returns:
        dict: Contains plot data and statistics
    """
    try:
        # Use the same classification logic as data_preprocessing.py
        column_type, real_values, synthetic_values = classify_column_type(
            request.real_data, request.synthetic_data,
            request.real_headers, request.synthetic_headers,
            request.column
        )
        
        plot_type = request.plot_type

        # Generate the requested plot type
        if plot_type == "histogram":
            # Histogram plots should only be for numeric data
            if column_type != 'numeric':
                raise HTTPException(status_code=400, detail=f"Histogram plots are only supported for numeric data. Column '{request.column}' appears to be categorical. Please use 'bar' plot type for categorical data.")
            
            return {
                "plot_type": "histogram",
                "real_values": real_values,
                "synthetic_values": synthetic_values,                
            }
                
        elif plot_type == "histogram_comparison":
            # Histogram comparison should only be for numeric data
            if column_type != 'numeric':
                raise HTTPException(status_code=400, detail=f"Histogram comparison plots are only supported for numeric data. Column '{request.column}' appears to be categorical. Please use 'bar' plot type for categorical data.")
            
            return {
                "plot_type": "histogram_comparison",
                "real_values": real_values,
                "synthetic_values": synthetic_values
            }
                
        elif plot_type == "violin":
            # Violin plots should only be for numeric data
            if column_type != 'numeric':
                raise HTTPException(status_code=400, detail=f"Violin plots are only supported for numeric data. Column '{request.column}' appears to be categorical. Please use 'bar' plot type for categorical data.")
            
            return {
                "plot_type": "violin",
                "real_values": real_values,
                "synthetic_values": synthetic_values
            }
                
        elif plot_type == "bar":
            # Bar plots should only be for categorical data
            if column_type != 'categorical':
                raise HTTPException(status_code=400, detail=f"Bar plots are only supported for categorical data. Column '{request.column}' appears to be numeric. Please use 'histogram' or 'violin' plot types for numeric data.")
            
            # Categorical data - count occurrences
            real_counts = Counter(real_values)
            synthetic_counts = Counter(synthetic_values)
            all_categories = sorted(set(real_counts.keys()) | set(synthetic_counts.keys()))
            real = [real_counts.get(cat, 0) for cat in all_categories]
            synth = [synthetic_counts.get(cat, 0) for cat in all_categories]
            
            return {
                "plot_type": "bar",
                "categories": all_categories,
                "real_counts": real,
                "synthetic_counts": synth
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported plot type: {plot_type}")

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 