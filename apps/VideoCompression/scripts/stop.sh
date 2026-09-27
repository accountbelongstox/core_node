#!/bin/bash

# VideoCompression NCore App Stop Script
# Hardcoded stop script for VideoCompression application

echo "[INFO] Stopping NCore application: VideoCompression"

# Stop processes matching the VideoCompression app
PIDS=$(pgrep -f "node.*app=VideoCompression")

if [ -n "$PIDS" ]; then
    echo "[INFO] Found VideoCompression processes: $PIDS"
    for PID in $PIDS; do
        echo "[INFO] Stopping process PID: $PID"
        kill -TERM "$PID"
    done

    # Wait a moment and force kill if still running
    sleep 2
    REMAINING_PIDS=$(pgrep -f "node.*app=VideoCompression")
    if [ -n "$REMAINING_PIDS" ]; then
        echo "[INFO] Force killing remaining processes: $REMAINING_PIDS"
        for PID in $REMAINING_PIDS; do
            kill -KILL "$PID"
        done
    fi

    echo "[SUCCESS] VideoCompression stopped successfully"
else
    echo "[INFO] No running processes found for VideoCompression"
fi

exit 0
