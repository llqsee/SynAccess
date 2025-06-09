from typing import Dict, List, Any, Tuple, Union
import numpy as np
import pandas as pd
import time
from umap import UMAP
from openTSNE import TSNE
from utils.data_preprocessing import preprocess_data

class EmbeddingService:
    def __init__(self):
        """Initialize the embedding service with available methods."""
        self.methods = {
            "umap": self._compute_umap,
            "tsne": self._compute_tsne
        }

    def compute_embedding(
        self,
        real_data: Union[np.ndarray, List[List[Any]], pd.DataFrame],
        synthetic_data: Union[np.ndarray, List[List[Any]], pd.DataFrame],
        method: str = "umap",
        params: Dict[str, Any] = None,
        n_samples: int = None,
        real_headers: List[str] = None,
        synthetic_headers: List[str] = None
    ) -> Tuple[Dict[str, List[List[float]]], Dict[str, Any]]:
        """
        Compute embeddings for real and synthetic data using one-hot encoding for categorical features.
        Trains on real data only, transforms both real and synthetic data separately.
        
        Args:
            real_data: Real dataset
            synthetic_data: Synthetic dataset
            method: Embedding method ('umap' or 'tsne')
            params: Method-specific parameters
            n_samples: Number of samples to use (optional)
            real_headers: Column headers for real data
            synthetic_headers: Column headers for synthetic data
            
        Returns:
            embeddings: Dictionary with 'real' and 'synthetic' embedding arrays
            metadata: Dictionary with embedding metadata
        """
        start_time = time.time()
        method = method.lower()
        params = params or {}
        
        if method not in self.methods:
            raise ValueError(f"Unsupported method: {method}")
        
        if method == "tsne" and params.get("n_components", 2) != 2:
            raise ValueError("t-SNE only supports 2D visualizations.")
        
        # Preprocess data using simplified preprocessing
        real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
        preprocessing_metadata = {'preprocessing': 'simplified_categorical_encoding'}
        
        # Handle sampling parameters
        n_real_samples = params.pop('n_real_samples', None)
        n_synth_samples = params.pop('n_synth_samples', None)
        random_state = params.get('random_state', None)
        
        # Validate sample sizes
        if n_real_samples is not None and n_real_samples > len(real_processed):
            raise ValueError(
                f"Requested {n_real_samples} real samples, but only {len(real_processed)} available."
            )
        if n_synth_samples is not None and n_synth_samples > len(synth_processed):
            raise ValueError(
                f"Requested {n_synth_samples} synthetic samples, but only {len(synth_processed)} available."
            )
        
        # Sample data
        rng = np.random.default_rng(random_state)
        real_n = n_real_samples
        synth_n = n_synth_samples or len(synth_processed)
        
        real_idx = rng.choice(len(real_processed), real_n, replace=False)
        synth_idx = rng.choice(len(synth_processed), synth_n, replace=False)
        real_sampled = real_processed[real_idx]
        synth_sampled = synth_processed[synth_idx]
        
        # Compute embeddings using the method
        embedding_real, embedding_synth = self.methods[method](
            real_sampled, synth_sampled, **params
        )
        
        # Collect metadata
        metadata = {
            "runtime": time.time() - start_time,
            "method": method,
            "params": params,
            "input_shape": real_sampled.shape,
            "real_samples": real_n,
            "synthetic_samples": synth_n,
            "preprocessing": preprocessing_metadata
        }
        
        # Convert to lists for JSON serialization
        embeddings = {
            "real": embedding_real.tolist(),
            "synthetic": embedding_synth.tolist()
        }
        
        return embeddings, metadata
    
    def _compute_umap(
        self,
        real_data: np.ndarray,
        synth_data: np.ndarray,
        n_components: int = 2,
        n_neighbors: int = 15,
        min_dist: float = 0.1,
        random_state: int = None,
        **kwargs
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute UMAP embedding: fit on real data, transform both real and synthetic.
        """
        umap_model = UMAP(
            n_components=n_components,
            n_neighbors=n_neighbors,
            min_dist=min_dist,
            random_state=random_state,
            **kwargs
        )
        
        # Fit on real data only
        umap_model.fit(real_data)
        
        # Transform both real and synthetic data
        embedding_real = umap_model.transform(real_data)
        embedding_synth = umap_model.transform(synth_data)
        
        return embedding_real, embedding_synth    
    
    
    def _compute_tsne(
        self,
        real_data: np.ndarray,
        synth_data: np.ndarray,
        n_components: int = 2,
        perplexity: float = 30.0,
        early_exaggeration: float = 12.0,
        random_state: int = None,
        n_jobs: int = -1,
        **kwargs
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute t-SNE embedding using openTSNE.
        Fit on real data, then transform both real and synthetic data.
        """   
        # Make sure both datasets are numeric and cleaned
        real_data = np.nan_to_num(real_data.astype(np.float32))
        synth_data = np.nan_to_num(synth_data.astype(np.float32))

        # Fit on real data only
        tsne = TSNE(
            n_components=n_components,
            perplexity=perplexity,
            early_exaggeration=early_exaggeration,
            metric="euclidean",
            random_state=random_state,
            n_jobs=n_jobs,
            verbose=True,
            **kwargs
        )
        
        # Fit real data
        tsne_embedding = tsne.fit(real_data)       
        
        # Transform both real synthetic data
        partial_embedding_real = tsne_embedding.transform(real_data)        
        embedding_real = np.array(partial_embedding_real)

        partial_embedding_synth = tsne_embedding.transform(synth_data)        
        embedding_synth = np.array(partial_embedding_synth)


        return embedding_real, embedding_synth