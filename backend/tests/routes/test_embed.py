import pytest
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

class TestEmbedRoutes:
    def test_generate_embedding_success(self, client, sample_data, mock_embedding_result):
        """Test successful embedding generation"""
        with patch('services.embedding.generate_umap_embedding') as mock_umap:
            mock_umap.return_value = mock_embedding_result
            
            response = client.post("/embed", json={
                **sample_data,
                "method": "umap"
            })
            
            assert response.status_code == 200
            data = response.json()
            
            assert "real_embeddings" in data
            assert "synthetic_embeddings" in data
            assert "metadata" in data
            assert data["metadata"]["method"] == "umap"

    def test_generate_embedding_invalid_method(self, client, sample_data):
        """Test embedding generation with invalid method"""
        response = client.post("/embed", json={
            **sample_data,
            "method": "invalid_method"
        })
        
        assert response.status_code == 400
        assert "Invalid embedding method" in response.json()["detail"]

    def test_generate_embedding_mismatched_headers(self, client):
        """Test embedding generation with mismatched headers"""
        response = client.post("/embed", json={
            "real_data": {
                "headers": ["feature1", "feature2"],
                "data": [[1.0, 2.0], [3.0, 4.0]]
            },
            "synthetic_data": {
                "headers": ["feature1", "feature3"],  # Different header
                "data": [[1.1, 2.1], [3.1, 4.1]]
            },
            "method": "umap"
        })
        
        assert response.status_code == 400
        assert "Headers must match" in response.json()["detail"]

    def test_generate_embedding_service_error(self, client, sample_data):
        """Test embedding generation when service throws error"""
        with patch('services.embedding.generate_umap_embedding') as mock_umap:
            mock_umap.side_effect = Exception("Embedding computation failed")
            
            response = client.post("/embed", json={
                **sample_data,
                "method": "umap"
            })
            
            assert response.status_code == 500
            assert "Error generating embedding" in response.json()["detail"] 