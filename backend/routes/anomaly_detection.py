from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Optional
import logging
from services.anomaly_detection_service import anomaly_service
from services.job_service import JobService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/anomaly", tags=["anomaly-detection"])

class AnomalyDetectionRequest(BaseModel):
    real_data: List[List[float]]
    synthetic_data: List[List[float]]
    contamination: str = 'auto'

class AnomalyDetectionFromJobRequest(BaseModel):
    job_id: str
    contamination: str = 'auto'

class AnomalyDetectionResponse(BaseModel):
    status: str
    statistics: Optional[Dict] = None
    real_data: Optional[List[Dict]] = None
    synthetic_data: Optional[List[Dict]] = None
    anomalies: Optional[List[Dict]] = None
    normal_synthetic: Optional[List[Dict]] = None
    message: Optional[str] = None

@router.post("/detect", response_model=AnomalyDetectionResponse)
async def detect_anomalies(request: AnomalyDetectionRequest):
    """Detect anomalies in synthetic data using Isolation Forest."""
    try:
        # Validate input data
        if not request.real_data or not request.synthetic_data:
            raise HTTPException(status_code=400, detail="Both real_data and synthetic_data are required")
        
        if len(request.real_data) < 10:
            raise HTTPException(status_code=400, detail="Insufficient real data (minimum 10 points)")
        
        if len(request.synthetic_data) == 0:
            raise HTTPException(status_code=400, detail="No synthetic data provided")
        
        # Check data dimensions
        real_dim = len(request.real_data[0]) if request.real_data else 0
        synthetic_dim = len(request.synthetic_data[0]) if request.synthetic_data else 0
        
        if real_dim != synthetic_dim:
            raise HTTPException(status_code=400, detail="Real and synthetic data must have the same dimensions")
        
        # Train anomaly detector
        training_result = anomaly_service.train_anomaly_detector(
            request.real_data, 
            request.contamination
        )
        
        logger.info(f"Training result: {training_result}")
        
        if training_result.get("status") != "success":
            raise HTTPException(status_code=500, detail=f"Training failed: {training_result.get('message', 'Unknown error')}")
        
        # Detect anomalies
        logger.info(f"Starting anomaly detection with {len(request.real_data)} real and {len(request.synthetic_data)} synthetic points")
        detection_result = anomaly_service.detect_anomalies(
            request.real_data, 
            request.synthetic_data,
            request.contamination
        )
        
        logger.info(f"Detection result: {detection_result}")
        
        if detection_result.get("status") != "success":
            raise HTTPException(status_code=500, detail=f"Detection failed: {detection_result.get('message', 'Unknown error')}")
        
        logger.info(f"Detection result keys: {list(detection_result.keys())}")
        logger.info(f"Detection result status: {detection_result.get('status')}")
        logger.info(f"Detection result statistics: {detection_result.get('statistics')}")
        
        logger.info(f"Anomaly detection completed. Found {detection_result['statistics']['synthetic_anomalies']} anomalies.")
        
        return AnomalyDetectionResponse(
            status="success",
            statistics=detection_result.get("statistics"),
            real_data=detection_result.get("real_data"),
            synthetic_data=detection_result.get("synthetic_data"),
            anomalies=detection_result.get("anomalies"),
            normal_synthetic=detection_result.get("normal_synthetic")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in anomaly detection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")

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
        
        # Get job results with preprocessed data
        results = JobService.get_job_results(request.job_id)
        if not results:
            raise HTTPException(status_code=400, detail="Job has no embedding data")
        
        # Get compressed data for original features
        compressed_data = JobService.get_compressed_data(request.job_id)
        if not compressed_data:
            raise HTTPException(status_code=400, detail="Job has no compressed data for anomaly detection")
        
        logger.info(f"Using preprocessed data from job {request.job_id}")
        logger.info(f"Real data shape: {len(compressed_data['real_data'])} x {len(compressed_data['real_data'][0]) if compressed_data['real_data'] else 0}")
        logger.info(f"Synthetic data shape: {len(compressed_data['synthetic_data'])} x {len(compressed_data['synthetic_data'][0]) if compressed_data['synthetic_data'] else 0}")
        
        # Validate data
        if len(compressed_data['real_data']) < 10:
            raise HTTPException(status_code=400, detail="Insufficient real data for anomaly detection (minimum 10 points)")
        
        if len(compressed_data['synthetic_data']) == 0:
            raise HTTPException(status_code=400, detail="No synthetic data available for anomaly detection")
        
        # Check raw data dimensions
        real_dim = len(compressed_data['real_data'][0]) if compressed_data['real_data'] else 0
        synthetic_dim = len(compressed_data['synthetic_data'][0]) if compressed_data['synthetic_data'] else 0
        
        if real_dim != synthetic_dim:
            raise HTTPException(status_code=400, detail="Real and synthetic data must have the same dimensions")
        
        # Preprocess the raw data from compressed storage
        from utils.data_preprocessing import preprocess_data
        
        logger.info("Preprocessing raw data for anomaly detection...")
        real_processed, synthetic_processed = preprocess_data(
            compressed_data['real_data'], 
            compressed_data['synthetic_data']
        )
        
        # Convert numpy arrays to lists for the anomaly detection service
        real_processed_list = real_processed.tolist()
        synthetic_processed_list = synthetic_processed.tolist()
        
        logger.info(f"Preprocessed data shapes: Real {real_processed.shape}, Synthetic {synthetic_processed.shape}")
        
        # Train anomaly detector on preprocessed real data
        training_result = anomaly_service.train_anomaly_detector(
            real_processed_list, 
            request.contamination
        )
        
        logger.info(f"Training result: {training_result}")
        
        if training_result.get("status") != "success":
            raise HTTPException(status_code=500, detail=f"Training failed: {training_result.get('message', 'Unknown error')}")
        
        # Detect anomalies using preprocessed data
        logger.info(f"Starting anomaly detection with preprocessed data: {len(real_processed_list)} real and {len(synthetic_processed_list)} synthetic points")
        detection_result = anomaly_service.detect_anomalies(
            real_processed_list, 
            synthetic_processed_list,
            request.contamination
        )
        
        logger.info(f"Detection result: {detection_result}")
        
        if detection_result.get("status") != "success":
            raise HTTPException(status_code=500, detail=f"Detection failed: {detection_result.get('message', 'Unknown error')}")
        
        logger.info(f"Anomaly detection completed using preprocessed data. Found {detection_result['statistics']['synthetic_anomalies']} anomalies.")
        
        return AnomalyDetectionResponse(
            status="success",
            statistics=detection_result.get("statistics"),
            real_data=detection_result.get("real_data"),
            synthetic_data=detection_result.get("synthetic_data"),
            anomalies=detection_result.get("anomalies"),
            normal_synthetic=detection_result.get("normal_synthetic")
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