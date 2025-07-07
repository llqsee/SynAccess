import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
from backend.services.job_service import JobService

class TestJobService:
    def test_create_job_success(self):
        """Test successful job creation"""
        with patch('services.job_service.JobService.db') as mock_db:
            mock_job = MagicMock()
            mock_job.id = 1
            mock_db.add.return_value = None
            mock_db.commit.return_value = None
            mock_db.refresh.return_value = None
            
            job_service = JobService(mock_db)
            result = job_service.create_job("umap", {"n_neighbors": 15})
            
            assert result is not None
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()

    def test_get_jobs_with_filters(self):
        """Test job retrieval with filters"""
        with patch('services.job_service.JobService.db') as mock_db:
            mock_query = MagicMock()
            mock_db.query.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.offset.return_value = mock_query
            mock_query.limit.return_value = mock_query
            mock_query.all.return_value = []
            mock_query.count.return_value = 0
            
            job_service = JobService(mock_db)
            result = job_service.get_jobs(
                status="completed",
                method="umap",
                page=1,
                per_page=10
            )
            
            assert "jobs" in result
            assert "total" in result
            assert result["total"] == 0

    def test_update_job_success(self):
        """Test successful job update"""
        with patch('services.job_service.JobService.db') as mock_db:
            mock_job = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            job_service = JobService(mock_db)
            job_service.update_job(1, status="completed", runtime=15.5)
            
            assert mock_job.status == "completed"
            assert mock_job.runtime == 15.5
            mock_db.commit.assert_called_once()

    def test_get_job_stats(self):
        """Test job statistics retrieval"""
        with patch('services.job_service.JobService.db') as mock_db:
            mock_db.query.return_value.count.return_value = 10
            mock_db.query.return_value.filter.return_value.count.return_value = 7
            
            job_service = JobService(mock_db)
            stats = job_service.get_job_stats()
            
            assert "total_jobs" in stats
            assert "completed_jobs" in stats

    def test_delete_job_success(self):
        """Test successful job deletion"""
        with patch('services.job_service.JobService.db') as mock_db:
            mock_job = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            job_service = JobService(mock_db)
            result = job_service.delete_job(1)
            
            assert result is True
            mock_db.delete.assert_called_once_with(mock_job)
            mock_db.commit.assert_called_once()

    def test_toggle_favorite(self):
        """Test job favorite toggle"""
        with patch('services.job_service.JobService.db') as mock_db:
            mock_job = MagicMock()
            mock_job.is_favorite = False
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            job_service = JobService(mock_db)
            result = job_service.toggle_favorite(1)
            
            assert mock_job.is_favorite is True
            assert result["is_favorite"] is True
            mock_db.commit.assert_called_once() 