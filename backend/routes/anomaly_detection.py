from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
from backend.services.anomaly_detection_service import anomaly_service
from backend.services.job_service import JobService
from backend.database.models import Job
from backend.database.connection import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/anomaly", tags=["anomaly-detection"])
job_service = JobService()

class AnomalyDetectionRequest(BaseModel):
    real_data: List[List[float]]
    synthetic_data: List[List[float]]
    x_bins: int = 20
    y_bins: int = 20
    fdr_alpha: float = 0.05

class AnomalyDetectionFromJobRequest(BaseModel):
    job_id: str
    x_bins: int = 20
    y_bins: int = 20
    fdr_alpha: float = 0.05

class AnomalyDetectionResponse(BaseModel):
    status: str
    message: str
    statistics: Dict[str, Any]
    real_data: List[Dict[str, Any]]
    synthetic_data: List[Dict[str, Any]]
    real_anomalies: List[Dict[str, Any]]
    real_normal: List[Dict[str, Any]]
    synthetic_anomalies: List[Dict[str, Any]]
    synthetic_normal: List[Dict[str, Any]]
    grid_info: Dict[str, Any]
    anomalies: List[Dict[str, Any]]
    cell_anomalies: List[Dict[str, Any]]
    positive_tests: List[Dict[str, Any]]
    negative_tests: List[Dict[str, Any]]
    proportion_thresholds: Optional[Dict[str, Any]] = None

@router.post("/detect-anomalies", response_model=AnomalyDetectionResponse)
async def detect_anomalies(request: AnomalyDetectionRequest):
    """
    Find unusual patterns in your data using statistical analysis.
    
    This looks for areas where real and synthetic data are distributed
    differently by:
    1. Creating a grid based on your data distribution
    2. Comparing proportions in each grid cell
    3. Using statistical tests to find significant differences
    4. Highlighting areas that stand out
    """
    try:
        logger.info(f"Starting anomaly detection with x_bins={request.x_bins}, y_bins={request.y_bins}, fdr_alpha={request.fdr_alpha}")
        
        # Validate input data
        if not request.real_data or len(request.real_data) == 0:
            raise HTTPException(status_code=400, detail="Real data cannot be empty")
        
        if not request.synthetic_data or len(request.synthetic_data) == 0:
            raise HTTPException(status_code=400, detail="Synthetic data cannot be empty")
        
        # Perform anomaly detection
        results = anomaly_service.detect_anomalies(
            real_data=request.real_data,
            synthetic_data=request.synthetic_data,
            x_bins=request.x_bins,
            y_bins=request.y_bins,
            fdr_alpha=request.fdr_alpha
        )
        
        if results.get("status") == "error":
            raise HTTPException(status_code=500, detail=results.get("message", "Anomaly detection failed"))
        
        logger.info(f"Anomaly detection completed successfully")
        return AnomalyDetectionResponse(**results)
        
    except Exception as e:
        logger.error(f"Error in detect_anomalies endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")

@router.post("/detect-anomalies-from-job", response_model=AnomalyDetectionResponse)
async def detect_anomalies_from_job(request: AnomalyDetectionFromJobRequest):
    """
    Detect anomalies using data from a previously completed embedding job.
    
    This endpoint performs the same histogram-based binomial proportion tests
    but uses data from a stored job instead of direct input data.
    """
    try:
        logger.info(f"Starting anomaly detection from job {request.job_id} with x_bins={request.x_bins}, y_bins={request.y_bins}, fdr_alpha={request.fdr_alpha}")
        
        # Retrieve job data
        job = job_service.get_job(request.job_id)
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {request.job_id} not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail=f"Job {request.job_id} is not completed (status: {job.status})")
        
        # Get job results
        job_results = job_service.get_job_results(request.job_id)
        if not job_results:
            raise HTTPException(status_code=400, detail=f"Job {request.job_id} does not contain valid embedding data")
        
        # Extract real and synthetic data from job results
        if "embedding_real" not in job_results or "embedding_synthetic" not in job_results:
            raise HTTPException(status_code=400, detail=f"Job {request.job_id} does not contain valid embedding data")
        
        real_data = job_results["embedding_real"]
        synthetic_data = job_results["embedding_synthetic"]
        
        # Validate extracted data
        if not real_data or len(real_data) == 0:
            raise HTTPException(status_code=400, detail="Job contains no real data")
        
        if not synthetic_data or len(synthetic_data) == 0:
            raise HTTPException(status_code=400, detail="Job contains no synthetic data")
        
        # Perform anomaly detection
        results = anomaly_service.detect_anomalies(
            real_data=real_data,
            synthetic_data=synthetic_data,
            x_bins=request.x_bins,
            y_bins=request.y_bins,
            fdr_alpha=request.fdr_alpha
        )
        
        if results.get("status") == "error":
            raise HTTPException(status_code=500, detail=results.get("message", "Anomaly detection failed"))
        
        logger.info(f"Anomaly detection from job {request.job_id} completed successfully")
        return AnomalyDetectionResponse(**results)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in detect_anomalies_from_job endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Anomaly detection from job failed: {str(e)}")

