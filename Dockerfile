# Multi-stage build for MAVIS web application
FROM node:18-alpine AS frontend-build

# Install dependencies for node-gyp (if needed)
RUN apk add --no-cache python3 make g++

# Build frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --omit=dev
COPY frontend/ ./
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Backend stage (CPU or GPU)
FROM continuumio/miniconda3:24.7.1-0

# --- Build ARG to select environment file ---
ARG ENV_FILE=environment.yml
ARG GPU_ENABLED=false
ARG CONDA_ENV_NAME=mavis

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# GPU runtime is configured on the host/Compose side; no NVIDIA runtime install needed in the image

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
RUN echo "#!/bin/bash\n\
set -e\n\
source /opt/conda/etc/profile.d/conda.sh\n\
conda activate ${CONDA_ENV_NAME}\n\
cd /app\n\
/opt/conda/envs/${CONDA_ENV_NAME}/bin/python setup_database.py || true\n\
cd backend\n\
exec /opt/conda/envs/${CONDA_ENV_NAME}/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1" > start.sh && \
    chmod +x start.sh

# Create non-root user for security
RUN useradd -m -u 1000 mavis && \
    chown -R mavis:mavis /app
USER mavis

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=10s --retries=5 \
  CMD curl -fsS http://localhost:8000/api/v1/health || exit 1

CMD ["./start.sh"]

# ---
# Build for CPU:
# docker build --build-arg ENV_FILE=environment.yml -t mavis:cpu .
#
# Build for GPU:
# docker build --build-arg ENV_FILE=environment-gpu.yml --build-arg GPU_ENABLED=true --build-arg CONDA_ENV_NAME=mavis-gpu -t mavis:gpu .
# --- 