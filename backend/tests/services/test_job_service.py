import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
from services.job_service import JobService

class TestJobService:
    def test_create_job_success(self):
        """Test successful job creation"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_job = MagicMock()
            mock_job.job_id = "test-job-id"
            mock_job.name = "Test Job"
            mock_job.status = "queued"
            mock_job.created_at = datetime.utcnow()
            mock_db.add.return_value = None
            mock_db.commit.return_value = None
            mock_db.refresh.return_value = None
            
            result = JobService.create_job(
                job_id="test-job-id",
                method="umap",
                params={"n_neighbors": 15},
                n_samples=100,
                status="queued"
            )
            
            assert "job_id" in result
            assert "status" in result
            assert result["job_id"] == "test-job-id"
            assert result["status"] == "created"
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()

    def test_update_job_results_success(self):
        """Test successful job results update"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_job = MagicMock()
            mock_job_result = MagicMock()
            mock_db.query.return_value.filter.return_value.first.side_effect = [mock_job, mock_job_result]
            
            result = JobService.update_job_results(
                job_id="test-job-id",
                embedding_real=[[0.1, 0.2], [0.3, 0.4]],
                embedding_synthetic=[[0.11, 0.21], [0.31, 0.41]],
                runtime_seconds=15.5,
                preprocessing_info={"method": "standard"},
                real_processed_samples=100,
                synthetic_processed_samples=100
            )
            
            assert result is True
            assert mock_job.status == "completed"
            assert mock_job.runtime_seconds == 15.5
            assert mock_job.has_results is True

    def test_mark_job_failed_success(self):
        """Test successful job failure marking"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_job = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            result = JobService.mark_job_failed(
                job_id="test-job-id",
                error_message="Test error"
            )
            
            assert result is True
            assert mock_job.status == "failed"
            assert mock_job.error_message == "Test error"

    def test_get_job_success(self):
        """Test successful job retrieval by ID"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_job = MagicMock()
            mock_job.job_id = "test-job-id"
            mock_job.name = "Test Job"
            mock_job.method = "umap"
            mock_job.status = "completed"
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            result = JobService.get_job("test-job-id")
            
            assert result is not None
            assert result.job_id == "test-job-id"
            assert result.name == "Test Job"

    def test_get_jobs_success(self):
        """Test successful jobs retrieval with filters"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_jobs = [MagicMock(), MagicMock()]
            mock_query = MagicMock()
            mock_db.query.return_value = mock_query
            
            # Configure the mock chain to return the expected values
            mock_filtered_query = MagicMock()
            mock_ordered_query = MagicMock()
            mock_offset_query = MagicMock()
            mock_limited_query = MagicMock()
            
            mock_query.filter.return_value = mock_filtered_query
            mock_filtered_query.filter.return_value = mock_ordered_query
            mock_ordered_query.order_by.return_value = mock_offset_query
            mock_offset_query.offset.return_value = mock_limited_query
            mock_limited_query.limit.return_value = mock_limited_query
            mock_limited_query.all.return_value = mock_jobs
            
            result = JobService.get_jobs(
                limit=10,
                offset=0,
                status="completed",
                method="umap"
            )
            
            assert result == mock_jobs
            # Verify the query was called with correct filters
            mock_query.filter.assert_called()

    def test_get_job_count_success(self):
        """Test successful job count retrieval"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_query = MagicMock()
            mock_db.query.return_value = mock_query
            
            # Configure the mock chain to return the expected count
            mock_filtered_query = MagicMock()
            mock_query.filter.return_value = mock_filtered_query
            mock_filtered_query.filter.return_value = mock_filtered_query
            mock_filtered_query.count.return_value = 5
            
            result = JobService.get_job_count(
                status="completed",
                method="umap"
            )
            
            assert result == 5
            # Verify the query was called with correct filters
            mock_query.filter.assert_called()

    def test_update_job_async_info_success(self):
        """Test successful job async info update"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_job = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            result = JobService.update_job_async_info(
                job_id="test-job-id",
                status="running",
                task_id="task-123",
                worker_id="worker-1",
                progress=0.5
            )
            
            assert result is True
            assert mock_job.status == "running"
            assert mock_job.task_id == "task-123"
            assert mock_job.worker_id == "worker-1"
            assert mock_job.progress == 0.5

    def test_get_job_results_success(self):
        """Test successful job results retrieval"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_job_result = MagicMock()
            mock_job_result.embedding_real = '[[0.1, 0.2], [0.3, 0.4]]'
            mock_job_result.embedding_synthetic = '[[0.5, 0.6], [0.7, 0.8]]'
            mock_job_result.preprocessing_info = '{"method": "standard"}'
            mock_job_result.real_processed_samples = 100
            mock_job_result.synthetic_processed_samples = 100
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job_result
            
            result = JobService.get_job_results("test-job-id")
            
            assert result is not None
            assert "embedding_real" in result
            assert "embedding_synthetic" in result
            assert "preprocessing_info" in result

    def test_delete_job_success(self):
        """Test successful job deletion"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_query = MagicMock()
            mock_db.query.return_value = mock_query
            mock_query.filter.return_value.delete.return_value = None
            
            result = JobService.delete_job("test-job-id")
            
            assert result is True
            # Should delete job results, compressed data, and job
            assert mock_query.filter.return_value.delete.call_count == 3

    def test_get_job_statistics_success(self):
        """Test successful job statistics retrieval"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_query = MagicMock()
            mock_db.query.return_value = mock_query
            mock_query.count.return_value = 10
            mock_query.filter.return_value.count.side_effect = [8, 1, 1, 0, 5, 3, 2, 15.5]
            
            result = JobService.get_job_statistics()
            
            assert result is not None
            assert "total_jobs" in result
            assert "completed_jobs" in result
            assert "failed_jobs" in result
            assert "running_jobs" in result
            assert "method_breakdown" in result

    def test_compress_and_store_data_async_success(self):
        """Test successful data compression and storage"""
        with patch('services.job_service.get_db') as mock_get_db, \
             patch('services.job_service.CompressionService', create=True) as mock_compression_service:
            
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_job = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            mock_compression_service.return_value = MagicMock()
            
            result = JobService.compress_and_store_data_async(
                job_id="test-job-id",
                real_data=[[1, 2], [3, 4]],
                synthetic_data=[[5, 6], [7, 8]],
                real_headers=["col1", "col2"],
                synthetic_headers=["col1", "col2"]
            )
            
            assert result is True
            assert mock_job.has_compressed_data is True

    def test_get_compressed_data_success(self):
        """Test successful compressed data retrieval"""
        with patch('services.job_service.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            mock_compressed_data = MagicMock()
            mock_compressed_data.compressed_data = '{"real_data": [[1, 2]], "synthetic_data": [[5, 6]]}'
            mock_db.query.return_value.filter.return_value.first.return_value = mock_compressed_data
            
            result = JobService.get_compressed_data("test-job-id")
            
            assert result is not None
            assert "real_data" in result
            assert "synthetic_data" in result 