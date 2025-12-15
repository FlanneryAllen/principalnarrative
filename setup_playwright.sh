#!/bin/bash
# Playwright Browser Installation Script
# Run this after installing requirements.txt

echo "📦 Installing Playwright browsers..."
echo ""
echo "This will download Chromium browser for JavaScript rendering."
echo "Download size: ~300MB"
echo ""

# Install Playwright browsers
python3 -m playwright install chromium

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Playwright setup complete!"
    echo ""
    echo "You can now analyze JavaScript-heavy websites (React, Vue, Angular, etc.)"
    echo "Use the '🎭 Render JavaScript' checkbox in the dashboard."
else
    echo ""
    echo "❌ Installation failed. Make sure you've run: pip install -r requirements.txt"
    exit 1
fi
