import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
from services.job_service import JobService

class TestJobService:
    def test_create_job_success(self):
        """Test successful job creation"""
        with patch('services.job_service.get_db_session') as mock_db_session:
            mock_db = MagicMock()
            mock_db_session.return_value.__enter__.return_value = mock_db
            mock_job = MagicMock()
            mock_job.job_id = "test-job-id"
            mock_job.name = "Test Job"
            mock_job.status = "running"
            mock_job.created_at = datetime.utcnow()
            mock_db.add.return_value = None
            mock_db.flush.return_value = None
            
            result = JobService.create_job(
                name="Test Job",
                method="umap",
                parameters={"n_neighbors": 15},
                real_data=[[1, 2], [3, 4]],
                synthetic_data=[[1.1, 2.1], [3.1, 4.1]]
            )
            
            assert "job_id" in result
            assert "name" in result
            assert "status" in result
            mock_db.add.assert_called_once()
            mock_db.flush.assert_called_once()

    def test_update_job_results_success(self):
        """Test successful job results update"""
        with patch('services.job_service.get_db_session') as mock_db_session:
            mock_db = MagicMock()
            mock_db_session.return_value.__enter__.return_value = mock_db
            mock_job = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            result = JobService.update_job_results(
                job_id="test-job-id",
                embedding_real=[[0.1, 0.2], [0.3, 0.4]],
                embedding_synthetic=[[0.11, 0.21], [0.31, 0.41]],
                runtime_seconds=15.5
            )
            
            assert result is True
            assert mock_job.status == "completed"
            assert mock_job.runtime_seconds == 15.5

    def test_mark_job_failed_success(self):
        """Test successful job failure marking"""
        with patch('services.job_service.get_db_session') as mock_db_session:
            mock_db = MagicMock()
            mock_db_session.return_value.__enter__.return_value = mock_db
            mock_job = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            result = JobService.mark_job_failed(
                job_id="test-job-id",
                error_message="Test error"
            )
            
            assert result is True
            assert mock_job.status == "failed"
            assert mock_job.error_message == "Test error"

    def test_get_job_by_id_success(self):
        """Test successful job retrieval by ID"""
        with patch('services.job_service.get_db_session') as mock_db_session:
            mock_db = MagicMock()
            mock_db_session.return_value.__enter__.return_value = mock_db
            mock_job = MagicMock()
            mock_job.job_id = "test-job-id"
            mock_job.name = "Test Job"
            mock_job.method = "umap"
            mock_job.status = "completed"
            mock_job.is_favorite = False
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            with patch.object(JobService, '_job_to_dict') as mock_job_to_dict:
                mock_job_to_dict.return_value = {"job_id": "test-job-id", "name": "Test Job"}
                
                result = JobService.get_job_by_id("test-job-id")
                
                assert result is not None
                assert result["job_id"] == "test-job-id"
                mock_job_to_dict.assert_called_once_with(mock_job, False)

    def test_get_job_history_success(self):
        """Test successful job history retrieval"""
        with patch('services.job_service.get_db_session') as mock_db_session:
            mock_db = MagicMock()
            mock_db_session.return_value.__enter__.return_value = mock_db
            mock_jobs = [MagicMock(), MagicMock()]
            mock_query = MagicMock()
            mock_db.query.return_value = mock_query
            mock_query.count.return_value = 2
            mock_query.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mock_jobs
            
            with patch.object(JobService, '_job_to_dict') as mock_job_to_dict:
                mock_job_to_dict.return_value = {"job_id": "test"}
                
                jobs, total = JobService.get_job_history(limit=10, offset=0)
                
                assert total == 2
                assert len(jobs) == 2
                assert mock_job_to_dict.call_count == 2

    def test_toggle_favorite_success(self):
        """Test successful job favorite toggle"""
        with patch('services.job_service.get_db_session') as mock_db_session:
            mock_db = MagicMock()
            mock_db_session.return_value.__enter__.return_value = mock_db
            mock_job = MagicMock()
            mock_job.is_favorite = False
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            result = JobService.toggle_favorite("test-job-id")
            
            assert result is True
            assert mock_job.is_favorite is True

    def test_delete_job_success(self):
        """Test successful job deletion"""
        with patch('services.job_service.get_db_session') as mock_db_session:
            mock_db = MagicMock()
            mock_db_session.return_value.__enter__.return_value = mock_db
            mock_job = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            mock_db.query.return_value.filter.return_value.delete.return_value = None
            
            result = JobService.delete_job("test-job-id")
            
            assert result is True
            mock_db.delete.assert_called_once_with(mock_job) 