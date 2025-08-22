# Docker Deployment

MAVIS provides comprehensive Docker support for both CPU and GPU deployments, with production-ready configurations and optimized builds.

## Overview

The Docker implementation includes:
- **Multi-stage builds** for optimized image sizes
- **GPU support** with NVIDIA Container Runtime
- **Production-ready** nginx reverse proxy
- **Health checks** and monitoring
- **Security** with non-root user execution
- **Volume management** for data persistence

## Quick Start

### CPU Development
```bash
# Build and run CPU version
docker compose up --build

# Access the application
# Frontend: http://localhost:80 (via nginx)
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### GPU Development
```bash
# Build and run GPU version
ENV_FILE=environment-gpu.yml GPU_ENABLED=true ENABLE_GPU=true CONDA_ENV_NAME=mavis-gpu docker compose up --build

# Or use GPU override file
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

### Production Deployment
```bash
# Production with nginx
docker compose --profile production up --build

# GPU production
ENV_FILE=environment-gpu.yml GPU_ENABLED=true ENABLE_GPU=true CONDA_ENV_NAME=mavis-gpu docker compose --profile production up --build
```

## Docker Architecture

### Multi-Stage Build
```
Frontend Build Stage (Node.js)
├── Install dependencies
├── Build React application
└── Output: /app/frontend/build

Backend Stage (Conda)
├── Install system dependencies
├── Create conda environment
├── Copy backend code
├── Copy frontend build
└── Setup startup script
```

### Service Architecture
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│    Nginx    │───▶│  MAVIS App  │
│  Browser    │    │  Reverse    │    │  (FastAPI)  │
└─────────────┘    │   Proxy     │    └─────────────┘
                   └─────────────┘
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENV_FILE` | `environment.yml` | Conda environment file |
| `GPU_ENABLED` | `false` | Enable GPU support |
| `CONDA_ENV_NAME` | `mavis` | Conda environment name |
| `ENABLE_GPU` | `false` | Enable GPU acceleration |
| `LOG_LEVEL` | `INFO` | Application log level |
| `MEMORY_LIMIT` | `4G` | Container memory limit |
| `MEMORY_RESERVATION` | `1G` | Container memory reservation |

### Volume Mounts

| Volume | Purpose | Persistence |
|--------|---------|-------------|
| `mavis_data` | User data and uploads | Yes |
| `mavis_logs` | Application logs | Yes |
| `mavis_models` | Trained models | Yes |

## GPU Support

### Requirements
- **NVIDIA GPU** with CUDA support
- **NVIDIA Container Runtime** installed
- **Docker 19.03+** with GPU support

### GPU Environment
The GPU build uses `environment-gpu.yml` which includes:
- **CuPy** for GPU acceleration
- **NVIDIA ML Python** for GPU monitoring
- **CUDA 12.x** support

### GPU Runtime Configuration
```yaml
# docker-compose.gpu.yml
services:
  mavis-app:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: ${GPU_COUNT:-1}
              capabilities: [gpu]
    runtime: ${GPU_RUNTIME:-nvidia}
```

## Production Deployment

### Nginx Configuration
The production setup includes nginx with:
- **Reverse proxy** to FastAPI backend
- **Static file serving** for React build
- **Rate limiting** and security headers
- **Gzip compression** for performance
- **SSL/TLS support** (commented out)

### Security Features
- **Non-root user** execution
- **Security headers** in nginx
- **Rate limiting** on API endpoints
- **Resource limits** and reservations

### Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Build Optimization

### .dockerignore
The `.dockerignore` file excludes:
- **Development files** (`.git`, `docs/`, etc.)
- **Node modules** and Python cache
- **Test files** and coverage reports
- **Temporary files** and logs

### Multi-Stage Benefits
- **Smaller final image** (no build tools)
- **Faster builds** (cached stages)
- **Security** (no build dependencies in production)

## Monitoring and Logging

### Health Monitoring
- **Container health checks** every 30s
- **API endpoint monitoring** via `/api/v1/health`
- **Nginx health checks** for production

### Logging
- **Application logs** in `mavis_logs` volume
- **Nginx access/error logs** in production
- **Structured logging** with configurable levels

## Troubleshooting

### Common Issues

#### 1. GPU Not Available
```bash
# Check NVIDIA runtime
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu20.04 nvidia-smi

# Verify Docker GPU support
docker info | grep -i runtime
```

#### 2. Memory Issues
```bash
# Increase memory limits
MEMORY_LIMIT=8G MEMORY_RESERVATION=2G docker compose up --build
```

#### 3. Port Conflicts
```bash
# Use different ports
docker compose up --build -p 8080:8000
```

#### 4. Permission Issues
```bash
# Fix volume permissions
sudo chown -R 1000:1000 ./data ./logs ./models
```

### Debug Mode
```bash
# Run with debug logging
LOG_LEVEL=DEBUG docker compose up --build

# Access container shell
docker compose exec mavis-app bash
```

## Performance Tuning

### Memory Optimization
- **Adjust memory limits** based on dataset size
- **Monitor memory usage** with `docker stats`
- **Use GPU memory** for large computations

### Network Optimization
- **Use host networking** for local development
- **Configure nginx caching** for static assets
- **Enable gzip compression** for API responses

### Storage Optimization
- **Use named volumes** for data persistence
- **Configure volume drivers** for production
- **Monitor disk usage** and cleanup old data

## Security Considerations

### Container Security
- **Non-root user** execution
- **Read-only root filesystem** (optional)
- **Security scanning** with tools like Trivy

### Network Security
- **Firewall rules** for production
- **SSL/TLS termination** at nginx
- **API rate limiting** and DDoS protection

### Data Security
- **Encrypted volumes** for sensitive data
- **Backup strategies** for persistent data
- **Access controls** for shared volumes

## Backup and Recovery

### Data Backup
```bash
# Backup volumes
docker run --rm -v mavis_data:/data -v $(pwd):/backup alpine tar czf /backup/mavis_data_backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v mavis_data:/data -v $(pwd):/backup alpine tar xzf /backup/mavis_data_backup.tar.gz -C /data
```

### Configuration Backup
```bash
# Export configuration
docker compose config > docker-compose.backup.yml

# Restore configuration
docker compose -f docker-compose.backup.yml up --build
```

## Scaling

### Horizontal Scaling
```bash
# Scale backend service
docker compose up --scale mavis-app=3 --build

# Use load balancer
docker compose -f docker-compose.yml -f docker-compose.scale.yml up --build
```

### Resource Scaling
```bash
# Increase resources
MEMORY_LIMIT=8G CPU_LIMIT=4.0 docker compose up --build

# GPU scaling
GPU_COUNT=2 docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

## Best Practices

### Development
- **Use volume mounts** for code changes
- **Enable debug logging** for troubleshooting
- **Use GPU override** for GPU development

### Production
- **Use production profile** with nginx
- **Configure resource limits** appropriately
- **Enable monitoring** and alerting
- **Regular backups** of persistent data

### Security
- **Scan images** for vulnerabilities
- **Use secrets management** for sensitive data
- **Regular updates** of base images
- **Network segmentation** in production
