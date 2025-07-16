import pytest
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

class TestEmbedRoutes:
    def test_compute_embedding_umap_success(self, client):
        """Test successful UMAP embedding computation"""
        with patch('routes.embed.embedding_service.compute_embedding') as mock_compute, \
             patch('routes.embed.JobService.create_job') as mock_create_job, \
             patch('routes.embed.JobService.update_job_results') as mock_update_job:

            mock_create_job.return_value = {"job_id": "test-job-id"}
            mock_compute.return_value = (
                {
                    "real": [[0.1, 0.2], [0.3, 0.4]],
                    "synthetic": [[0.11, 0.21], [0.31, 0.41]]
                },
                {
                    "method": "umap",
                    "runtime": 1.5,
                    "params": {"n_neighbors": 15}
                }
            )

            response = client.post("/api/v1/embed", json={
                "real_data": [[1.0, 2.0], [3.0, 4.0]],
                "synthetic_data": [[1.1, 2.1], [3.1, 4.1]],
                "method": "umap",
                "params": {"n_neighbors": 15}
            })

            assert response.status_code == 200
            data = response.json()
            
            assert "embeddings" in data
            assert "metadata" in data
            assert data["embeddings"]["real"] == [[0.1, 0.2], [0.3, 0.4]]
            assert data["embeddings"]["synthetic"] == [[0.11, 0.21], [0.31, 0.41]]
            assert data["metadata"]["method"] == "umap"
            assert data["metadata"]["runtime"] == 1.5

    def test_compute_embedding_tsne_success(self, client):
        """Test successful t-SNE embedding computation"""
        with patch('routes.embed.embedding_service.compute_embedding') as mock_compute, \
             patch('routes.embed.JobService.create_job') as mock_create_job, \
             patch('routes.embed.JobService.update_job_results') as mock_update_job:

            mock_create_job.return_value = {"job_id": "test-job-id"}
            mock_compute.return_value = (
                {
                    "real": [[0.1, 0.2], [0.3, 0.4]],
                    "synthetic": [[0.11, 0.21], [0.31, 0.41]]
                },
                {
                    "method": "tsne",
                    "runtime": 2.5,
                    "params": {"perplexity": 30}
                }
            )

            response = client.post("/api/v1/embed", json={
                "real_data": [[1.0, 2.0], [3.0, 4.0]],
                "synthetic_data": [[1.1, 2.1], [3.1, 4.1]],
                "method": "tsne",
                "params": {"perplexity": 30}
            })

            assert response.status_code == 200
            data = response.json()
            
            assert "embeddings" in data
            assert "metadata" in data
            assert data["embeddings"]["real"] == [[0.1, 0.2], [0.3, 0.4]]
            assert data["embeddings"]["synthetic"] == [[0.11, 0.21], [0.31, 0.41]]
            assert data["metadata"]["method"] == "tsne"
            assert data["metadata"]["runtime"] == 2.5

    def test_compute_embedding_invalid_method(self, client):
        """Test embedding computation with invalid method"""
        response = client.post("/api/v1/embed", json={
            "real_data": [[1.0, 2.0], [3.0, 4.0]],
            "synthetic_data": [[1.1, 2.1], [3.1, 4.1]],
            "method": "invalid_method"
        })

        assert response.status_code == 400

    def test_compute_embedding_with_headers(self, client):
        """Test embedding computation with column headers"""
        with patch('routes.embed.embedding_service.compute_embedding') as mock_compute, \
             patch('routes.embed.JobService.create_job') as mock_create_job, \
             patch('routes.embed.JobService.update_job_results') as mock_update_job:

            mock_create_job.return_value = {"job_id": "test-job-id"}
            mock_compute.return_value = (
                {
                    "real": [[0.1, 0.2], [0.3, 0.4]],
                    "synthetic": [[0.11, 0.21], [0.31, 0.41]]
                },
                {
                    "method": "umap",
                    "runtime": 1.5
                }
            )

            response = client.post("/api/v1/embed", json={
                "real_data": [[1.0, 2.0], [3.0, 4.0]],
                "synthetic_data": [[1.1, 2.1], [3.1, 4.1]],
                "method": "umap",
                "real_headers": ["feature1", "feature2"],
                "synthetic_headers": ["feature1", "feature2"]
            })

            assert response.status_code == 200
            data = response.json()
            assert "embeddings" in data
            assert "metadata" in data

    def test_compute_embedding_service_error(self, client):
        """Test embedding computation when service throws error"""
        with patch('routes.embed.embedding_service.compute_embedding') as mock_compute, \
             patch('routes.embed.JobService.create_job') as mock_create_job, \
             patch('routes.embed.JobService.mark_job_failed') as mock_mark_failed:

            mock_create_job.return_value = {"job_id": "test-job-id"}
            mock_compute.side_effect = ValueError("Invalid parameters")

            response = client.post("/api/v1/embed", json={
                "real_data": [[1.0, 2.0], [3.0, 4.0]],
                "synthetic_data": [[1.1, 2.1], [3.1, 4.1]],
                "method": "umap"
            })

            assert response.status_code == 400
            assert "Invalid parameters" in response.json()["detail"] 