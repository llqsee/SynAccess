import numpy as np
from typing import Union, List

def validate_input_data(data: Union[np.ndarray, List[List[float]]]) -> None:
    """
    Validate input data for embedding computation.
    
    Args:
        data: Input data array or nested list
        
    Raises:
        ValueError: If data is invalid
    """
    # Convert to numpy array if needed
    if isinstance(data, list):
        try:
            data = np.array(data)
        except Exception as e:
            raise ValueError(f"Could not convert input to numpy array: {e}")
    
    # Check dimensions
    if data.ndim != 2:
        raise ValueError(f"Expected 2D input array, got {data.ndim}D")
    
    # Check for empty data
    if data.size == 0:
        raise ValueError("Input data is empty")
    
    # Check for non-finite values
    if not np.all(np.isfinite(data)):
        raise ValueError("Input contains non-finite values (inf or nan)")
    
    # Check minimum size requirements
    if len(data) < 2:
        raise ValueError("Need at least 2 samples for embedding")
    if data.shape[1] < 2:
        raise ValueError("Need at least 2 features for embedding") 