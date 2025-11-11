from typing import Dict, List, Any, Tuple, Union, Callable, Optional
import numpy as np
import pandas as pd
import time
from umap import UMAP
from openTSNE import TSNE
from backend.utils.data_preprocessing import preprocess_data
from backend.utils.dataset_fingerprint import generate_dataset_summary, generate_human_readable_description

# GPU support imports
try:
    import cupy as cp
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False

# Wrapper class to make openTSNE models serializable
class SerializableTSNE:
    """Wrapper for openTSNE models to handle serialization issues.
    
    openTSNE models can't be pickled directly due to file handles and
    internal state. This wrapper extracts the essential data and provides
    a clean interface for saving/loading.
    """
    
    def __init__(self, original_model, computed_embedding_real):
        # Copy the key parameters we need
        self.n_components = getattr(original_model, 'n_components', 2)
        self.perplexity = getattr(original_model, 'perplexity', 30.0)
        self.early_exaggeration = getattr(original_model, 'early_exaggeration', 12.0)
        self.metric = getattr(original_model, 'metric', 'euclidean')
        self.random_state = getattr(original_model, 'random_state', None)
        self.n_jobs = getattr(original_model, 'n_jobs', 1)
        
        # Store the actual embedding results
        self.embedding_ = computed_embedding_real.copy()
        
        # Grab any other useful attributes
        for attr in ['n_iter_', 'kl_divergence_', 'n_features_in_']:
            if hasattr(original_model, attr):
                setattr(self, attr, getattr(original_model, attr))
        
        # Keep original model around for this session only
        self._original_model = original_model
    
    def transform(self, X):
        """Transform new data using the original model if available."""
        if hasattr(self, '_original_model') and self._original_model is not None:
            try:
                return self._original_model.transform(X)
            except Exception as e:
                # If original model transform fails, we can't transform new data
                pass
        
        # If original model is not available, we can't transform new data
        raise NotImplementedError(
            "Transform is not available for this saved TSNE model. "
            "Please create a new embedding for transformation capabilities."
        )
    
    def __getstate__(self):
        """Custom serialization - exclude the original model reference."""
        state = self.__dict__.copy()
        # Remove the original model reference for serialization
        state['_original_model'] = None
        return state
    
    def __setstate__(self, state):
        """Custom deserialization."""
        self.__dict__.update(state)
        # Original model will be None after deserialization
        self._original_model = None

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
        from backend.utils.logging_config import get_logger
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
        
        try:
            # Preprocess data using simplified preprocessing and save transformer
            real_processed, synth_processed, data_transformer, alignment_info = preprocess_data(
                real_data,
                synthetic_data,
                return_transformer=True,
                real_headers=real_headers,
                synthetic_headers=synthetic_headers,
                alignment_strategy=params.get('alignment_strategy', 'intersect')
            )
            preprocessing_metadata = {
                'preprocessing': 'simplified_categorical_encoding',
                'has_transformer': data_transformer is not None,
                'alignment': alignment_info
            }
            
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
            
            # Filter out non-embedding parameters to avoid passing them to UMAP/t-SNE constructors
            embedding_params = params.copy() if params else {}
            
            # Remove parameters that shouldn't be passed to UMAP/t-SNE constructors
            non_embedding_params = [
                'pretrained_model', 'model_job_id', 'job_id', 'fine_tune',
                'real_headers', 'synthetic_headers', 'progress_callback',
                'n_real_samples', 'n_synth_samples', 'alignment_strategy'
            ]
            
            for param in non_embedding_params:
                embedding_params.pop(param, None)
            
            # Compute embeddings using the method
            result = self.methods[method](
                real_sampled, synth_sampled, progress_callback=progress_callback, **embedding_params
            )
            
            # Unpack results (now includes model)
            if len(result) == 3:
                embedding_real, embedding_synth, model = result
            else:
                embedding_real, embedding_synth = result
                model = None
            
            # Generate dataset identification
            dataset_summary = generate_dataset_summary(real_data, synthetic_data, real_headers, synthetic_headers)
            
            # Collect metadata with enhanced identification
            metadata = {
                "runtime": time.time() - start_time,
                "method": method,
                "params": params,
                "input_shape": real_sampled.shape,
                "real_samples": real_n,
                "synthetic_samples": synth_n,
                "preprocessing": preprocessing_metadata,
                "gpu_available": GPU_AVAILABLE,
                "gpu_used": params.get("use_gpu", False) if method == "umap" else False,
                "dataset_identification": dataset_summary
            }
            
            # Convert to lists for JSON serialization
            embeddings = {
                "real": embedding_real.tolist(),
                "synthetic": embedding_synth.tolist()
            }
            
            # Add model and transformer to metadata if available
            if model is not None:
                # Save both the embedding model and the preprocessing transformer with dataset identification
                model_package = {
                    'embedding_model': model,
                    'data_transformer': data_transformer,
                    'dataset_identification': dataset_summary,
                    'training_metadata': {
                        'method': method,
                        'real_samples_used': real_n,
                        'synthetic_samples_used': synth_n,
                        'original_real_shape': len(real_data) if hasattr(real_data, '__len__') else 'unknown',
                        'original_synthetic_shape': len(synthetic_data) if hasattr(synthetic_data, '__len__') else 'unknown',
                        'training_time': time.time() - start_time,
                        'created_at': time.time()
                    }
                }
                metadata["model"] = model_package
                logger.info(f"Added model package to metadata for {method} embedding.")
                logger.info(f"  - Embedding model type: {type(model).__name__}")
                logger.info(f"  - Data transformer: {'present' if data_transformer else 'not needed'}")
                logger.info(f"  - Dataset fingerprint: {dataset_summary['fingerprint']}")
            else:
                logger.warning(f"No model available for {method} embedding")
            
            return embeddings, metadata
            
        except Exception as e:
            logger.error(f"Error in compute_embedding: {str(e)}")
            raise
    
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
            try:
                real_data_gpu = cp.asarray(real_data)
                synth_data_gpu = cp.asarray(synth_data)
            except Exception as e:
                raise ValueError(f"Failed to convert data to GPU arrays: {str(e)}")
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
            try:
                embedding_real = cp.asnumpy(embedding_real)
                embedding_synth = cp.asnumpy(embedding_synth)
            except Exception as e:
                raise ValueError(f"Failed to convert GPU results back to CPU: {str(e)}")
        
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
        from backend.utils.logging_config import get_logger
        logger = get_logger(__name__)
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

        # The openTSNE model cannot be serialized due to Annoy index file handles
        # We need to create a custom serializable wrapper that stores only essential data
        logger.info("Creating serializable TSNE model wrapper...")
        
        # Create the serializable model using the module-level class
        serializable_model = SerializableTSNE(tsne_embedding, embedding_real)
        logger.info(f"Created SerializableTSNE with embedding shape: {serializable_model.embedding_.shape}")
        
        # Test that this version can be serialized
        try:
            import joblib
            import io
            test_buffer = io.BytesIO()
            joblib.dump(serializable_model, test_buffer)
            test_buffer.close()
            logger.info("Created serializable TSNE model successfully")
            return embedding_real, embedding_synth, serializable_model
        except Exception as final_error:
            logger.error(f"Serializable model creation failed: {final_error}")
            # Return without model rather than fail completely
            return embedding_real, embedding_synth, None 

    def compute_embedding_with_pretrained_model(
        self,
        real_data: Union[np.ndarray, List[List[Any]], pd.DataFrame],
        synthetic_data: Union[np.ndarray, List[List[Any]], pd.DataFrame],
        pretrained_model: Any,
        method: str = "umap",
        real_headers: List[str] = None,
        synthetic_headers: List[str] = None,
        progress_callback: Optional[Callable[[float], None]] = None
    ) -> Tuple[Dict[str, List[List[float]]], Dict[str, Any]]:
        """
        Compute embeddings using a pre-trained model with direct transformation.
        
        Args:
            real_data: Real dataset
            synthetic_data: Synthetic dataset
            pretrained_model: Pre-trained UMAP or t-SNE model
            method: Embedding method ('umap' or 'tsne')
            real_headers: Column headers for real data
            synthetic_headers: Column headers for synthetic data
            progress_callback: Optional callback for progress updates (0.0 to 1.0)
            
        Returns:
            embeddings: Dictionary with 'real' and 'synthetic' embedding arrays
            metadata: Dictionary with embedding metadata
        """
        from backend.utils.logging_config import get_logger
        logger = get_logger(__name__)
        
        start_time = time.time()
        method = method.lower()
        
        logger.info(f"Starting direct transformation with pre-trained {method.upper()} model")
        
        if method not in ["umap", "tsne"]:
            raise ValueError(f"Unsupported method: {method}")
        
        # Auto-detect model type
        model_type = type(pretrained_model).__name__
        
        # Try to auto-detect the model type
        if "UMAP" in model_type:
            detected_method = "umap"
            logger.info(f"Detected UMAP model: {model_type}")
        elif "TSNE" in model_type or "TSNEEmbedding" in model_type or "SerializableTSNE" in model_type:
            detected_method = "tsne"
            logger.info(f"Detected t-SNE model: {model_type}")
        else:
            logger.warning(f"Could not auto-detect model type: {model_type}, using specified method: {method}")
            detected_method = method
        
        # Use detected method if it differs from specified method
        if detected_method != method:
            logger.info(f"Model type detection suggests {detected_method}, but method was specified as {method}")
            logger.info(f"Using detected method: {detected_method}")
            method = detected_method
        
        # Validate that the model has the expected attributes
        if method == "umap":
            expected_attrs = ['n_components', 'n_neighbors', 'min_dist', 'metric', 'random_state']
            missing_attrs = [attr for attr in expected_attrs if not hasattr(pretrained_model, attr)]
            if missing_attrs:
                raise ValueError(f"Model appears to be UMAP but missing attributes: {missing_attrs}")
        elif method == "tsne":
            # For TSNE, check for openTSNE attributes (embedding_ or embedding)
            if not hasattr(pretrained_model, 'embedding_') and not hasattr(pretrained_model, 'embedding'):
                raise ValueError(f"Model appears to be t-SNE but missing embedding data")
        
        logger.info(f"Using {method.upper()} model with type: {model_type}")
        
        # Report initial progress
        if progress_callback:
            progress_callback(0.1)
        
        logger.info("Preprocessing data...")
        
        # Check if pretrained_model is a package with transformer (new format) or just the model (old format)
        if isinstance(pretrained_model, dict) and 'embedding_model' in pretrained_model:
            # New format: model package with transformer
            embedding_model = pretrained_model['embedding_model']
            data_transformer = pretrained_model.get('data_transformer')
            
            if data_transformer is not None:
                logger.info("Using saved data transformer (FAST PATH for pretrained model)")
                # Use the saved transformer - this is much faster!
                real_processed, synth_processed, _, alignment_info = preprocess_data(
                    real_data,
                    synthetic_data,
                    transformer=data_transformer,
                    return_transformer=True,
                    real_headers=real_headers,
                    synthetic_headers=synthetic_headers,
                    alignment_strategy='intersect'
                )
                preprocessing_metadata = {'preprocessing': 'reused_saved_transformer'}
            else:
                logger.info("No transformer in model package, falling back to full preprocessing")
                real_processed, synth_processed, _, alignment_info = preprocess_data(
                    real_data,
                    synthetic_data,
                    return_transformer=True,
                    real_headers=real_headers,
                    synthetic_headers=synthetic_headers,
                    alignment_strategy='intersect'
                )
                preprocessing_metadata = {'preprocessing': 'simplified_categorical_encoding'}
        else:
            # Old format: just the model (backward compatibility)
            logger.info("Old model format detected, using full preprocessing (SLOW PATH)")
            embedding_model = pretrained_model
            real_processed, synth_processed, _, alignment_info = preprocess_data(
                real_data,
                synthetic_data,
                return_transformer=True,
                real_headers=real_headers,
                synthetic_headers=synthetic_headers,
                alignment_strategy='intersect'
            )
            preprocessing_metadata = {'preprocessing': 'simplified_categorical_encoding_legacy'}
        
        # Update pretrained_model reference to point to the actual embedding model
        pretrained_model = embedding_model
        
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
        
        logger.info(f"Transforming data with pre-trained {method.upper()} model...")
        # Transform data using pre-trained model directly (no fine-tuning)
        try:
            # Validate model compatibility
            logger.info(f"Model type: {type(pretrained_model).__name__}")
            logger.info(f"Real data shape: {real_processed.shape}")
            logger.info(f"Synthetic data shape: {synth_processed.shape}")
            
            if method == "umap":
                embedding_real = pretrained_model.transform(real_processed)
                embedding_synth = pretrained_model.transform(synth_processed)
            elif method == "tsne":
                # openTSNE is parametric and supports pretrained transformation
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
            "fine_tuned": False,  # Always False now
            "direct_transformation": True,  # Indicates direct transform was used
            **preprocessing_metadata,
            "alignment": alignment_info
        }
        
        # Store the original pre-trained model
        metadata["model"] = pretrained_model
        
        if progress_callback:
            progress_callback(1.0)
        
        logger.info(f"Direct transformation with pre-trained model completed in {runtime:.2f} seconds")
        
        return embeddings, metadata

    def generate_embedding_with_pretrained_model(
        self,
        real_data: Union[np.ndarray, List[List[Any]], pd.DataFrame],
        synthetic_data: Union[np.ndarray, List[List[Any]], pd.DataFrame],
        method: str = "umap",
        pretrained_model: Any = None,
        params: Dict[str, Any] = None,
        real_headers: List[str] = None,
        synthetic_headers: List[str] = None,
        job_id: str = None,
        progress_callback: Optional[Callable[[float], None]] = None
    ) -> Dict[str, Any]:
        """
        Generate embeddings using a pretrained model from history.
        
        Args:
            real_data: Real dataset
            synthetic_data: Synthetic dataset
            method: Embedding method ('umap' or 'tsne')
            pretrained_model: The pretrained model object
            params: Method-specific parameters
            real_headers: Column headers for real data
            synthetic_headers: Column headers for synthetic data
            job_id: Job ID for tracking
            progress_callback: Optional callback for progress updates
            
        Returns:
            result: Dictionary with embeddings, metadata, and job information
        """
        from utils.logging_config import get_logger
        from services.job_service import JobService
        import time
        
        logger = get_logger(__name__)
        start_time = time.time()
        params = params or {}
        
        if not pretrained_model:
            raise ValueError("Pretrained model is required")
        
        # Report initial progress
        if progress_callback:
            progress_callback(0.1)
        
        # Check if pretrained_model is a package with transformer (new format) or just the model (old format)
        if isinstance(pretrained_model, dict) and 'embedding_model' in pretrained_model:
            # New format: model package with transformer
            embedding_model = pretrained_model['embedding_model']
            data_transformer = pretrained_model.get('data_transformer')
            
            if data_transformer is not None:
                logger.info("Using saved data transformer (FAST PATH for pretrained model)")
                # Use the saved transformer - this is much faster!
                real_processed, synth_processed = preprocess_data(
                    real_data, synthetic_data, transformer=data_transformer
                )
                preprocessing_metadata = {'preprocessing': 'reused_saved_transformer'}
            else:
                logger.info("No transformer in model package, falling back to full preprocessing")
                real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
                preprocessing_metadata = {'preprocessing': 'simplified_categorical_encoding'}
        else:
            # Old format: just the model (backward compatibility)
            logger.info("Old model format detected, using full preprocessing (SLOW PATH)")
            embedding_model = pretrained_model
            real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
            preprocessing_metadata = {'preprocessing': 'simplified_categorical_encoding_legacy'}
        
        # Update pretrained_model reference to point to the actual embedding model
        pretrained_model = embedding_model
        
        # Report preprocessing completion
        if progress_callback:
            progress_callback(0.2)
        
        # Handle sampling parameters
        n_real_samples = params.pop('n_real_samples', None)
        n_synth_samples = params.pop('n_synth_samples', None)
        random_state = params.get('random_state', None)
        
        # Ensure we have valid sample sizes
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
        real_sampled = real_processed[:n_real_samples]
        synth_sampled = synth_processed[:n_synth_samples]
        
        logger.info(f"Using pretrained model for {method} embedding")
        logger.info(f"Real samples: {len(real_sampled)}, Synthetic samples: {len(synth_sampled)}")
        
        # Report sampling completion
        if progress_callback:
            progress_callback(0.3)
        
        try:
            # Use the pretrained model directly (no fine-tuning for UMAP/t-SNE)
            logger.info("Using pretrained model directly for transformation")
            
            if method == "umap":
                real_embedding, synth_embedding = self._transform_with_pretrained_umap(
                    real_sampled, synth_sampled, pretrained_model, progress_callback
                )
            elif method == "tsne":
                real_embedding, synth_embedding = self._transform_with_pretrained_tsne(
                    real_sampled, synth_sampled, pretrained_model, progress_callback
                )
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            # Store results without new model (using original)
            if job_id:
                JobService.update_job_results(
                    job_id=job_id,
                    embedding_real=real_embedding.tolist(),
                    embedding_synthetic=synth_embedding.tolist(),
                    runtime_seconds=time.time() - start_time,
                    preprocessing_info={
                        **preprocessing_metadata,
                        "pretrained_model_used": True,
                        "original_model_type": type(pretrained_model).__name__
                    },
                    real_processed_samples=len(real_sampled),
                    synthetic_processed_samples=len(synth_sampled),
                    model=None  # Don't store a new model since we used the original
                )
            
            # Compress and store data asynchronously
            if job_id:
                JobService.compress_and_store_data_async(
                    job_id=job_id,
                    real_data=real_data,
                    synthetic_data=synthetic_data,
                    real_headers=real_headers,
                    synthetic_headers=synthetic_headers
                )
            
            result = {
                "embeddings": {
                    "real": real_embedding.tolist(),
                    "synthetic": synth_embedding.tolist()
                },
                "metadata": {
                    "method": method,
                    "preprocessing_info": preprocessing_metadata,
                    "real_processed_samples": len(real_sampled),
                    "synthetic_processed_samples": len(synth_sampled),
                    "runtime_seconds": time.time() - start_time,
                    "pretrained_model_used": True
                }
            }
            
            logger.info(f"Successfully generated embeddings using pretrained model in {time.time() - start_time:.2f}s")
            return result
            
        except Exception as e:
            logger.error(f"Error generating embeddings with pretrained model: {e}")
            if job_id:
                JobService.mark_job_failed(job_id, str(e))
            raise

    def _transform_with_pretrained_umap(
        self,
        real_data: np.ndarray,
        synth_data: np.ndarray,
        pretrained_model: Any,
        progress_callback: Optional[Callable[[float], None]] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Transform data using pretrained UMAP model."""
        if progress_callback:
            progress_callback(0.4)
        
        real_embedding = pretrained_model.transform(real_data)
        
        if progress_callback:
            progress_callback(0.7)
        
        synth_embedding = pretrained_model.transform(synth_data)
        
        if progress_callback:
            progress_callback(1.0)
        
        return real_embedding, synth_embedding

    def _transform_with_pretrained_tsne(
        self,
        real_data: np.ndarray,
        synth_data: np.ndarray,
        pretrained_model: Any,
        progress_callback: Optional[Callable[[float], None]] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Transform data using pretrained t-SNE model (openTSNE is parametric)."""
        if progress_callback:
            progress_callback(0.4)
        
        # openTSNE supports parametric transformation
        real_embedding = pretrained_model.transform(real_data)
        
        if progress_callback:
            progress_callback(0.7)
        
        synth_embedding = pretrained_model.transform(synth_data)
        
        if progress_callback:
            progress_callback(1.0)
        
        return real_embedding, synth_embedding 