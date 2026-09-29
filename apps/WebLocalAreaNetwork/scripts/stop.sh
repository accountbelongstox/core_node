#!/bin/bash

# WebLocalAreaNetwork NCore App Stop Script
# Hardcoded stop script for WebLocalAreaNetwork application

echo "[INFO] Stopping NCore application: WebLocalAreaNetwork"

# Stop processes matching the WebLocalAreaNetwork app
PIDS=$(pgrep -f "node.*app=WebLocalAreaNetwork")

if [ -n "$PIDS" ]; then
    echo "[INFO] Found WebLocalAreaNetwork processes: $PIDS"
    for PID in $PIDS; do
        echo "[INFO] Stopping process PID: $PID"
        kill -TERM "$PID"
    done

    # Wait a moment and force kill if still running
    sleep 2
    REMAINING_PIDS=$(pgrep -f "node.*app=WebLocalAreaNetwork")
    if [ -n "$REMAINING_PIDS" ]; then
        echo "[INFO] Force killing remaining processes: $REMAINING_PIDS"
        for PID in $REMAINING_PIDS; do
            kill -KILL "$PID"
        done
    fi

    echo "[SUCCESS] WebLocalAreaNetwork stopped successfully"
else
    echo "[INFO] No running processes found for WebLocalAreaNetwork"
fi

exit 0
