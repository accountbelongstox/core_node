#!/bin/bash
# Device Sync - Background Launcher (Linux)
# This script starts Device Sync in background mode (detached from console)

echo "Starting Device Sync in background..."

# Get Python executable
PYTHON_EXE="python3"

# Check if python3 exists
if ! command -v python3 &> /dev/null; then
    if command -v python &> /dev/null; then
        PYTHON_EXE="python"
    else
        echo "Error: Python not found"
        exit 1
    fi
fi

echo "Using: $PYTHON_EXE"

# Start Device Sync in background (nohup method)
nohup $PYTHON_EXE -m pycore.pyutils.launcher.device_sync > /dev/null 2>&1 &

echo "Device Sync started in background"
echo "Process ID: $!"
echo ""
echo "You can safely close this terminal now."
echo ""
echo "To stop Device Sync:"
echo "  python3 -c \"from pycore.pyutils.launcher.device_sync.ipc_server import send_shutdown_command; send_shutdown_command()\""
echo ""
