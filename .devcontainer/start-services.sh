#!/bin/bash
set -e

echo "🚀 Starting MAVIS services in devcontainer..."

# Activate conda environment
source /opt/conda/etc/profile.d/conda.sh
conda activate mavis

# Setup database
echo "📊 Setting up database..."
cd /app
python setup_database.py || true

# Install frontend dependencies if needed
echo "📦 Installing frontend dependencies..."
cd /app/frontend
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Start backend in background
echo "🔧 Starting backend server..."
cd /app/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait a moment for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is running
if ! curl -s http://localhost:8000/api/v1/health > /dev/null; then
    echo "❌ Backend failed to start"
    exit 1
fi
echo "✅ Backend is running on port 8000"

# Start frontend in background
echo "🎨 Starting frontend server..."
cd /app/frontend
export PORT=3000
npm start &
FRONTEND_PID=$!

echo "✅ Services started!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"

# Keep the script running and monitor processes
while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend process died"
        exit 1
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend process died"
        exit 1
    fi
    sleep 10
done
