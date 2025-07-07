import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

class TestHistoryRoutes:
    def test_get_job_history_success(self, client):
        """Test successful job history retrieval"""
        mock_jobs = [
            {
                "id": 1,
                "method": "umap",
                "status": "completed",
                "created_at": datetime.now(),
                "completed_at": datetime.now(),
                "runtime": 15.5,
                "is_favorite": False
            },
            {
                "id": 2,
                "method": "tsne",
                "status": "running",
                "created_at": datetime.now(),
                "completed_at": None,
                "runtime": None,
                "is_favorite": True
            }
        ]
        
        with patch('services.job_service.JobService.get_jobs') as mock_get_jobs:
            mock_get_jobs.return_value = {
                "jobs": mock_jobs,
                "total": 2,
                "page": 1,
                "per_page": 10
            }
            
            response = client.get("/history")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "jobs" in data
            assert "total" in data
            assert len(data["jobs"]) == 2
            assert data["total"] == 2

    def test_get_job_history_with_filters(self, client):
        """Test job history retrieval with filters"""
        with patch('services.job_service.JobService.get_jobs') as mock_get_jobs:
            mock_get_jobs.return_value = {
                "jobs": [],
                "total": 0,
                "page": 1,
                "per_page": 10
            }
            
            response = client.get("/history", params={
                "status": "completed",
                "method": "umap",
                "is_favorite": True,
                "page": 2,
                "per_page": 5
            })
            
            assert response.status_code == 200
            mock_get_jobs.assert_called_once()
            
            # Check that filters were passed to service
            call_args = mock_get_jobs.call_args[1]
            assert call_args["status"] == "completed"
            assert call_args["method"] == "umap"
            assert call_args["is_favorite"] is True
            assert call_args["page"] == 2
            assert call_args["per_page"] == 5

    def test_get_job_history_with_search(self, client):
        """Test job history retrieval with search"""
        with patch('services.job_service.JobService.get_jobs') as mock_get_jobs:
            mock_get_jobs.return_value = {
                "jobs": [],
                "total": 0,
                "page": 1,
                "per_page": 10
            }
            
            response = client.get("/history", params={
                "search": "test_job",
                "sort_by": "created_at",
                "order": "desc"
            })
            
            assert response.status_code == 200
            call_args = mock_get_jobs.call_args[1]
            assert call_args["search"] == "test_job"
            assert call_args["sort_by"] == "created_at"
            assert call_args["order"] == "desc"

    def test_get_job_detail_success(self, client):
        """Test successful job detail retrieval"""
        mock_job = {
            "id": 1,
            "method": "umap",
            "status": "completed",
            "created_at": datetime.now(),
            "completed_at": datetime.now(),
            "runtime": 15.5,
            "is_favorite": False,
            "error_message": None,
            "parameters": {"n_neighbors": 15}
        }
        
        with patch('services.job_service.JobService.get_job') as mock_get_job:
            mock_get_job.return_value = mock_job
            
            response = client.get("/jobs/1")
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == 1
            assert data["method"] == "umap"
            assert data["status"] == "completed"

    def test_get_job_detail_not_found(self, client):
        """Test job detail retrieval for non-existent job"""
        with patch('services.job_service.JobService.get_job') as mock_get_job:
            mock_get_job.return_value = None
            
            response = client.get("/jobs/999")
            
            assert response.status_code == 404
            assert "Job not found" in response.json()["detail"]

    def test_load_job_embeddings_success(self, client):
        """Test successful job embeddings loading"""
        mock_embeddings = {
            "real": [[0.1, 0.2], [0.3, 0.4]],
            "synthetic": [[0.5, 0.6], [0.7, 0.8]]
        }
        mock_metadata = {
            "method": "umap",
            "runtime": 15.5,
            "job_id": 1
        }
        
        with patch('services.job_service.JobService.load_embeddings') as mock_load:
            mock_load.return_value = {
                "embeddings": mock_embeddings,
                "metadata": mock_metadata
            }
            
            response = client.post("/jobs/1/load")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "embeddings" in data
            assert "metadata" in data
            assert data["metadata"]["job_id"] == 1

    def test_load_job_embeddings_not_found(self, client):
        """Test loading embeddings for non-existent job"""
        with patch('services.job_service.JobService.load_embeddings') as mock_load:
            mock_load.side_effect = Exception("Job not found")
            
            response = client.post("/jobs/999/load")
            
            assert response.status_code == 404

    def test_toggle_job_favorite_success(self, client):
        """Test successful job favorite toggle"""
        with patch('services.job_service.JobService.toggle_favorite') as mock_toggle:
            mock_toggle.return_value = {"is_favorite": True}
            
            response = client.post("/jobs/1/favorite")
            
            assert response.status_code == 200
            data = response.json()
            assert data["is_favorite"] is True

    def test_toggle_job_favorite_not_found(self, client):
        """Test favorite toggle for non-existent job"""
        with patch('services.job_service.JobService.toggle_favorite') as mock_toggle:
            mock_toggle.side_effect = Exception("Job not found")
            
            response = client.post("/jobs/999/favorite")
            
            assert response.status_code == 404

    def test_delete_job_success(self, client):
        """Test successful job deletion"""
        with patch('services.job_service.JobService.delete_job') as mock_delete:
            mock_delete.return_value = True
            
            response = client.delete("/jobs/1")
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    def test_delete_job_not_found(self, client):
        """Test deletion of non-existent job"""
        with patch('services.job_service.JobService.delete_job') as mock_delete:
            mock_delete.return_value = False
            
            response = client.delete("/jobs/999")
            
            assert response.status_code == 404

    def test_get_job_stats_success(self, client):
        """Test successful job statistics retrieval"""
        mock_stats = {
            "total_jobs": 10,
            "completed_jobs": 7,
            "running_jobs": 2,
            "failed_jobs": 1,
            "avg_runtime": 25.5,
            "methods": {
                "umap": 6,
                "tsne": 4
            },
            "recent_activity": []
        }
        
        with patch('services.job_service.JobService.get_job_stats') as mock_stats_func:
            mock_stats_func.return_value = mock_stats
            
            response = client.get("/stats")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["total_jobs"] == 10
            assert data["completed_jobs"] == 7
            assert data["avg_runtime"] == 25.5
            assert "methods" in data

    def test_get_job_stats_error(self, client):
        """Test job statistics with service error"""
        with patch('services.job_service.JobService.get_job_stats') as mock_stats:
            mock_stats.side_effect = Exception("Database error")
            
            response = client.get("/stats")
            
            assert response.status_code == 500

    def test_pagination_validation(self, client):
        """Test pagination parameter validation"""
        with patch('services.job_service.JobService.get_jobs') as mock_get_jobs:
            mock_get_jobs.return_value = {
                "jobs": [],
                "total": 0,
                "page": 1,
                "per_page": 10
            }
            
            # Test invalid page (negative)
            response = client.get("/history", params={"page": -1})
            assert response.status_code == 422
            
            # Test invalid per_page (too large)
            response = client.get("/history", params={"per_page": 1001})
            assert response.status_code == 422

    def test_get_job_history_empty_result(self, client):
        """Test job history when no jobs exist"""
        with patch('services.job_service.JobService.get_jobs') as mock_get_jobs:
            mock_get_jobs.return_value = {
                "jobs": [],
                "total": 0,
                "page": 1,
                "per_page": 10
            }
            
            response = client.get("/history")
            
            assert response.status_code == 200
            data = response.json()
            assert data["jobs"] == []
            assert data["total"] == 0

    def test_filter_validation(self, client):
        """Test filter parameter validation"""
        with patch('services.job_service.JobService.get_jobs') as mock_get_jobs:
            mock_get_jobs.return_value = {
                "jobs": [],
                "total": 0,
                "page": 1,
                "per_page": 10
            }
            
            # Test invalid status
            response = client.get("/history", params={"status": "invalid_status"})
            assert response.status_code == 422
            
            # Test invalid method
            response = client.get("/history", params={"method": "invalid_method"})
            assert response.status_code == 422 