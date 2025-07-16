import pytest
import pandas as pd
import numpy as np
from utils.data_preprocessing import preprocess_data
from utils.validation import validate_embedding_params

class TestDataPreprocessing:
    def test_preprocess_data_numeric_only(self):
        """Test preprocessing with only numeric data"""
        real_data = [
            [1.0, 2.0, 3.0],
            [4.0, 5.0, 6.0]
        ]
        
        synthetic_data = [
            [1.1, 2.1, 3.1],
            [4.1, 5.1, 6.1]
        ]
        
        real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
        
        assert isinstance(real_processed, np.ndarray)
        assert isinstance(synth_processed, np.ndarray)
        assert real_processed.shape == (2, 3)
        assert synth_processed.shape == (2, 3)
        assert real_processed.dtype == np.float32
        assert synth_processed.dtype == np.float32

    def test_preprocess_data_with_categorical(self):
        """Test preprocessing with categorical data"""
        real_data = [
            ['A', 1.0, 2.0],
            ['B', 3.0, 4.0],
            ['A', 5.0, 6.0]
        ]
        
        synthetic_data = [
            ['A', 1.1, 2.1],
            ['B', 3.1, 4.1],
            ['A', 5.1, 6.1]
        ]
        
        real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
        
        assert isinstance(real_processed, np.ndarray)
        assert isinstance(synth_processed, np.ndarray)
        # Should have more columns due to one-hot encoding (A->0, B->1, plus 2 numeric)
        assert real_processed.shape[1] >= 3  # At least original columns
        assert synth_processed.shape[1] >= 3
        assert real_processed.dtype == np.float32
        assert synth_processed.dtype == np.float32

    def test_preprocess_data_mixed_types(self):
        """Test preprocessing with mixed data types"""
        real_data = [
            ['category1', 1, 2.5],
            ['category2', 2, 3.5],
            ['category1', 3, 4.5]
        ]
        
        synthetic_data = [
            ['category1', 1, 2.6],
            ['category2', 2, 3.6],
            ['category1', 3, 4.6]
        ]
        
        real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
        
        assert isinstance(real_processed, np.ndarray)
        assert isinstance(synth_processed, np.ndarray)
        assert real_processed.shape[0] == 3
        assert synth_processed.shape[0] == 3
        assert real_processed.dtype == np.float32
        assert synth_processed.dtype == np.float32

class TestValidation:
    def test_validate_embedding_params_umap_valid(self):
        """Test valid UMAP parameters"""
        params = {
            "n_neighbors": 15,
            "min_dist": 0.1,
            "n_components": 2,
            "random_state": 42
        }
        
        # Should not raise any exception
        validate_embedding_params("umap", params)

    def test_validate_embedding_params_tsne_valid(self):
        """Test valid t-SNE parameters"""
        params = {
            "perplexity": 30,
            "early_exaggeration": 12.0,
            "n_components": 2,
            "random_state": 42
        }
        
        # Should not raise any exception
        validate_embedding_params("tsne", params)

    def test_validate_embedding_params_invalid_method(self):
        """Test validation with invalid method"""
        params = {"n_neighbors": 15}
        
        with pytest.raises(ValueError, match="Unsupported method"):
            validate_embedding_params("invalid", params)

    def test_validate_embedding_params_invalid_umap_params(self):
        """Test validation with invalid UMAP parameters"""
        params = {
            "invalid_param": 15,
            "n_neighbors": 10
        }
        
        with pytest.raises(ValueError, match="Invalid parameters for umap"):
            validate_embedding_params("umap", params)

    def test_validate_embedding_params_invalid_tsne_params(self):
        """Test validation with invalid t-SNE parameters"""
        params = {
            "invalid_param": 30,
            "perplexity": 20
        }
        
        with pytest.raises(ValueError, match="Invalid parameters for tsne"):
            validate_embedding_params("tsne", params) 