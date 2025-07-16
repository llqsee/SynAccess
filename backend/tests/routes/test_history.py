import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

class TestHistoryRoutes:
    def test_get_job_history_success(self, client):
        """Test successful job history retrieval"""
        mock_jobs = [
            {
                "job_id": "job-1",
                "name": "Test Job 1",
                "method": "umap",
                "status": "completed",
                "created_at": datetime.now(),
                "runtime_seconds": 15.5,
                "is_favorite": False
            },
            {
                "job_id": "job-2", 
                "name": "Test Job 2",
                "method": "tsne",
                "status": "running",
                "created_at": datetime.now(),
                "runtime_seconds": None,
                "is_favorite": True
            }
        ]
        
        with patch('routes.history.JobService.get_job_history') as mock_get_jobs:
            mock_get_jobs.return_value = (mock_jobs, 2)
            
            response = client.get("/api/v1/history")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "jobs" in data
            assert "total" in data
            assert "page" in data
            assert "limit" in data
            assert len(data["jobs"]) == 2
            assert data["total"] == 2

    def test_get_job_history_with_filters(self, client):
        """Test job history retrieval with filters"""
        with patch('routes.history.JobService.get_job_history') as mock_get_jobs:
            mock_get_jobs.return_value = ([], 0)
            
            response = client.get("/api/v1/history", params={
                "status": "completed",
                "method": "umap",
                "favorites_only": True,
                "page": 2,
                "limit": 5
            })
            
            assert response.status_code == 200
            mock_get_jobs.assert_called_once_with(
                limit=5,
                offset=5,  # (page-1) * limit = (2-1) * 5 = 5
                status_filter="completed",
                method_filter="umap",
                favorites_only=True
            )

    def test_get_job_detail_success(self, client):
        """Test successful job detail retrieval"""
        mock_job = {
            "job_id": "job-1",
            "name": "Test Job",
            "method": "umap",
            "status": "completed",
            "created_at": datetime.now(),
            "runtime_seconds": 15.5,
            "is_favorite": False,
            "error_message": None,
            "parameters": {"n_neighbors": 15},
            "embedding_real": [[0.1, 0.2]],
            "embedding_synthetic": [[0.3, 0.4]]
        }
        
        mock_tags = ["important", "demo"]
        
        with patch('routes.history.JobService.get_job_by_id') as mock_get_job, \
             patch('routes.history.JobService.get_job_tags') as mock_get_tags:
            
            mock_get_job.return_value = mock_job
            mock_get_tags.return_value = mock_tags
            
            response = client.get("/api/v1/jobs/job-1")
            
            assert response.status_code == 200
            data = response.json()
            assert data["job"]["job_id"] == "job-1"
            assert data["job"]["method"] == "umap"
            assert data["tags"] == mock_tags
            mock_get_job.assert_called_once_with("job-1", include_embeddings=True)

    def test_get_job_detail_not_found(self, client):
        """Test job detail retrieval for non-existent job"""
        with patch('routes.history.JobService.get_job_by_id') as mock_get_job:
            mock_get_job.return_value = None
            
            response = client.get("/api/v1/jobs/nonexistent")
            
            assert response.status_code == 404
            assert "Job not found" in response.json()["detail"]

    def test_load_job_embeddings_success(self, client):
        """Test successful job embeddings loading"""
        mock_job = {
            "job_id": "job-1",
            "name": "Test Job",
            "method": "umap",
            "status": "completed",
            "runtime_seconds": 15.5,
            "parameters": {"n_neighbors": 15},
            "real_data_shape": [100, 5],
            "synthetic_data_shape": [100, 5],
            "preprocessing_info": {"method": "one_hot"},
            "embedding_real": [[0.1, 0.2], [0.3, 0.4]],
            "embedding_synthetic": [[0.5, 0.6], [0.7, 0.8]],
            "created_at": datetime.now()
        }
        
        with patch('routes.history.JobService.get_job_by_id') as mock_get_job:
            mock_get_job.return_value = mock_job
            
            response = client.post("/api/v1/jobs/job-1/load")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "embeddings" in data
            assert "metadata" in data
            assert "real" in data["embeddings"]
            assert "synthetic" in data["embeddings"]
            assert data["metadata"]["job_id"] == "job-1"
            assert data["metadata"]["method"] == "umap"

    def test_load_job_embeddings_not_found(self, client):
        """Test loading embeddings for non-existent job"""
        with patch('routes.history.JobService.get_job_by_id') as mock_get_job:
            mock_get_job.return_value = None
            
            response = client.post("/api/v1/jobs/nonexistent/load")
            
            assert response.status_code == 404

    def test_load_job_embeddings_not_completed(self, client):
        """Test loading embeddings for incomplete job"""
        mock_job = {
            "job_id": "job-1",
            "status": "running",
            "embedding_real": None,
            "embedding_synthetic": None
        }
        
        with patch('routes.history.JobService.get_job_by_id') as mock_get_job:
            mock_get_job.return_value = mock_job
            
            response = client.post("/api/v1/jobs/job-1/load")
            
            assert response.status_code == 400
            assert "not completed" in response.json()["detail"]

    def test_toggle_job_favorite_success(self, client):
        """Test successful job favorite toggle"""
        with patch('routes.history.JobService.toggle_favorite') as mock_toggle:
            mock_toggle.return_value = True
            
            response = client.post("/api/v1/jobs/job-1/favorite")
            
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "toggled successfully" in data["message"]

    def test_toggle_job_favorite_not_found(self, client):
        """Test favorite toggle for non-existent job"""
        with patch('routes.history.JobService.toggle_favorite') as mock_toggle:
            mock_toggle.return_value = False
            
            response = client.post("/api/v1/nonexistent/favorite")
            
            assert response.status_code == 404

    def test_delete_job_success(self, client):
        """Test successful job deletion"""
        with patch('routes.history.JobService.delete_job') as mock_delete:
            mock_delete.return_value = True
            
            response = client.delete("/api/v1/jobs/job-1")
            
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "deleted successfully" in data["message"]

    def test_delete_job_not_found(self, client):
        """Test job deletion for non-existent job"""
        with patch('routes.history.JobService.delete_job') as mock_delete:
            mock_delete.return_value = False
            
            response = client.delete("/api/v1/nonexistent")
            
            assert response.status_code == 404

    def test_get_job_stats_success(self, client):
        """Test successful job statistics retrieval"""
        mock_stats = {
            "total_jobs": 10,
            "completed_jobs": 8,
            "failed_jobs": 1,
            "running_jobs": 1
        }
        
        with patch('routes.history.JobService.get_job_stats') as mock_get_stats:
            mock_get_stats.return_value = mock_stats
            
            response = client.get("/api/v1/stats")
            
            assert response.status_code == 200
            data = response.json()
            assert data["total_jobs"] == 10
            assert data["completed_jobs"] == 8

    def test_add_job_tag_success(self, client):
        """Test successful job tag addition"""
        with patch('routes.history.JobService.add_job_tag') as mock_add_tag:
            mock_add_tag.return_value = True
            
            response = client.post("/api/v1/jobs/job-1/tags", json={"tag": "important"})
            
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "added successfully" in data["message"]

    def test_get_job_tags_success(self, client):
        """Test successful job tags retrieval"""
        mock_tags = ["important", "demo", "test"]
        
        with patch('routes.history.JobService.get_job_tags') as mock_get_tags:
            mock_get_tags.return_value = mock_tags
            
            response = client.get("/api/v1/jobs/job-1/tags")
            
            assert response.status_code == 200
            data = response.json()
            assert "tags" in data
            assert data["tags"] == mock_tags

    def test_cleanup_stuck_jobs_success(self, client):
        """Test successful stuck jobs cleanup"""
        with patch('routes.history.JobService.cleanup_stuck_jobs') as mock_cleanup:
            mock_cleanup.return_value = 3
            
            response = client.post("/api/v1/cleanup")
            
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "3" in data["message"] 