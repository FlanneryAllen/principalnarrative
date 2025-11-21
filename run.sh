#!/bin/bash
# Run the Principal Narrative API

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run the API
echo ""
echo "Starting Principal Narrative API..."
echo "API docs available at: http://localhost:8000/docs"
echo ""

uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
