from typing import Dict, List, Any, Tuple, Union, Callable, Optional
import numpy as np
import pandas as pd
import time
from umap import UMAP
from openTSNE import TSNE
from utils.data_preprocessing import preprocess_data

# GPU support imports
try:
    import cupy as cp
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False

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
        synthetic_headers: List[str] = None,
        progress_callback: Optional[Callable[[float], None]] = None
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
            progress_callback: Optional callback for progress updates (0.0 to 1.0)
            
        Returns:
            embeddings: Dictionary with 'real' and 'synthetic' embedding arrays
            metadata: Dictionary with embedding metadata
        """
        from utils.logging_config import get_logger
        logger = get_logger(__name__)
        
        start_time = time.time()
        method = method.lower()
        params = params or {}
        
        if method not in self.methods:
            raise ValueError(f"Unsupported method: {method}")
        
        if method == "tsne" and params.get("n_components", 2) != 2:
            raise ValueError("t-SNE only supports 2D visualizations.")
        
        # Report initial progress
        if progress_callback:
            progress_callback(0.1)
        
        # Preprocess data using simplified preprocessing
        real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
        preprocessing_metadata = {'preprocessing': 'simplified_categorical_encoding'}
        
        # Report preprocessing completion
        if progress_callback:
            progress_callback(0.2)
        
        # Handle sampling parameters
        n_real_samples = params.pop('n_real_samples', None)
        n_synth_samples = params.pop('n_synth_samples', None)
        random_state = params.get('random_state', None)
        
        # Ensure we have valid sample sizes (use all data if not specified)
        if n_real_samples is None:
            n_real_samples = len(real_processed)
        if n_synth_samples is None:
            n_synth_samples = len(synth_processed)
        
        # Validate sample sizes
        if n_real_samples > len(real_processed):
            raise ValueError(
                f"Requested {n_real_samples} real samples, but only {len(real_processed)} available."
            )
        if n_synth_samples > len(synth_processed):
            raise ValueError(
                f"Requested {n_synth_samples} synthetic samples, but only {len(synth_processed)} available."
            )
        
        # Sample data
        rng = np.random.default_rng(random_state)
        real_n = n_real_samples
        synth_n = n_synth_samples
        
        # Only sample if we need fewer samples than available
        if real_n < len(real_processed):
            real_idx = rng.choice(len(real_processed), real_n, replace=False)
            real_sampled = real_processed[real_idx]
        else:
            real_sampled = real_processed
            
        if synth_n < len(synth_processed):
            synth_idx = rng.choice(len(synth_processed), synth_n, replace=False)
            synth_sampled = synth_processed[synth_idx]
        else:
            synth_sampled = synth_processed
        
        # Report sampling completion
        if progress_callback:
            progress_callback(0.3)
        
        # Compute embeddings using the method
        result = self.methods[method](
            real_sampled, synth_sampled, progress_callback=progress_callback, **params
        )
        
        # Unpack results (now includes model)
        if len(result) == 3:
            embedding_real, embedding_synth, model = result
        else:
            embedding_real, embedding_synth = result
            model = None
        
        # Collect metadata
        metadata = {
            "runtime": time.time() - start_time,
            "method": method,
            "params": params,
            "input_shape": real_sampled.shape,
            "real_samples": real_n,
            "synthetic_samples": synth_n,
            "preprocessing": preprocessing_metadata,
            "gpu_available": GPU_AVAILABLE,
            "gpu_used": params.get("use_gpu", False) if method == "umap" else False
        }
        
        # Convert to lists for JSON serialization
        embeddings = {
            "real": embedding_real.tolist(),
            "synthetic": embedding_synth.tolist()
        }
        
        # Add model to metadata if available
        if model is not None:
            metadata["model"] = model
            logger.info(f"Added model to metadata for {method} embedding. Model type: {type(model).__name__}")
        else:
            logger.warning(f"No model available for {method} embedding")
        
        return embeddings, metadata
    
    def _compute_umap(
        self,
        real_data: np.ndarray,
        synth_data: np.ndarray,
        n_components: int = 2,
        n_neighbors: int = 15,
        min_dist: float = 0.1,
        random_state: int = None,
        use_gpu: bool = False,
        progress_callback: Optional[Callable[[float], None]] = None,
        **kwargs
    ) -> Tuple[np.ndarray, np.ndarray, object]:
        """
        Compute UMAP embedding: fit on real data, transform both real and synthetic.
        Supports both CPU and GPU acceleration.
        """
        # Check GPU availability
        if use_gpu and not GPU_AVAILABLE:
            raise ValueError("GPU acceleration requested but CuPy is not available. Install cupy for GPU support.")
        
        # Convert to GPU arrays if requested
        if use_gpu and GPU_AVAILABLE:
            real_data_gpu = cp.asarray(real_data)
            synth_data_gpu = cp.asarray(synth_data)
        else:
            real_data_gpu = real_data
            synth_data_gpu = synth_data
        
        umap_model = UMAP(
            n_components=n_components,
            n_neighbors=n_neighbors,
            min_dist=min_dist,
            random_state=random_state,
            **kwargs
        )
        
        # Fit on real data only
        if progress_callback:
            progress_callback(0.5)
        umap_model.fit(real_data_gpu)
        
        # Transform both real and synthetic data
        if progress_callback:
            progress_callback(0.8)
        embedding_real = umap_model.transform(real_data_gpu)
        embedding_synth = umap_model.transform(synth_data_gpu)
        
        # Convert back to CPU arrays if using GPU
        if use_gpu and GPU_AVAILABLE:
            embedding_real = cp.asnumpy(embedding_real)
            embedding_synth = cp.asnumpy(embedding_synth)
        
        if progress_callback:
            progress_callback(0.95)
        
        return embedding_real, embedding_synth, umap_model    
    
    
    def _compute_tsne(
        self,
        real_data: np.ndarray,
        synth_data: np.ndarray,
        n_components: int = 2,
        perplexity: float = 30.0,
        early_exaggeration: float = 12.0,
        random_state: int = None,
        n_jobs: int = 1,
        progress_callback: Optional[Callable[[float], None]] = None,
        **kwargs
    ) -> Tuple[np.ndarray, np.ndarray, object]:
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
        if progress_callback:
            progress_callback(0.5)
        tsne_embedding = tsne.fit(real_data)       
        
        # Transform both real synthetic data
        if progress_callback:
            progress_callback(0.8)
        partial_embedding_real = tsne_embedding.transform(real_data)        
        embedding_real = np.array(partial_embedding_real)

        partial_embedding_synth = tsne_embedding.transform(synth_data)        
        embedding_synth = np.array(partial_embedding_synth)

        if progress_callback:
            progress_callback(0.95)

        return embedding_real, embedding_synth, tsne_embedding 

    def compute_embedding_with_pretrained_model(
        self,
        real_data: Union[np.ndarray, List[List[Any]], pd.DataFrame],
        synthetic_data: Union[np.ndarray, List[List[Any]], pd.DataFrame],
        pretrained_model: Any,
        method: str = "umap",
        real_headers: List[str] = None,
        synthetic_headers: List[str] = None,
        progress_callback: Optional[Callable[[float], None]] = None,
        fine_tune: bool = False
    ) -> Tuple[Dict[str, List[List[float]]], Dict[str, Any]]:
        """
        Compute embeddings using a pre-trained model.
        
        Args:
            real_data: Real dataset
            synthetic_data: Synthetic dataset
            pretrained_model: Pre-trained UMAP or t-SNE model
            method: Embedding method ('umap' or 'tsne')
            real_headers: Column headers for real data
            synthetic_headers: Column headers for synthetic data
            progress_callback: Optional callback for progress updates (0.0 to 1.0)
            fine_tune: Whether to fine-tune the model on real data before transforming
            
        Returns:
            embeddings: Dictionary with 'real' and 'synthetic' embedding arrays
            metadata: Dictionary with embedding metadata
        """
        from utils.logging_config import get_logger
        logger = get_logger(__name__)
        
        start_time = time.time()
        method = method.lower()
        
        logger.info(f"Starting pre-trained model embedding with method: {method}, fine_tune: {fine_tune}")
        
        if method not in ["umap", "tsne"]:
            raise ValueError(f"Unsupported method: {method}")
        
        # Auto-detect model type if method is not specified or to validate
        detected_method = method
        model_type = type(pretrained_model).__name__
        
        # Try to auto-detect the model type
        if "UMAP" in model_type:
            detected_method = "umap"
            logger.info(f"Detected UMAP model: {model_type}")
        elif "TSNE" in model_type or "TSNE" in str(pretrained_model.__class__):
            detected_method = "tsne"
            logger.info(f"Detected t-SNE model: {model_type}")
        else:
            logger.warning(f"Could not auto-detect model type: {model_type}, using specified method: {method}")
        
        # Use detected method if it differs from specified method
        if detected_method != method:
            logger.info(f"Model type detection suggests {detected_method}, but method was specified as {method}")
            logger.info(f"Using detected method: {detected_method}")
            method = detected_method
        
        # Validate that the model has the expected attributes for the detected type
        if method == "umap":
            expected_attrs = ['n_components', 'n_neighbors', 'min_dist', 'metric', 'random_state']
            missing_attrs = [attr for attr in expected_attrs if not hasattr(pretrained_model, attr)]
            if missing_attrs:
                raise ValueError(f"Model appears to be UMAP but missing attributes: {missing_attrs}")
        elif method == "tsne":
            expected_attrs = ['n_components', 'perplexity', 'early_exaggeration', 'metric', 'random_state']
            missing_attrs = [attr for attr in expected_attrs if not hasattr(pretrained_model, attr)]
            if missing_attrs:
                raise ValueError(f"Model appears to be t-SNE but missing attributes: {missing_attrs}")
        
        logger.info(f"Using {method.upper()} model with type: {model_type}")
        
        # Report initial progress
        if progress_callback:
            progress_callback(0.1)
        
        logger.info("Preprocessing data...")
        # Preprocess data using simplified preprocessing
        real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
        preprocessing_metadata = {'preprocessing': 'simplified_categorical_encoding'}
        
        # Report preprocessing completion
        if progress_callback:
            progress_callback(0.3)
        
        logger.info("Converting data to numpy arrays...")
        # Convert to numpy arrays if needed
        if not isinstance(real_processed, np.ndarray):
            real_processed = np.array(real_processed)
        if not isinstance(synth_processed, np.ndarray):
            synth_processed = np.array(synth_processed)
        
        # Ensure data is numeric
        real_processed = np.nan_to_num(real_processed.astype(np.float32))
        synth_processed = np.nan_to_num(synth_processed.astype(np.float32))
        
        # Report data preparation completion
        if progress_callback:
            progress_callback(0.5)
        
        # Handle fine-tuning if requested
        if fine_tune:
            logger.info(f"Adapting {method.upper()} model to real data...")
            try:
                # Fine-tune the model on real data
                if method == "umap":
                    # For UMAP, we need to create a new model with the same parameters
                    # and fit it on the real data, then use it for transformation
                    logger.info("Creating new UMAP model with same parameters for adaptation")
                    
                    # Extract parameters from the pre-trained model
                    umap_params = {
                        'n_components': pretrained_model.n_components,
                        'n_neighbors': pretrained_model.n_neighbors,
                        'min_dist': pretrained_model.min_dist,
                        'metric': pretrained_model.metric,
                        'random_state': pretrained_model.random_state
                    }
                    
                    # Create new UMAP model with same parameters
                    adapted_model = UMAP(**umap_params)
                    
                    # Fit the new model on real data
                    logger.info("Fitting adapted UMAP model on real data")
                    adapted_model.fit(real_processed)
                    
                    # Use the adapted model for transformation
                    pretrained_model = adapted_model
                    logger.info("Adapted UMAP model ready for transformation")
                    
                    # Store the actual adapted model parameters
                    adapted_model_params = {
                        'n_components': adapted_model.n_components,
                        'n_neighbors': adapted_model.n_neighbors,
                        'min_dist': adapted_model.min_dist,
                        'metric': adapted_model.metric,
                        'random_state': adapted_model.random_state
                    }
                    
                elif method == "tsne":
                    # For t-SNE, we need to fit a new model with the same parameters
                    logger.info("Creating new t-SNE model with same parameters for adaptation")
                    
                    # Extract parameters from the pre-trained model
                    tsne_params = {
                        'n_components': pretrained_model.n_components,
                        'perplexity': pretrained_model.perplexity,
                        'early_exaggeration': pretrained_model.early_exaggeration,
                        'metric': pretrained_model.metric,
                        'random_state': pretrained_model.random_state
                    }
                    
                    # Create new t-SNE model with same parameters
                    from openTSNE import TSNE
                    adapted_model = TSNE(**tsne_params)
                    
                    # Fit the new model on real data
                    logger.info("Fitting adapted t-SNE model on real data")
                    adapted_model.fit(real_processed)
                    
                    # Use the adapted model for transformation
                    pretrained_model = adapted_model
                    logger.info("Adapted t-SNE model ready for transformation")
                    
                    # Store the actual adapted model parameters
                    adapted_model_params = {
                        'n_components': adapted_model.n_components,
                        'perplexity': adapted_model.perplexity,
                        'early_exaggeration': adapted_model.early_exaggeration,
                        'metric': adapted_model.metric,
                        'random_state': adapted_model.random_state
                    }
                
                logger.info("Model adaptation completed")
            except Exception as e:
                logger.error(f"Error during model adaptation: {e}")
                raise ValueError(f"Failed to adapt model: {str(e)}")
        
        logger.info(f"Transforming data with pre-trained {method.upper()} model...")
        # Transform data using pre-trained model
        try:
            # Validate model compatibility
            logger.info(f"Model type: {type(pretrained_model).__name__}")
            logger.info(f"Real data shape: {real_processed.shape}")
            logger.info(f"Synthetic data shape: {synth_processed.shape}")
            
            if method == "umap":
                embedding_real = pretrained_model.transform(real_processed)
                embedding_synth = pretrained_model.transform(synth_processed)
            elif method == "tsne":
                embedding_real = pretrained_model.transform(real_processed)
                embedding_synth = pretrained_model.transform(synth_processed)
            else:
                raise ValueError(f"Unsupported method for pre-trained model: {method}")
        except Exception as e:
            logger.error(f"Error transforming data with pre-trained model: {e}")
            raise ValueError(f"Failed to transform data with pre-trained model: {str(e)}")
        
        # Report transformation completion
        if progress_callback:
            progress_callback(0.9)
        
        logger.info("Preparing results...")
        # Prepare results
        embeddings = {
            "real": embedding_real.tolist(),
            "synthetic": embedding_synth.tolist()
        }
        
        runtime = time.time() - start_time
        
        metadata = {
            "method": method,
            "runtime": runtime,
            "real_samples": len(real_processed),
            "synthetic_samples": len(synth_processed),
            "real_data_shape": real_processed.shape,
            "synthetic_data_shape": synth_processed.shape,
            "embedding_dimensions": embedding_real.shape[1],
            "pretrained_model": True,
            "model_type": type(pretrained_model).__name__,
            "fine_tuned": fine_tune,
            "adapted_model": fine_tune,  # Indicates this is a newly created adapted model
            **preprocessing_metadata
        }
        
        # Store the model that was actually used for transformation
        if fine_tune:
            # For adapted models, store the newly created adapted model
            metadata["model"] = pretrained_model
            # Also store the actual adapted model parameters
            metadata["adapted_model_params"] = adapted_model_params
        else:
            # For direct use, store the original pre-trained model
            metadata["model"] = pretrained_model
        
        if progress_callback:
            progress_callback(1.0)
        
        logger.info(f"Pre-trained model embedding completed in {runtime:.2f} seconds")
        
        return embeddings, metadata 