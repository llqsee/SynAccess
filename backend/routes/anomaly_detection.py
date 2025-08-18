from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Optional
import logging
from backend.services.anomaly_detection_service import anomaly_service
from backend.services.job_service import JobService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/anomaly", tags=["anomaly-detection"])

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
    statistics: Optional[Dict] = None
    real_data: Optional[List[Dict]] = None
    synthetic_data: Optional[List[Dict]] = None
    cell_anomalies: Optional[List[Dict]] = None  # Changed from "anomalies" to "cell_anomalies"
    normal_synthetic: Optional[List[Dict]] = None
    grid_info: Optional[Dict] = None  # Added grid_info field
    logit_thresholds: Optional[Dict] = None  # CRITICAL: Required for CSV generation global statistics
    positive_tests: Optional[List[Dict]] = None  # FDR-corrected positive test results
    negative_tests: Optional[List[Dict]] = None  # FDR-corrected negative test results
    message: Optional[str] = None

@router.post("/detect", response_model=AnomalyDetectionResponse)
async def detect_anomalies(request: AnomalyDetectionRequest):
    """Detect anomalies in synthetic data using grid-based approach."""
    try:
        # Validate input data
        if not request.real_data or not request.synthetic_data:
            raise HTTPException(status_code=400, detail="Both real_data and synthetic_data are required")
        
        if len(request.real_data) < 10:
            raise HTTPException(status_code=400, detail="Insufficient real data (minimum 10 points)")
        
        if len(request.synthetic_data) == 0:
            raise HTTPException(status_code=400, detail="No synthetic data provided")
        
        # Check data dimensions (must be 2D for grid-based approach)
        real_dim = len(request.real_data[0]) if request.real_data else 0
        synthetic_dim = len(request.synthetic_data[0]) if request.synthetic_data else 0
        
        if real_dim != 2 or synthetic_dim != 2:
            raise HTTPException(status_code=400, detail="Grid-based anomaly detection requires 2D data")
        
        if real_dim != synthetic_dim:
            raise HTTPException(status_code=400, detail="Real and synthetic data must have the same dimensions")
        
        # Detect anomalies using histogram-based approach with statistical testing
        logger.info(f"Starting histogram-based anomaly detection with {len(request.real_data)} real and {len(request.synthetic_data)} synthetic points")
        detection_result = anomaly_service.detect_anomalies(
            request.real_data, 
            request.synthetic_data,
            request.x_bins,
            request.y_bins,
            request.fdr_alpha
        )
        
        logger.info(f"Detection result: {detection_result}")
        
        if detection_result.get("status") != "success":
            raise HTTPException(status_code=500, detail=f"Detection failed: {detection_result.get('message', 'Unknown error')}")
        
        logger.info(f"Detection result keys: {list(detection_result.keys())}")
        logger.info(f"Detection result status: {detection_result.get('status')}")
        logger.info(f"Detection result statistics: {detection_result.get('statistics')}")
        logger.info(f"Detection result grid_info: {detection_result.get('grid_info')}")
        logger.info(f"Detection result grid_info bounds: {detection_result.get('grid_info', {}).get('bounds') if detection_result.get('grid_info') else 'None'}")
        
        logger.info(f"Histogram-based anomaly detection completed. Found {detection_result['statistics']['synthetic_anomalies']} anomalies.")
        
        return AnomalyDetectionResponse(
            status="success",
            statistics=detection_result.get("statistics"),
            real_data=detection_result.get("real_data"),
            synthetic_data=detection_result.get("synthetic_data"),
            cell_anomalies=detection_result.get("cell_anomalies"),  # Fixed field name
            normal_synthetic=detection_result.get("normal_synthetic"),
            grid_info=detection_result.get("grid_info"),  # Added grid_info
            logit_thresholds=detection_result.get("logit_thresholds"),  # CRITICAL: Pass logit_thresholds for CSV generation
            positive_tests=detection_result.get("positive_tests"),  # FDR-corrected positive test results
            negative_tests=detection_result.get("negative_tests")   # FDR-corrected negative test results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in grid-based anomaly detection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Grid-based anomaly detection failed: {str(e)}")

@router.post("/detect-from-job", response_model=AnomalyDetectionResponse)
async def detect_anomalies_from_job(request: AnomalyDetectionFromJobRequest):
    """Detect anomalies using preprocessed data from a completed embedding job."""
    try:
        # Get the job and its results
        job = JobService.get_job(request.job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.status != "completed":
            raise HTTPException(status_code=400, detail="Job is not completed")
        
        # Get job results with embedding data
        results = JobService.get_job_results(request.job_id)
        if not results:
            raise HTTPException(status_code=400, detail="Job has no embedding data")
        
        # Get embedding data (2D coordinates)
        embedding_real = results.get('embedding_real', [])
        embedding_synthetic = results.get('embedding_synthetic', [])
        
        if not embedding_real or not embedding_synthetic:
            raise HTTPException(status_code=400, detail="Job has no embedding data for anomaly detection")
        
        logger.info(f"Using embedding data from job {request.job_id}")
        logger.info(f"Real embedding shape: {len(embedding_real)} x {len(embedding_real[0]) if embedding_real else 0}")
        logger.info(f"Synthetic embedding shape: {len(embedding_synthetic)} x {len(embedding_synthetic[0]) if embedding_synthetic else 0}")
        
        # Validate embedding data
        if len(embedding_real) < 10:
            raise HTTPException(status_code=400, detail="Insufficient real embedding data for anomaly detection (minimum 10 points)")
        
        if len(embedding_synthetic) == 0:
            raise HTTPException(status_code=400, detail="No synthetic embedding data available for anomaly detection")
        
        # Check embedding dimensions (must be 2D for grid-based approach)
        real_dim = len(embedding_real[0]) if embedding_real else 0
        synthetic_dim = len(embedding_synthetic[0]) if embedding_synthetic else 0
        
        if real_dim != 2 or synthetic_dim != 2:
            raise HTTPException(status_code=400, detail="Embedding data must be 2D coordinates for grid-based anomaly detection")
        
        if real_dim != synthetic_dim:
            raise HTTPException(status_code=400, detail="Real and synthetic embeddings must have the same dimensions")
        
        logger.info(f"Embedding data shapes: Real {len(embedding_real)}x{real_dim}, Synthetic {len(embedding_synthetic)}x{synthetic_dim}")
        
        # Detect anomalies using histogram-based approach with embedding data
        logger.info(f"Starting histogram-based anomaly detection with embedding data: {len(embedding_real)} real and {len(embedding_synthetic)} synthetic points")
        detection_result = anomaly_service.detect_anomalies(
            embedding_real, 
            embedding_synthetic,
            request.x_bins,
            request.y_bins,
            request.fdr_alpha
        )
        
        logger.info(f"Detection result: {detection_result}")
        
        if detection_result.get("status") != "success":
            raise HTTPException(status_code=500, detail=f"Detection failed: {detection_result.get('message', 'Unknown error')}")
        
        logger.info(f"Histogram-based anomaly detection completed using embedding data. Found {detection_result['statistics']['synthetic_anomalies']} anomalies.")
        
        return AnomalyDetectionResponse(
            status="success",
            statistics=detection_result.get("statistics"),
            real_data=detection_result.get("real_data"),
            synthetic_data=detection_result.get("synthetic_data"),
            cell_anomalies=detection_result.get("cell_anomalies"),  # Fixed field name
            normal_synthetic=detection_result.get("normal_synthetic"),
            grid_info=detection_result.get("grid_info"),  # Added grid_info
            logit_thresholds=detection_result.get("logit_thresholds"),  # CRITICAL: Pass logit_thresholds for CSV generation
            positive_tests=detection_result.get("positive_tests"),  # FDR-corrected positive test results
            negative_tests=detection_result.get("negative_tests")   # FDR-corrected negative test results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in anomaly detection from job: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")

@router.post("/csv")
async def generate_anomaly_csv(request: AnomalyDetectionRequest):
    """
    Generate CSV file with anomaly detection results.
    """
    try:
        # Perform anomaly detection first
        detection_result = await detect_anomalies(request)
        
        if detection_result.status != "success":
            raise HTTPException(
                status_code=500, 
                detail="Failed to perform anomaly detection"
            )
        
        # Generate CSV content
        csv_content = anomaly_service.generate_anomaly_csv(detection_result.dict())
        
        if not csv_content:
            raise HTTPException(
                status_code=500, 
                detail="Failed to generate CSV content"
            )
        
        return {
            "status": "success",
            "csv_content": csv_content,
            "filename": "anomaly_detection_results.csv"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/csv-from-job")
async def generate_anomaly_csv_from_job(request: AnomalyDetectionFromJobRequest):
    """
    Generate CSV file with anomaly detection results using preprocessed data from job.
    """
    try:
        # Perform anomaly detection first
        detection_result = await detect_anomalies_from_job(request)
        
        if detection_result.status != "success":
            raise HTTPException(
                status_code=500, 
                detail="Failed to perform anomaly detection"
            )
        
        # Generate CSV content
        csv_content = anomaly_service.generate_anomaly_csv(detection_result.dict())
        
        if not csv_content:
            raise HTTPException(
                status_code=500, 
                detail="Failed to generate CSV content"
            )
        
        return {
            "status": "success",
            "csv_content": csv_content,
            "filename": "anomaly_detection_results.csv"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating CSV from job: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check for anomaly detection service."""
    return {
        "status": "healthy",
        "service": "anomaly-detection",
        "model_fitted": anomaly_service.is_fitted
    } 