import pytest
import numpy as np
from unittest.mock import patch, MagicMock
from services.embedding import (
    generate_umap_embedding,
    generate_tsne_embedding,
    prepare_data_for_embedding,
    validate_embedding_data
)

class TestEmbeddingService:
    def test_prepare_data_for_embedding_success(self):
        """Test successful data preparation for embedding"""
        real_data = {
            "headers": ["feature1", "feature2", "feature3"],
            "data": [
                [1.0, 2.0, 3.0],
                [4.0, 5.0, 6.0]
            ]
        }
        
        synthetic_data = {
            "headers": ["feature1", "feature2", "feature3"],
            "data": [
                [1.1, 2.1, 3.1],
                [4.1, 5.1, 6.1]
            ]
        }
        
        real_array, synthetic_array = prepare_data_for_embedding(real_data, synthetic_data)
        
        assert isinstance(real_array, np.ndarray)
        assert isinstance(synthetic_array, np.ndarray)
        assert real_array.shape == (2, 3)
        assert synthetic_array.shape == (2, 3)

    def test_validate_embedding_data_success(self):
        """Test successful data validation"""
        real_data = {
            "headers": ["feature1", "feature2"],
            "data": [[1.0, 2.0], [3.0, 4.0]]
        }
        
        synthetic_data = {
            "headers": ["feature1", "feature2"],
            "data": [[1.1, 2.1], [3.1, 4.1]]
        }
        
        # Should not raise any exception
        validate_embedding_data(real_data, synthetic_data)

    def test_validate_embedding_data_mismatched_headers(self):
        """Test validation with mismatched headers"""
        real_data = {
            "headers": ["feature1", "feature2"],
            "data": [[1.0, 2.0]]
        }
        
        synthetic_data = {
            "headers": ["feature1", "feature3"],  # Different header
            "data": [[1.1, 2.1]]
        }
        
        with pytest.raises(ValueError, match="Headers must match"):
            validate_embedding_data(real_data, synthetic_data)

    @patch('umap.UMAP')
    def test_generate_umap_embedding_success(self, mock_umap_class):
        """Test successful UMAP embedding generation"""
        mock_umap = MagicMock()
        mock_umap_class.return_value = mock_umap
        
        mock_umap.fit_transform.return_value = np.array([
            [0.1, 0.2], [0.3, 0.4], [0.5, 0.6], [0.7, 0.8]
        ])
        
        real_data = {
            "headers": ["feature1", "feature2"],
            "data": [[1.0, 2.0], [3.0, 4.0]]
        }
        
        synthetic_data = {
            "headers": ["feature1", "feature2"],
            "data": [[1.1, 2.1], [3.1, 4.1]]
        }
        
        result = generate_umap_embedding(real_data, synthetic_data)
        
        assert "real_embeddings" in result
        assert "synthetic_embeddings" in result
        assert "metadata" in result
        assert result["metadata"]["method"] == "umap" 