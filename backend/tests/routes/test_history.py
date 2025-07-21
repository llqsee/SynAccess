import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
import json

class TestHistoryRoutes:
    def test_get_job_history_success(self, client):
        """Test successful job history retrieval"""
        # Create mock job objects that match the database model
        mock_jobs = [
            MagicMock(
                job_id="job-1",
                name="Test Job 1",
                method="umap",
                status="completed",
                created_at=datetime.now(),
                runtime_seconds=15.5,
                error_message=None,
                parameters='{"n_neighbors": 15}',
                has_results=True,
                has_compressed_data=True
            ),
            MagicMock(
                job_id="job-2", 
                name="Test Job 2",
                method="tsne",
                status="running",
                created_at=datetime.now(),
                runtime_seconds=None,
                error_message=None,
                parameters='{"perplexity": 30}',
                has_results=False,
                has_compressed_data=False
            )
        ]
        
        with patch('routes.history.JobService.get_jobs') as mock_get_jobs, \
             patch('routes.history.JobService.get_job_count') as mock_get_count, \
             patch('routes.history.JobService.get_job_results') as mock_get_results:
            
            mock_get_jobs.return_value = mock_jobs
            mock_get_count.return_value = 2
            mock_get_results.return_value = {
                "real_processed_samples": 100,
                "synthetic_processed_samples": 100
            }
            
            response = client.get("/api/v1/history")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "jobs" in data
            assert "total_count" in data
            assert "limit" in data
            assert "offset" in data
            assert len(data["jobs"]) == 2
            assert data["total_count"] == 2

    def test_get_job_history_with_filters(self, client):
        """Test job history retrieval with filters"""
        with patch('routes.history.JobService.get_jobs') as mock_get_jobs, \
             patch('routes.history.JobService.get_job_count') as mock_get_count:
            
            mock_get_jobs.return_value = []
            mock_get_count.return_value = 0
            
            response = client.get("/api/v1/history", params={
                "status": "completed",
                "method": "umap",
                "limit": 5,
                "offset": 5
            })
            
            assert response.status_code == 200
            mock_get_jobs.assert_called_once_with(
                limit=5,
                offset=5,
                status="completed",
                method="umap",
                date_from=None,
                date_to=None
            )

    def test_get_job_detail_success(self, client):
        """Test successful job detail retrieval"""
        mock_job = MagicMock(
            job_id="job-1",
            name="Test Job",
            method="umap",
            status="completed",
            created_at=datetime.now(),
            runtime_seconds=15.5,
            error_message=None,
            parameters='{"n_neighbors": 15}',
            has_results=True,
            has_compressed_data=True
        )
        
        mock_results = {
            "embedding_real": [[0.1, 0.2]],
            "embedding_synthetic": [[0.3, 0.4]],
            "preprocessing_info": {"method": "standard"},
            "real_processed_samples": 100,
            "synthetic_processed_samples": 100
        }
        
        mock_compressed_data = {
            "real_data": [[1, 2], [3, 4]],
            "synthetic_data": [[5, 6], [7, 8]],
            "real_headers": ["col1", "col2"],
            "synthetic_headers": ["col1", "col2"]
        }
        
        with patch('routes.history.JobService.get_job') as mock_get_job, \
             patch('routes.history.JobService.get_job_results') as mock_get_results, \
             patch('routes.history.JobService.get_compressed_data') as mock_get_compressed:
            
            mock_get_job.return_value = mock_job
            mock_get_results.return_value = mock_results
            mock_get_compressed.return_value = mock_compressed_data
            
            response = client.get("/api/v1/history/job-1")
            
            assert response.status_code == 200
            data = response.json()
            assert data["job_id"] == "job-1"
            assert data["method"] == "umap"
            assert "results" in data
            assert "compressed_data" in data

    def test_get_job_detail_not_found(self, client):
        """Test job detail retrieval for non-existent job"""
        with patch('routes.history.JobService.get_job') as mock_get_job:
            mock_get_job.return_value = None
            
            response = client.get("/api/v1/history/nonexistent")
            
            assert response.status_code == 404
            assert "Job not found" in response.json()["detail"]

    def test_load_job_embeddings_success(self, client):
        """Test successful job embeddings loading"""
        mock_job = MagicMock(
            job_id="job-1",
            name="Test Job",
            method="umap",
            status="completed",
            runtime_seconds=15.5,
            parameters='{"n_neighbors": 15}',
            created_at=datetime.now(),
            has_results=True,
            has_compressed_data=True
        )
        
        mock_results = {
            "embedding_real": [[0.1, 0.2], [0.3, 0.4]],
            "embedding_synthetic": [[0.5, 0.6], [0.7, 0.8]],
            "preprocessing_info": {"method": "standard"},
            "real_processed_samples": 100,
            "synthetic_processed_samples": 100
        }
        
        mock_compressed_data = {
            "real_data": [[1, 2], [3, 4]],
            "synthetic_data": [[5, 6], [7, 8]],
            "real_headers": ["col1", "col2"],
            "synthetic_headers": ["col1", "col2"]
        }
        
        with patch('routes.history.JobService.get_job') as mock_get_job, \
             patch('routes.history.JobService.get_job_results') as mock_get_results, \
             patch('routes.history.JobService.get_compressed_data') as mock_get_compressed:
            
            mock_get_job.return_value = mock_job
            mock_get_results.return_value = mock_results
            mock_get_compressed.return_value = mock_compressed_data
            
            response = client.post("/api/v1/jobs/job-1/load")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "embeddings" in data
            assert "metadata" in data
            assert "session_state" in data
            assert "real" in data["embeddings"]
            assert "synthetic" in data["embeddings"]
            assert data["metadata"]["job_id"] == "job-1"
            assert data["metadata"]["method"] == "umap"

    def test_load_job_embeddings_not_found(self, client):
        """Test loading embeddings for non-existent job"""
        with patch('routes.history.JobService.get_job') as mock_get_job:
            mock_get_job.return_value = None
            
            response = client.post("/api/v1/jobs/nonexistent/load")
            
            assert response.status_code == 404

    def test_load_job_embeddings_not_completed(self, client):
        """Test loading embeddings for incomplete job"""
        mock_job = MagicMock(
            job_id="job-1",
            status="running",
            has_results=False
        )
        
        with patch('routes.history.JobService.get_job') as mock_get_job:
            mock_get_job.return_value = mock_job
            
            response = client.post("/api/v1/jobs/job-1/load")
            
            assert response.status_code == 400
            assert "not completed" in response.json()["detail"]

    def test_delete_job_success(self, client):
        """Test successful job deletion"""
        with patch('routes.history.JobService.delete_job') as mock_delete:
            mock_delete.return_value = True
            
            response = client.delete("/api/v1/history/job-1")
            
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "deleted successfully" in data["message"]

    def test_delete_job_not_found(self, client):
        """Test job deletion for non-existent job"""
        with patch('routes.history.JobService.delete_job') as mock_delete:
            mock_delete.return_value = False
            
            response = client.delete("/api/v1/history/nonexistent")
            
            assert response.status_code == 404

    def test_get_job_stats_success(self, client):
        """Test successful job statistics retrieval"""
        mock_stats = {
            "total_jobs": 10,
            "completed_jobs": 8,
            "failed_jobs": 1,
            "running_jobs": 1,
            "queued_jobs": 0,
            "method_breakdown": {
                "umap": 5,
                "tsne": 3,
                "pca": 2
            },
            "avg_runtime_seconds": 15.5,
            "success_rate": 80.0
        }
        
        with patch('routes.history.JobService.get_job_statistics') as mock_get_stats:
            mock_get_stats.return_value = mock_stats
            
            response = client.get("/api/v1/stats")
            
            assert response.status_code == 200
            data = response.json()
            assert data["total_jobs"] == 10
            assert data["completed_jobs"] == 8
            assert "method_breakdown" in data

    def test_get_history_stats(self, client):
        """Test history stats endpoint"""
        mock_stats = {
            "total_jobs": 10,
            "completed_jobs": 8,
            "failed_jobs": 1,
            "running_jobs": 1
        }
        
        with patch('routes.history.JobService.get_job_statistics') as mock_get_stats:
            mock_get_stats.return_value = mock_stats
            
            response = client.get("/api/v1/stats")
            
            assert response.status_code == 200
            data = response.json()
            assert data["total_jobs"] == 10 