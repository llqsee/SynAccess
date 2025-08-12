import pytest
import numpy as np
from unittest.mock import patch, MagicMock
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from backend.services.embedding import EmbeddingService

class TestEmbeddingService:
    def setup_method(self):
        """Set up test fixtures"""
        self.embedding_service = EmbeddingService()

    def test_compute_embedding_umap_success(self):
        """Test successful UMAP embedding computation"""
        # Create larger datasets that work with UMAP (minimum 10 samples recommended)
        real_data = [
            [1.0, 2.0, 3.0, 4.0, 5.0],
            [2.0, 3.0, 4.0, 5.0, 6.0],
            [3.0, 4.0, 5.0, 6.0, 7.0],
            [4.0, 5.0, 6.0, 7.0, 8.0],
            [5.0, 6.0, 7.0, 8.0, 9.0],
            [6.0, 7.0, 8.0, 9.0, 10.0],
            [7.0, 8.0, 9.0, 10.0, 11.0],
            [8.0, 9.0, 10.0, 11.0, 12.0],
            [9.0, 10.0, 11.0, 12.0, 13.0],
            [10.0, 11.0, 12.0, 13.0, 14.0]
        ]

        synthetic_data = [
            [1.1, 2.1, 3.1, 4.1, 5.1],
            [2.1, 3.1, 4.1, 5.1, 6.1],
            [3.1, 4.1, 5.1, 6.1, 7.1],
            [4.1, 5.1, 6.1, 7.1, 8.1],
            [5.1, 6.1, 7.1, 8.1, 9.1],
            [6.1, 7.1, 8.1, 9.1, 10.1],
            [7.1, 8.1, 9.1, 10.1, 11.1],
            [8.1, 9.1, 10.1, 11.1, 12.1],
            [9.1, 10.1, 11.1, 12.1, 13.1],
            [10.1, 11.1, 12.1, 13.1, 14.1]
        ]

        embeddings, metadata = self.embedding_service.compute_embedding(
            real_data=real_data,
            synthetic_data=synthetic_data,
            method="umap"
        )

        # Verify structure
        assert isinstance(embeddings, dict)
        assert "real" in embeddings
        assert "synthetic" in embeddings
        assert isinstance(metadata, dict)
        assert "method" in metadata
        assert "runtime" in metadata

        # Verify dimensions
        assert len(embeddings["real"]) == 10  # Number of real samples
        assert len(embeddings["synthetic"]) == 10  # Number of synthetic samples
        assert len(embeddings["real"][0]) == 2  # 2D embedding
        assert len(embeddings["synthetic"][0]) == 2  # 2D embedding

        # Verify metadata
        assert metadata["method"] == "umap"
        assert metadata["runtime"] > 0

    def test_compute_embedding_tsne_success(self):
        """Test successful t-SNE embedding computation"""
        # Create datasets suitable for t-SNE
        real_data = [
            [1.0, 2.0, 3.0],
            [4.0, 5.0, 6.0],
            [7.0, 8.0, 9.0],
            [10.0, 11.0, 12.0],
            [13.0, 14.0, 15.0]
        ]

        synthetic_data = [
            [1.1, 2.1, 3.1],
            [4.1, 5.1, 6.1],
            [7.1, 8.1, 9.1],
            [10.1, 11.1, 12.1],
            [13.1, 14.1, 15.1]
        ]

        embeddings, metadata = self.embedding_service.compute_embedding(
            real_data=real_data,
            synthetic_data=synthetic_data,
            method="tsne"
        )

        # Verify structure
        assert isinstance(embeddings, dict)
        assert "real" in embeddings
        assert "synthetic" in embeddings
        assert isinstance(metadata, dict)
        assert "method" in metadata
        assert "runtime" in metadata

        # Verify dimensions
        assert len(embeddings["real"]) == 5
        assert len(embeddings["synthetic"]) == 5
        assert len(embeddings["real"][0]) == 2
        assert len(embeddings["synthetic"][0]) == 2

        # Verify metadata
        assert metadata["method"] == "tsne"
        assert metadata["runtime"] > 0

    def test_compute_embedding_with_params(self):
        """Test embedding with custom parameters"""
        # Use larger dataset for UMAP with custom parameters
        real_data = [[float(i), float(i+1), float(i+2)] for i in range(15)]
        synthetic_data = [[float(i+0.1), float(i+1.1), float(i+2.1)] for i in range(15)]

        params = {
            "n_neighbors": 5,  # Reduced for smaller dataset
            "min_dist": 0.2,
            "random_state": 42
        }

        embeddings, metadata = self.embedding_service.compute_embedding(
            real_data=real_data,
            synthetic_data=synthetic_data,
            method="umap",
            params=params
        )

        # Verify structure and parameters
        assert isinstance(embeddings, dict)
        assert "real" in embeddings
        assert "synthetic" in embeddings
        assert len(embeddings["real"]) == 15
        assert len(embeddings["synthetic"]) == 15

        # Verify metadata includes custom parameters
        assert metadata["method"] == "umap"
        assert "params" in metadata
        assert metadata["params"]["n_neighbors"] == 5
        assert metadata["params"]["min_dist"] == 0.2

    def test_compute_embedding_invalid_method(self):
        """Test embedding with invalid method"""
        real_data = [[1.0, 2.0], [3.0, 4.0]]
        synthetic_data = [[1.1, 2.1], [3.1, 4.1]]

        with pytest.raises(ValueError, match="Unsupported method"):
            self.embedding_service.compute_embedding(
                real_data=real_data,
                synthetic_data=synthetic_data,
                method="invalid_method"
            )

    def test_compute_embedding_empty_data(self):
        """Test embedding with empty data"""
        with pytest.raises(ValueError):
            self.embedding_service.compute_embedding(
                real_data=[],
                synthetic_data=[],
                method="umap"
            ) 