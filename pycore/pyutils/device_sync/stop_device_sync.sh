#!/bin/bash
# Device Sync - Stop Script (Linux)
# This script stops the running Device Sync instance

echo "Stopping Device Sync..."

# Method 1: Try IPC shutdown command
echo "Trying IPC shutdown command..."
python3 -c "from pycore.pyutils.launcher.device_sync.ipc_server import send_shutdown_command; send_shutdown_command()" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "Shutdown command sent via IPC"
    sleep 1
else
    echo "IPC command failed, trying process kill..."

    # Method 2: Find and kill process
    PID=$(pgrep -f "pycore.pyutils.launcher.device_sync")

    if [ -z "$PID" ]; then
        echo "Device Sync is not running"
        exit 0
    fi

    echo "Found Device Sync process: $PID"
    echo "Sending SIGTERM..."
    kill $PID

    # Wait for process to exit
    sleep 2

    # Check if still running
    if pgrep -f "pycore.pyutils.launcher.device_sync" > /dev/null; then
        echo "Process still running, sending SIGKILL..."
        kill -9 $PID
    fi
fi

echo "Device Sync stopped"
