#!/bin/bash
# OKX Price Monitor - Web Server Launcher (Linux/macOS)

echo "========================================"
echo "OKX Price Monitor - Web Interface"
echo "========================================"
echo ""
echo "Starting web server on port 58888..."
echo "Browser will open automatically..."
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

python3 "${SCRIPT_DIR}/start_web.py"
