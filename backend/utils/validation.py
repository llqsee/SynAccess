from typing import List, Union, Dict, Any
import numpy as np
import pandas as pd

# def validate_data_dimensions(
#     real_data: Union[np.ndarray, List[List[float]], pd.DataFrame],
#     synthetic_data: Union[np.ndarray, List[List[float]], pd.DataFrame]
# ) -> None:
#     """
#     Validate that real and synthetic data have compatible dimensions.
    
#     Args:
#         real_data: Real dataset
#         synthetic_data: Synthetic dataset
        
#     Raises:
#         ValueError: If dimensions are incompatible
#     """
#     real = np.asarray(real_data)
#     synth = np.asarray(synthetic_data)
    
#     if real.shape[1] != synth.shape[1]:
#         raise ValueError(
#             f"Dimension mismatch: real data has {real.shape[1]} features, "
#             f"synthetic data has {synth.shape[1]} features"
#         )

def validate_embedding_params(method: str, params: Dict[str, Any]) -> None:
    """
    Validate embedding method parameters.
    
    Args:
        method: Embedding method ('umap' or 'tsne')
        params: Method-specific parameters
        
    Raises:
        ValueError: If parameters are invalid
    """
    method = method.lower()
    if method not in {"umap", "tsne"}:
        raise ValueError(f"Unsupported method: {method}")
    
    # Define valid parameters for each method
    valid_params = {
        "umap": {"n_neighbors", "min_dist", "n_components", "random_state", "n_real_samples", "n_synth_samples"},
        "tsne": {"perplexity", "early_exaggeration", "n_components", "random_state", "n_real_samples", "n_synth_samples"}
    }
    
    # Check for invalid parameters
    invalid_params = set(params.keys()) - valid_params[method]
    if invalid_params:
        raise ValueError(f"Invalid parameters for {method}: {invalid_params}") 