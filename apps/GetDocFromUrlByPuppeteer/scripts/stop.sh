#!/bin/bash

# GetDocFromUrlByPuppeteer NCore App Stop Script
# Hardcoded stop script for GetDocFromUrlByPuppeteer application

echo "[INFO] Stopping NCore application: GetDocFromUrlByPuppeteer"

# Stop processes matching the GetDocFromUrlByPuppeteer app
PIDS=$(pgrep -f "node.*app=GetDocFromUrlByPuppeteer")

if [ -n "$PIDS" ]; then
    echo "[INFO] Found GetDocFromUrlByPuppeteer processes: $PIDS"
    for PID in $PIDS; do
        echo "[INFO] Stopping process PID: $PID"
        kill -TERM "$PID"
    done

    # Wait a moment and force kill if still running
    sleep 2
    REMAINING_PIDS=$(pgrep -f "node.*app=GetDocFromUrlByPuppeteer")
    if [ -n "$REMAINING_PIDS" ]; then
        echo "[INFO] Force killing remaining processes: $REMAINING_PIDS"
        for PID in $REMAINING_PIDS; do
            kill -KILL "$PID"
        done
    fi

    echo "[SUCCESS] GetDocFromUrlByPuppeteer stopped successfully"
else
    echo "[INFO] No running processes found for GetDocFromUrlByPuppeteer"
fi

exit 0
