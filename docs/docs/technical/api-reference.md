# API Reference

Complete API documentation for MAVIS backend services.

## Core Endpoints

### Embedding Generation
- `POST /api/v1/embed` - Generate embeddings using UMAP or t-SNE
- `GET /api/v1/embed/{job_id}` - Get embedding results
- `POST /api/v1/embed/pretrained` - Use pretrained models

### Data Validation
- `POST /api/v1/validation` - Perform comprehensive statistical validation
- `GET /api/v1/validation/{job_id}` - Get validation results

### Anomaly Detection
- `POST /api/v1/anomaly/detect-anomalies` - Detect anomalies in data
- `POST /api/v1/anomaly/detect-anomalies-from-job` - Detect anomalies from job data
- `POST /api/v1/anomaly/generate-anomaly-csv` - Generate anomaly CSV report
- `POST /api/v1/anomaly/generate-anomaly-csv-from-job` - Generate CSV from job data

### Distribution Analysis
- `POST /api/v1/distribution` - Analyze data distributions
- `GET /api/v1/distribution/{job_id}` - Get analysis results

### Job Management
- `GET /api/v1/history` - Get job history with filtering
- `GET /api/v1/history/{job_id}` - Get specific job details
- `POST /api/v1/history/{job_id}/load` - Load job embeddings
- `DELETE /api/v1/history/{job_id}` - Delete job
- `GET /api/v1/history/stats` - Get job statistics

### Queue Management
- `GET /api/v1/queue/status` - Get queue status
- `GET /api/v1/queue/{job_id}/status` - Get job status
- `POST /api/v1/queue/{job_id}/cancel` - Cancel job

### AI Analysis
- `POST /api/v1/ai/analyze` - Perform AI-powered analysis
- `GET /api/v1/ai/status` - Get AI service status

## GPU Monitoring Endpoints

### GPU Status
- `GET /api/v1/gpu/status` - Get GPU availability and status
- `GET /api/v1/gpu/info` - Get detailed GPU information
- `GET /api/v1/gpu/info/{device_index}` - Get specific GPU device info

### GPU Performance
- `GET /api/v1/gpu/memory` - Get GPU memory usage
- `GET /api/v1/gpu/utilization` - Get GPU utilization metrics
- `GET /api/v1/gpu/usage` - Get comprehensive GPU usage summary

### GPU Availability
- `GET /api/v1/gpu/availability` - Check GPU availability
- `GET /api/v1/gpu/devices` - List available GPU devices

## System Endpoints

### Health Check
- `GET /api/v1/health` - System health status

### Performance Monitoring
- `GET /api/v1/performance/status` - System performance status
- `GET /api/v1/performance/metrics` - Performance metrics

## Request/Response Examples

### Embedding Generation
```json
POST /api/v1/embed
{
  "real_data": [[1.0, 2.0], [2.0, 3.0], ...],
  "synthetic_data": [[1.1, 2.1], [2.1, 3.1], ...],
  "method": "umap",
  "parameters": {
    "n_neighbors": 15,
    "min_dist": 0.1
  }
}
```

### Anomaly Detection
```json
POST /api/v1/anomaly/detect-anomalies
{
  "real_data": [[1.0, 2.0], [2.0, 3.0], ...],
  "synthetic_data": [[1.1, 2.1], [2.1, 3.1], ...],
  "x_bins": 20,
  "y_bins": 20,
  "fdr_alpha": 0.05
}
```

### GPU Status Response
```json
GET /api/v1/gpu/status
{
  "available": true,
  "device_count": 1,
  "devices": [
    {
      "index": 0,
      "name": "NVIDIA RTX 3080",
      "memory_total": 10240,
      "memory_used": 2048,
      "utilization": 45
    }
  ]
}
```

## Error Responses

### Standard Error Format
```json
{
  "detail": "Error message description",
  "status_code": 400,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Common Error Codes
- `400` - Bad Request (invalid input data)
- `404` - Not Found (job or resource not found)
- `500` - Internal Server Error (server-side error)
- `503` - Service Unavailable (GPU or service unavailable)

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **GPU endpoints**: 50 requests per minute per IP
- **Large file uploads**: 10 requests per minute per IP

## Authentication

Currently, MAVIS does not require authentication for local development. For production deployments, consider implementing:
- API key authentication
- OAuth 2.0 integration
- JWT token validation