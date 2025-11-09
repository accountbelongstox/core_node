#!/bin/bash
# Quick Start Script for Selenium Test
# Automatically detects test mode and runs appropriate script

echo "===================================================================="
echo " Selenium Test - Quick Start"
echo "===================================================================="
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if multi_browser_config.json exists
if [ -f "$SCRIPT_DIR/config/multi_browser_config.json" ]; then
    echo "[INFO] Found multi_browser_config.json"
    echo "[INFO] Running multi-browser concurrent test..."
    echo ""
    python3 "$SCRIPT_DIR/test_multi_browser.py"
else
    echo "[INFO] multi_browser_config.json not found"
    echo "[INFO] Running single browser test via launcher..."
    echo ""
    cd "$SCRIPT_DIR/../.."
    python3 pymain.py app=selenium_test
fi

echo ""
echo "===================================================================="
echo " Test Completed"
echo "===================================================================="