@router.post("/generate-anomaly-csv")
async def generate_anomaly_csv(request: AnomalyDetectionRequest):
    """
    Generate CSV content for anomaly detection results using binomial proportion tests.
    
    Returns CSV content with:
    - Global statistics (proportions, FDR alpha, test counts)
    - Cell-level analysis (proportions, p-values, significance)
    - Point-level data (grid cell assignments, anomaly status)
    """
    try:
        logger.info(f"Generating anomaly CSV with x_bins={request.x_bins}, y_bins={request.y_bins}, fdr_alpha={request.fdr_alpha}")
        
        # Validate input data
        if not request.real_data or len(request.real_data) == 0:
            raise HTTPException(status_code=400, detail="Real data cannot be empty")
        
        if not request.synthetic_data or len(request.synthetic_data) == 0:
            raise HTTPException(status_code=400, detail="Synthetic data cannot be empty")
        
        # Perform anomaly detection
        results = anomaly_service.detect_anomalies(
            real_data=request.real_data,
            synthetic_data=request.synthetic_data,
            x_bins=request.x_bins,
            y_bins=request.y_bins,
            fdr_alpha=request.fdr_alpha
        )
        
        if results.get("status") == "error":
            raise HTTPException(status_code=500, detail=results.get("message", "Anomaly detection failed"))
        
        # Generate CSV content
        csv_content = anomaly_service.generate_anomaly_csv(results)
        
        logger.info(f"Anomaly CSV generation completed successfully")
        return {"csv_content": csv_content}
        
    except Exception as e:
        logger.error(f"Error in generate_anomaly_csv endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CSV generation failed: {str(e)}")

@router.post("/generate-anomaly-csv-from-job")
async def generate_anomaly_csv_from_job(request: AnomalyDetectionFromJobRequest):
    """
    Generate CSV content for anomaly detection results using data from a previously completed embedding job.
    
    This endpoint performs the same binomial proportion tests and CSV generation
    but uses data from a stored job instead of direct input data.
    """
    try:
        logger.info(f"Generating anomaly CSV from job {request.job_id} with x_bins={request.x_bins}, y_bins={request.y_bins}, fdr_alpha={request.fdr_alpha}")
        
        # Retrieve job data
        job = job_service.get_job(request.job_id)
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {request.job_id} not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail=f"Job {request.job_id} is not completed (status: {job.status})")
        
        # Get job results
        job_results = job_service.get_job_results(request.job_id)
        if not job_results:
            raise HTTPException(status_code=400, detail=f"Job {request.job_id} does not contain valid embedding data")
        
        # Extract real and synthetic data from job results
        if "embedding_real" not in job_results or "embedding_synthetic" not in job_results:
            raise HTTPException(status_code=400, detail=f"Job {request.job_id} does not contain valid embedding data")
        
        real_data = job_results["embedding_real"]
        synthetic_data = job_results["embedding_synthetic"]
        
        # Validate extracted data
        if not real_data or len(real_data) == 0:
            raise HTTPException(status_code=400, detail="Job contains no real data")
        
        if not synthetic_data or len(synthetic_data) == 0:
            raise HTTPException(status_code=400, detail="Job contains no synthetic data")
        
        # Perform anomaly detection
        results = anomaly_service.detect_anomalies(
            real_data=real_data,
            synthetic_data=synthetic_data,
            x_bins=request.x_bins,
            y_bins=request.y_bins,
            fdr_alpha=request.fdr_alpha
        )
        
        if results.get("status") == "error":
            raise HTTPException(status_code=500, detail=results.get("message", "Anomaly detection failed"))
        
        # Generate CSV content
        csv_content = anomaly_service.generate_anomaly_csv(results)
        
        logger.info(f"Anomaly CSV generation from job {request.job_id} completed successfully")
        return {"csv_content": csv_content}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_anomaly_csv_from_job endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CSV generation from job failed: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check for anomaly detection service."""
    return {
        "status": "healthy",
        "service": "anomaly-detection",
        "model_fitted": anomaly_service.is_fitted
    } 