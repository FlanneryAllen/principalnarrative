#!/bin/bash
# Start the Narrative Agent API with Dashboard

echo "🚀 Starting Principal Narrative API with Dashboard..."
echo ""
echo "Dashboard will be available at:"
echo "  📊 http://localhost:8000/dashboard"
echo ""
echo "API Documentation:"
echo "  📖 http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd "$(dirname "$0")"
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
