#!/bin/bash

# VoiceClientAndCaddy NCore App Stop Script
# Hardcoded stop script for VoiceClientAndCaddy application

echo "[INFO] Stopping NCore application: VoiceClientAndCaddy"

# Stop processes matching the VoiceClientAndCaddy app
PIDS=$(pgrep -f "node.*app=VoiceClientAndCaddy")

if [ -n "$PIDS" ]; then
    echo "[INFO] Found VoiceClientAndCaddy processes: $PIDS"
    for PID in $PIDS; do
        echo "[INFO] Stopping process PID: $PID"
        kill -TERM "$PID"
    done

    # Wait a moment and force kill if still running
    sleep 2
    REMAINING_PIDS=$(pgrep -f "node.*app=VoiceClientAndCaddy")
    if [ -n "$REMAINING_PIDS" ]; then
        echo "[INFO] Force killing remaining processes: $REMAINING_PIDS"
        for PID in $REMAINING_PIDS; do
            kill -KILL "$PID"
        done
    fi

    echo "[SUCCESS] VoiceClientAndCaddy stopped successfully"
else
    echo "[INFO] No running processes found for VoiceClientAndCaddy"
fi

exit 0
