import numpy as np
from sklearn.manifold import TSNE
from umap import UMAP
from time import time
from typing import Tuple, Dict, Any

class EmbeddingService:
    def __init__(self):
        self.methods = {
            "umap": self._compute_umap,
            "tsne": self._compute_tsne
        }
    
    def compute_embedding(
        self,
        data: np.ndarray,
        method: str = "umap",
        params: Dict[str, Any] = None
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Compute 2D embeddings using the specified method.
        
        Args:
            data: Input data array of shape (n_samples, n_features)
            method: Embedding method ('umap' or 'tsne')
            params: Additional parameters for the embedding method
            
        Returns:
            Tuple of (embeddings, metadata)
            - embeddings: array of shape (n_samples, 2)
            - metadata: dict containing runtime and parameters
        """
        if method not in self.methods:
            raise ValueError(f"Unknown embedding method: {method}")
            
        params = params or {}
        start_time = time()
        
        # Compute embeddings
        embeddings = self.methods[method](data, **params)
        
        # Collect metadata
        metadata = {
            "runtime": time() - start_time,
            "method": method,
            "parameters": params,
            "input_shape": data.shape
        }
        
        return embeddings, metadata
    
    def _compute_umap(
        self,
        data: np.ndarray,
        n_neighbors: int = 15,
        min_dist: float = 0.1,
        **kwargs
    ) -> np.ndarray:
        """Compute UMAP embedding."""
        umap = UMAP(
            n_neighbors=n_neighbors,
            min_dist=min_dist,
            n_components=2,
            random_state=42,
            **kwargs
        )
        return umap.fit_transform(data)
    
    def _compute_tsne(
        self,
        data: np.ndarray,
        perplexity: float = 30.0,
        early_exaggeration: float = 12.0,
        **kwargs
    ) -> np.ndarray:
        """Compute t-SNE embedding."""
        tsne = TSNE(
            n_components=2,
            perplexity=perplexity,
            early_exaggeration=early_exaggeration,
            random_state=42,
            **kwargs
        )
        return tsne.fit_transform(data) 