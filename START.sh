#!/bin/bash

# Ridesathi - Quick Start Guide
# This script helps you quickly set up and start the application

echo "======================================"
echo "  🚕 RIDESATHI - QUICK START"
echo "======================================"
echo ""

# Step 1: Check if MongoDB is running
echo "1️⃣  Checking MongoDB..."
if pgrep -x "mongod" > /dev/null; then
    echo "✓ MongoDB is running"
else
    echo "⚠️  MongoDB is not running. Please start MongoDB first:"
    echo "   Windows: Press Windows key, search 'MongoDB', start MongoDB service"
    echo "   Mac/Linux: Run 'mongod' in a new terminal"
    read -p "Press Enter after starting MongoDB..."
fi

echo ""

# Step 2: Install backend dependencies
echo "2️⃣  Installing backend dependencies..."
cd backend
npm install
if [ $? -eq 0 ]; then
    echo "✓ Backend dependencies installed"
else
    echo "✗ Error installing backend dependencies"
    exit 1
fi

echo ""

# Step 3: Start backend server
echo "3️⃣  Starting backend server..."
echo "   Backend will run on: http://localhost:5000"
echo "   Press Ctrl+C to stop"
echo ""

npm start &
BACKEND_PID=$!

sleep 3

echo ""
echo "======================================"
echo "✅ SETUP COMPLETE!"
echo "======================================"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Open your browser and go to:"
echo "   http://localhost:8000 (if using Python server)"
echo "   or just open the frontend/index.html file"
echo ""
echo "2. Register an account (User or Driver)"
echo "3. Start booking or accepting rides!"
echo ""
echo "📚 API Documentation:"
echo "   Backend API: http://localhost:5000"
echo "   Health Check: http://localhost:5000/health"
echo "   Test Route: http://localhost:5000/api/test"
echo ""
echo "⚙️  Backend running with PID: $BACKEND_PID"
echo ""
echo "Press Ctrl+C to stop the backend server"
echo "======================================"

wait $BACKEND_PID
