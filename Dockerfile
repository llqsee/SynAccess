# Multi-stage build for MAVIS web application
FROM node:18-alpine AS frontend-build

# Build frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --omit=dev
COPY frontend/ ./
RUN npm run build

# Backend stage (CPU or GPU)
FROM continuumio/miniconda3:latest

# --- Build ARG to select environment file ---
ARG ENV_FILE=environment.yml
ARG GPU_ENABLED=false

# Install system dependencies and Node.js
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install NVIDIA runtime if GPU is enabled
RUN if [ "$GPU_ENABLED" = "true" ]; then \
    apt-get update && apt-get install -y \
    nvidia-container-runtime \
    nvidia-container-toolkit \
    && rm -rf /var/lib/apt/lists/*; \
    fi

RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Copy and install the selected environment file
COPY ${ENV_FILE} /tmp/environment.yml
RUN conda env create -f /tmp/environment.yml && \
    conda clean -afy

# Copy backend code
WORKDIR /app
COPY backend/ ./backend/
COPY setup_database.py ./

# Copy built frontend
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Create startup script with proper conda activation
RUN echo '#!/bin/bash\n\
set -e\n\
source /opt/conda/etc/profile.d/conda.sh\n\
conda activate mavis\n\
cd /app\n\
python setup_database.py\n\
cd backend\n\
exec uvicorn main:app --host 0.0.0.0 --port 8000' > start.sh && \
    chmod +x start.sh

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["./start.sh"]

# ---
# Build for CPU:
# docker build --build-arg ENV_FILE=environment.yml -t mavis:cpu .
#
# Build for GPU:
# docker build --build-arg ENV_FILE=environment-gpu.yml --build-arg GPU_ENABLED=true -t mavis:gpu .
# --- 