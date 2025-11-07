#!/bin/bash
# pyMatrix Webview Desktop Launcher
# Launches pyMatrix with native desktop window and system tray icon

echo "============================================================"
echo " pyMatrix - Webview Desktop Mode Launcher"
echo "============================================================"
echo ""
echo "Starting pyMatrix with:"
echo "- Native desktop window"
echo "- System tray icon"
echo "- Embedded webview (no browser)"
echo ""
echo "Please wait..."
echo ""

# Get script directory and navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/../.."

# Launch pyMatrix with webview
python poly_apps/pyMatrix/main.py --webview
