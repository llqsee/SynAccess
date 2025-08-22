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
    npm install
fi

# Start backend in background
echo "🔧 Starting backend server..."
cd /app/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend in background
echo "🎨 Starting frontend server..."
cd /app/frontend
npm start &
FRONTEND_PID=$!

echo "✅ Services started!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
