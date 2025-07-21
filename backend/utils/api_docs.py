"""
Advanced API documentation generator for MAVIS.
Generates comprehensive OpenAPI documentation with examples and testing utilities.
"""
import json
import yaml
from typing import Dict, Any, List, Optional, Union
from pathlib import Path
from datetime import datetime
import inspect
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel

from config import settings, API_V1_PREFIX

class APIDocumentationGenerator:
    """Generate comprehensive API documentation with examples and testing utilities."""
    
    def __init__(self, app: FastAPI):
        self.app = app
        self.docs_dir = Path("docs/api")
        self.docs_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_openapi_schema(self) -> Dict[str, Any]:
        """Generate enhanced OpenAPI schema with custom descriptions and examples."""
        
        openapi_schema = get_openapi(
            title="MAVIS API",
            version="1.0.0",
            description="""
# MAVIS - Scalable Visualization and Explainability of Synthetic Datasets

## Overview

MAVIS is a comprehensive platform for generating, visualizing, and analyzing synthetic datasets using advanced embedding techniques. This API provides endpoints for:

- **Embedding Generation**: Create 2D embeddings using UMAP or t-SNE algorithms
- **Job Management**: Track and manage long-running embedding computations
- **Performance Monitoring**: Access system metrics and performance data
- **Data Export**: Export results in multiple formats (JSON, CSV, NPZ)
- **Batch Processing**: Process multiple embedding jobs efficiently

## Authentication

Currently, the API operates in development mode without authentication. In production, authentication will be required for all endpoints except health checks.

## Rate Limiting

- General endpoints: 60 requests per minute
- Embedding generation: 10 requests per minute
- Export endpoints: 30 requests per minute

## Error Handling

All endpoints return standardized error responses:

```json
{
    "detail": "Error description",
    "error_code": "SPECIFIC_ERROR_CODE",
    "timestamp": "2024-01-01T12:00:00Z"
}
```

## Data Formats

### Input Data Format
All embedding endpoints expect data in the following format:

```json
{
    "real_data": [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]],
    "synthetic_data": [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1]],
    "method": "umap",
    "params": {"n_neighbors": 15, "min_dist": 0.1}
}
```

### Response Format
Embedding results are returned in this format:

```json
{
    "real_embedding": [[0.1, 0.2], [0.3, 0.4]],
    "synthetic_embedding": [[0.15, 0.25], [0.35, 0.45]],
    "metadata": {
        "method": "umap",
        "computation_time": 1.23,
        "parameters": {...}
    }
}
```
            """,
            routes=self.app.routes,
            tags=[
                {
                    "name": "embeddings",
                    "description": "Embedding generation and management endpoints"
                },
                {
                    "name": "jobs",
                    "description": "Job tracking and status endpoints"
                },
                {
                    "name": "monitoring",
                    "description": "System monitoring and metrics endpoints"
                },
                {
                    "name": "health",
                    "description": "Health check and system status endpoints"
                }
            ]
        )
        
        # Add custom examples and enhanced descriptions
        self._enhance_schema(openapi_schema)
        
        return openapi_schema
    
    def _enhance_schema(self, schema: Dict[str, Any]):
        """Enhance OpenAPI schema with examples and detailed descriptions."""
        
        # Add server information
        schema["servers"] = [
            {
                "url": "http://localhost:8000",
                "description": "Development server"
            },
            {
                "url": "https://api.mavis.example.com",
                "description": "Production server"
            }
        ]
        
        # Enhance paths with examples
        if "paths" in schema:
            self._add_path_examples(schema["paths"])
        
        # Add component schemas
        if "components" not in schema:
            schema["components"] = {}
        
        schema["components"]["examples"] = self._generate_examples()
        schema["components"]["securitySchemes"] = {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT"
            },
            "ApiKeyAuth": {
                "type": "apiKey",
                "in": "header",
                "name": "X-API-Key"
            }
        }
    
    def _add_path_examples(self, paths: Dict[str, Any]):
        """Add examples to path definitions."""
        
        examples = {
            "/api/v1/embed/generate": {
                "post": {
                    "examples": {
                        "umap_example": {
                            "summary": "UMAP Embedding Example",
                            "description": "Generate UMAP embedding with custom parameters",
                            "value": {
                                "real_data": [
                                    [1.0, 2.0, 3.0, 4.0],
                                    [2.0, 3.0, 4.0, 5.0],
                                    [3.0, 4.0, 5.0, 6.0]
                                ],
                                "synthetic_data": [
                                    [1.1, 2.1, 3.1, 4.1],
                                    [2.1, 3.1, 4.1, 5.1],
                                    [3.1, 4.1, 5.1, 6.1]
                                ],
                                "method": "umap",
                                "params": {
                                    "n_neighbors": 15,
                                    "min_dist": 0.1,
                                    "n_components": 2
                                },
                                "name": "Example UMAP Job",
                                "description": "Testing UMAP with sample data"
                            }
                        },
                        "tsne_example": {
                            "summary": "t-SNE Embedding Example",
                            "description": "Generate t-SNE embedding with default parameters",
                            "value": {
                                "real_data": [
                                    [0.1, 0.2, 0.3],
                                    [0.4, 0.5, 0.6],
                                    [0.7, 0.8, 0.9]
                                ],
                                "synthetic_data": [
                                    [0.11, 0.21, 0.31],
                                    [0.41, 0.51, 0.61],
                                    [0.71, 0.81, 0.91]
                                ],
                                "method": "tsne",
                                "params": {
                                    "perplexity": 30,
                                    "learning_rate": 200
                                }
                            }
                        }
                    }
                }
            }
        }
        
        # Apply examples to paths
        for path, methods in examples.items():
            if path in paths:
                for method, example_data in methods.items():
                    if method in paths[path]:
                        if "requestBody" in paths[path][method]:
                            content = paths[path][method]["requestBody"].get("content", {})
                            for media_type in content:
                                if "examples" not in content[media_type]:
                                    content[media_type]["examples"] = {}
                                content[media_type]["examples"].update(example_data["examples"])
    
    def _generate_examples(self) -> Dict[str, Any]:
        """Generate reusable examples for the API documentation."""
        
        return {
            "sample_embedding_request": {
                "summary": "Sample Embedding Request",
                "value": {
                    "real_data": [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
                    "synthetic_data": [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1], [7.1, 8.1, 9.1]],
                    "method": "umap",
                    "params": {"n_neighbors": 15, "min_dist": 0.1}
                }
            },
            "embedding_response": {
                "summary": "Embedding Response",
                "value": {
                    "real_embedding": [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]],
                    "synthetic_embedding": [[0.15, 0.25], [0.35, 0.45], [0.55, 0.65]],
                    "metadata": {
                        "method": "umap",
                        "computation_time": 1.23,
                        "parameters": {"n_neighbors": 15, "min_dist": 0.1},
                        "data_shape": [6, 3]
                    }
                }
            },
            "job_status_response": {
                "summary": "Job Status Response",
                "value": {
                    "job_id": "123e4567-e89b-12d3-a456-426614174000",
                    "status": "completed",
                    "created_at": "2024-01-01T12:00:00Z",
                    "updated_at": "2024-01-01T12:01:30Z",
                    "name": "UMAP Embedding",
                    "method": "umap",
                    "runtime_seconds": 90.5,
                    "progress": {
                        "completed": True,
                        "percentage": 100
                    }
                }
            },
            "error_response": {
                "summary": "Error Response",
                "value": {
                    "detail": "Data validation error: inconsistent row lengths",
                    "error_code": "VALIDATION_ERROR",
                    "timestamp": "2024-01-01T12:00:00Z"
                }
            }
        }
    
    def generate_markdown_docs(self) -> str:
        """Generate comprehensive markdown documentation."""
        
        schema = self.generate_openapi_schema()
        
        md_content = f"""# MAVIS API Documentation

Generated on: {datetime.now().isoformat()}

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Data Models](#data-models)
- [Examples](#examples)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)
- [Testing](#testing)

## Overview

{schema.get('info', {}).get('description', '')}

## Base URL

```
{schema.get('servers', [{}])[0].get('url', 'http://localhost:8000')}
```

## Authentication

This API uses Bearer token authentication. Include your token in the Authorization header:

```
Authorization: Bearer your-token-here
```

## Endpoints

"""
        
        # Generate endpoint documentation
        paths = schema.get("paths", {})
        for path, methods in paths.items():
            md_content += f"\n### {path}\n\n"
            
            for method, details in methods.items():
                md_content += f"#### {method.upper()}\n\n"
                md_content += f"**Summary:** {details.get('summary', 'No summary available')}\n\n"
                
                if 'description' in details:
                    md_content += f"**Description:** {details['description']}\n\n"
                
                # Parameters
                if 'parameters' in details:
                    md_content += "**Parameters:**\n\n"
                    for param in details['parameters']:
                        required = " (required)" if param.get('required', False) else ""
                        md_content += f"- `{param['name']}`{required}: {param.get('description', '')}\n"
                    md_content += "\n"
                
                # Request body
                if 'requestBody' in details:
                    md_content += "**Request Body:**\n\n"
                    content = details['requestBody'].get('content', {})
                    for media_type, schema_info in content.items():
                        md_content += f"Content-Type: `{media_type}`\n\n"
                        if 'examples' in schema_info:
                            example = list(schema_info['examples'].values())[0]
                            md_content += f"```json\n{json.dumps(example.get('value', {}), indent=2)}\n```\n\n"
                
                # Responses
                if 'responses' in details:
                    md_content += "**Responses:**\n\n"
                    for status_code, response in details['responses'].items():
                        md_content += f"- `{status_code}`: {response.get('description', '')}\n"
                    md_content += "\n"
        
        # Add examples section
        md_content += self._generate_markdown_examples()
        
        # Add error codes section
        md_content += self._generate_error_codes_section()
        
        return md_content
    
    def _generate_markdown_examples(self) -> str:
        """Generate markdown examples section."""
        
        return """
## Examples

### Generate UMAP Embedding

```bash
curl -X POST "http://localhost:8000/api/v1/embed/generate" \\
     -H "Content-Type: application/json" \\
     -d '{
       "real_data": [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]],
       "synthetic_data": [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1]],
       "method": "umap",
       "params": {"n_neighbors": 15, "min_dist": 0.1}
     }'
```

### Check Job Status

```bash
curl -X GET "http://localhost:8000/api/v1/embed/status/{job_id}"
```

### Get Job Results

```bash
curl -X GET "http://localhost:8000/api/v1/embed/results/{job_id}"
```

### Export Results

```bash
curl -X GET "http://localhost:8000/api/v1/embed/export/{job_id}?format=csv" \\
     -o "embedding_results.csv"
```

### Batch Processing

```bash
curl -X POST "http://localhost:8000/api/v1/embed/batch" \\
     -H "Content-Type: application/json" \\
     -d '{
       "jobs": [
         {
           "real_data": [[1, 2, 3], [4, 5, 6]],
           "synthetic_data": [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1]],
           "method": "umap",
           "name": "Batch Job 1"
         },
         {
           "real_data": [[7, 8, 9], [10, 11, 12]],
           "synthetic_data": [[7.1, 8.1, 9.1], [10.1, 11.1, 12.1]],
           "method": "tsne",
           "name": "Batch Job 2"
         }
       ],
       "parallel_limit": 2
     }'
```

## Python Client Example

```python
import requests
import json

# Base URL
base_url = "http://localhost:8000/api/v1"

# Sample data
data = {
    "real_data": [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0], [7.0, 8.0, 9.0]],
    "synthetic_data": [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1], [7.1, 8.1, 9.1]],
    "method": "umap",
    "params": {"n_neighbors": 15, "min_dist": 0.1},
    "name": "Python API Test"
}

# Generate embedding
response = requests.post(f"{base_url}/embed/generate", json=data)
result = response.json()

if "job_id" in result:
    # Async mode - check status
    job_id = result["job_id"]
    print(f"Job started: {job_id}")
    
    # Poll for completion
    import time
    while True:
        status_response = requests.get(f"{base_url}/embed/status/{job_id}")
        status = status_response.json()
        
        print(f"Status: {status['status']}")
        
        if status['status'] == 'completed':
            # Get results
            results_response = requests.get(f"{base_url}/embed/results/{job_id}")
            results = results_response.json()
            print("Embedding completed!")
            print(f"Real embedding shape: {len(results['embeddings']['real'])}")
            break
        elif status['status'] == 'failed':
            print(f"Job failed: {status.get('error_message', 'Unknown error')}")
            break
        
        time.sleep(2)
else:
    # Sync mode - results available immediately
    print("Embedding completed!")
    print(f"Real embedding: {result['real_embedding']}")
    print(f"Synthetic embedding: {result['synthetic_embedding']}")
```

## JavaScript/Node.js Client Example

```javascript
const axios = require('axios');

const baseURL = 'http://localhost:8000/api/v1';

async function generateEmbedding() {
    const data = {
        real_data: [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]],
        synthetic_data: [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1]],
        method: 'umap',
        params: { n_neighbors: 15, min_dist: 0.1 },
        name: 'JavaScript API Test'
    };
    
    try {
        const response = await axios.post(`${baseURL}/embed/generate`, data);
        
        if (response.data.job_id) {
            // Async mode
            const jobId = response.data.job_id;
            console.log(`Job started: ${jobId}`);
            
            // Poll for completion
            while (true) {
                const statusResponse = await axios.get(`${baseURL}/embed/status/${jobId}`);
                const status = statusResponse.data;
                
                console.log(`Status: ${status.status}`);
                
                if (status.status === 'completed') {
                    const resultsResponse = await axios.get(`${baseURL}/embed/results/${jobId}`);
                    const results = resultsResponse.data;
                    console.log('Embedding completed!');
                    console.log(`Real embedding shape: ${results.embeddings.real.length}`);
                    break;
                } else if (status.status === 'failed') {
                    console.log(`Job failed: ${status.error_message || 'Unknown error'}`);
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } else {
            // Sync mode
            console.log('Embedding completed!');
            console.log('Real embedding:', response.data.real_embedding);
            console.log('Synthetic embedding:', response.data.synthetic_embedding);
        }
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

generateEmbedding();
```

"""
    
    def _generate_error_codes_section(self) -> str:
        """Generate error codes documentation section."""
        
        return """
## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Input data validation failed | 400 |
| `METHOD_NOT_SUPPORTED` | Embedding method not supported | 400 |
| `DATA_TOO_LARGE` | Dataset exceeds size limits | 400 |
| `COMPUTATION_TIMEOUT` | Embedding computation timed out | 408 |
| `INSUFFICIENT_RESOURCES` | Server resources exhausted | 503 |
| `JOB_NOT_FOUND` | Job ID not found | 404 |
| `EXPORT_ERROR` | Failed to export results | 500 |
| `INTERNAL_ERROR` | Unexpected server error | 500 |

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **General endpoints**: 60 requests per minute per IP
- **Embedding generation**: 10 requests per minute per IP  
- **Export endpoints**: 30 requests per minute per IP

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640995200
```

## Testing

### Health Check

Test API availability:

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00Z",
    "version": "1.0.0"
}
```

### Performance Metrics

Get system performance metrics:

```bash
curl http://localhost:8000/api/v1/embed/metrics
```

### OpenAPI Schema

Access the OpenAPI schema:

```bash
curl http://localhost:8000/openapi.json
```

### Interactive Documentation

Access Swagger UI documentation:
- Development: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

"""
    
    def save_documentation(self):
        """Save all documentation files."""
        
        # Generate and save OpenAPI schema
        schema = self.generate_openapi_schema()
        
        # Save as JSON
        with open(self.docs_dir / "openapi.json", "w") as f:
            json.dump(schema, f, indent=2)
        
        # Save as YAML
        with open(self.docs_dir / "openapi.yaml", "w") as f:
            yaml.dump(schema, f, default_flow_style=False)
        
        # Save markdown documentation
        markdown_docs = self.generate_markdown_docs()
        with open(self.docs_dir / "api.md", "w") as f:
            f.write(markdown_docs)
        
        # Generate additional documentation files
        self._generate_postman_collection()
        self._generate_testing_guide()
    
    def _generate_postman_collection(self):
        """Generate Postman collection for API testing."""
        
        collection = {
            "info": {
                "name": "MAVIS API",
                "description": "Complete API collection for MAVIS platform",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "variable": [
                {
                    "key": "baseUrl",
                    "value": "http://localhost:8000",
                    "type": "string"
                },
                {
                    "key": "apiKey",
                    "value": "your-api-key-here",
                    "type": "string"
                }
            ],
            "item": [
                {
                    "name": "Health Check",
                    "request": {
                        "method": "GET",
                        "header": [],
                        "url": {
                            "raw": "{{baseUrl}}/health",
                            "host": ["{{baseUrl}}"],
                            "path": ["health"]
                        }
                    }
                },
                {
                    "name": "Generate Embedding (UMAP)",
                    "request": {
                        "method": "POST",
                        "header": [
                            {
                                "key": "Content-Type",
                                "value": "application/json"
                            }
                        ],
                        "body": {
                            "mode": "raw",
                            "raw": json.dumps({
                                "real_data": [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]],
                                "synthetic_data": [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1]],
                                "method": "umap",
                                "params": {"n_neighbors": 15, "min_dist": 0.1},
                                "name": "Postman Test - UMAP"
                            }, indent=2)
                        },
                        "url": {
                            "raw": "{{baseUrl}}/api/v1/embed/generate",
                            "host": ["{{baseUrl}}"],
                            "path": ["api", "v1", "embed", "generate"]
                        }
                    }
                },
                {
                    "name": "Generate Embedding (t-SNE)",
                    "request": {
                        "method": "POST",
                        "header": [
                            {
                                "key": "Content-Type",
                                "value": "application/json"
                            }
                        ],
                        "body": {
                            "mode": "raw",
                            "raw": json.dumps({
                                "real_data": [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]],
                                "synthetic_data": [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1]],
                                "method": "tsne",
                                "params": {"perplexity": 30},
                                "name": "Postman Test - t-SNE"
                            }, indent=2)
                        },
                        "url": {
                            "raw": "{{baseUrl}}/api/v1/embed/generate",
                            "host": ["{{baseUrl}}"],
                            "path": ["api", "v1", "embed", "generate"]
                        }
                    }
                },
                {
                    "name": "Check Job Status",
                    "request": {
                        "method": "GET",
                        "header": [],
                        "url": {
                            "raw": "{{baseUrl}}/api/v1/embed/status/{{jobId}}",
                            "host": ["{{baseUrl}}"],
                            "path": ["api", "v1", "embed", "status", "{{jobId}}"]
                        }
                    }
                },
                {
                    "name": "Get Job Results",
                    "request": {
                        "method": "GET",
                        "header": [],
                        "url": {
                            "raw": "{{baseUrl}}/api/v1/embed/results/{{jobId}}",
                            "host": ["{{baseUrl}}"],
                            "path": ["api", "v1", "embed", "results", "{{jobId}}"]
                        }
                    }
                },
                {
                    "name": "Export Results (JSON)",
                    "request": {
                        "method": "GET",
                        "header": [],
                        "url": {
                            "raw": "{{baseUrl}}/api/v1/embed/export/{{jobId}}?format=json",
                            "host": ["{{baseUrl}}"],
                            "path": ["api", "v1", "embed", "export", "{{jobId}}"],
                            "query": [{"key": "format", "value": "json"}]
                        }
                    }
                },
                {
                    "name": "Get Metrics",
                    "request": {
                        "method": "GET",
                        "header": [],
                        "url": {
                            "raw": "{{baseUrl}}/api/v1/embed/metrics",
                            "host": ["{{baseUrl}}"],
                            "path": ["api", "v1", "embed", "metrics"]
                        }
                    }
                }
            ]
        }
        
        with open(self.docs_dir / "postman_collection.json", "w") as f:
            json.dump(collection, f, indent=2)
    
    def _generate_testing_guide(self):
        """Generate comprehensive testing guide."""
        
        testing_guide = """# MAVIS API Testing Guide

## Quick Start

### 1. Health Check
Verify the API is running:

```bash
curl -i http://localhost:8000/health
```

### 2. Basic Embedding Test
Test basic embedding generation:

```bash
curl -X POST "http://localhost:8000/api/v1/embed/generate" \\
     -H "Content-Type: application/json" \\
     -d '{
       "real_data": [[1, 2, 3], [4, 5, 6]],
       "synthetic_data": [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1]],
       "method": "umap"
     }'
```

## Test Scenarios

### Scenario 1: Small Dataset (Synchronous)
- Data: 10 samples, 3 features
- Expected: Immediate response with embeddings
- Test both UMAP and t-SNE

### Scenario 2: Large Dataset (Asynchronous)
- Data: 1000+ samples, 10+ features
- Expected: Job ID returned, status tracking required
- Test job status polling and result retrieval

### Scenario 3: Error Handling
- Invalid data formats
- Unsupported methods
- Missing required fields
- Data size limits

### Scenario 4: Parameter Validation
- Valid parameter ranges
- Invalid parameter types
- Method-specific parameters

### Scenario 5: Export Functionality
- Test all export formats (JSON, CSV, NPZ)
- Verify file integrity
- Check download headers

## Load Testing

### Using Apache Bench (ab)
```bash
# Test health endpoint
ab -n 1000 -c 10 http://localhost:8000/health

# Test embedding endpoint with POST data
ab -n 100 -c 5 -p test_data.json -T application/json \\
   http://localhost:8000/api/v1/embed/generate
```

### Using wrk
```bash
# Install wrk
sudo apt install wrk

# Basic load test
wrk -t10 -c100 -d30s http://localhost:8000/health

# POST request load test
wrk -t10 -c50 -d60s -s post_script.lua \\
    http://localhost:8000/api/v1/embed/generate
```

### Sample wrk POST script (post_script.lua)
```lua
wrk.method = "POST"
wrk.body = '{"real_data":[[1,2,3],[4,5,6]],"synthetic_data":[[1.1,2.1,3.1],[4.1,5.1,6.1]],"method":"umap"}'
wrk.headers["Content-Type"] = "application/json"
```

## Performance Benchmarks

### Expected Response Times
- Health check: < 10ms
- Small embedding (< 100 samples): < 1s
- Medium embedding (100-1000 samples): 1-10s
- Large embedding (1000+ samples): 10s+ (async recommended)

### Resource Usage
Monitor during testing:
```bash
# CPU and memory
htop

# Network
nethogs

# Application metrics
curl http://localhost:8000/api/v1/embed/metrics
```

## Automated Testing

### Python Test Script
```python
import requests
import time
import json

def test_api():
    base_url = "http://localhost:8000"
    
    # Health check
    response = requests.get(f"{base_url}/health")
    assert response.status_code == 200
    print("✓ Health check passed")
    
    # Small embedding test
    data = {
        "real_data": [[1, 2, 3], [4, 5, 6]],
        "synthetic_data": [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1]],
        "method": "umap"
    }
    
    response = requests.post(f"{base_url}/api/v1/embed/generate", json=data)
    assert response.status_code == 200
    result = response.json()
    
    if "job_id" in result:
        # Async mode - wait for completion
        job_id = result["job_id"]
        while True:
            status_response = requests.get(f"{base_url}/api/v1/embed/status/{job_id}")
            status = status_response.json()
            
            if status["status"] == "completed":
                results_response = requests.get(f"{base_url}/api/v1/embed/results/{job_id}")
                assert results_response.status_code == 200
                break
            elif status["status"] == "failed":
                raise Exception(f"Job failed: {status.get('error_message')}")
            
            time.sleep(1)
    else:
        # Sync mode - check results directly
        assert "real_embedding" in result
        assert "synthetic_embedding" in result
    
    print("✓ Embedding generation test passed")

if __name__ == "__main__":
    test_api()
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: 3.9
    
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
        pip install -r requirements-test.txt
    
    - name: Start API server
      run: |
        cd backend
        uvicorn main:app --host 0.0.0.0 --port 8000 &
        sleep 10
    
    - name: Run API tests
      run: |
        python test_api.py
        
    - name: Run load tests
      run: |
        ab -n 100 -c 10 http://localhost:8000/health
```

## Monitoring During Tests

### Key Metrics to Monitor
1. Response times
2. Memory usage
3. CPU utilization
4. Database connections
5. Error rates
6. Cache hit rates

### Monitoring Commands
```bash
# Real-time metrics
watch -n 1 'curl -s http://localhost:8000/api/v1/embed/metrics | jq .'

# System resources
watch -n 1 'free -h && ps aux | grep python | head -5'

# Network connections
watch -n 1 'ss -tuln | grep :8000'
```

## Troubleshooting

### Common Issues
1. **Port already in use**: Change port or kill existing process
2. **Database connection errors**: Check PostgreSQL status
3. **Memory errors**: Reduce data size or increase system memory
4. **Timeout errors**: Increase timeout settings or use async mode

### Debug Mode
Run API in debug mode for detailed error information:
```bash
cd backend
DEBUG=true uvicorn main:app --reload --log-level debug
```

### Log Analysis
```bash
# Application logs
tail -f /var/log/mavis/access.log
tail -f /var/log/mavis/error.log

# System logs
journalctl -u mavis-api -f
```
"""
        
        with open(self.docs_dir / "testing_guide.md", "w") as f:
            f.write(testing_guide)

def generate_complete_documentation(app: FastAPI):
    """Generate complete API documentation including all formats and guides."""
    generator = APIDocumentationGenerator(app)
    generator.save_documentation()
    return generator.docs_dir 