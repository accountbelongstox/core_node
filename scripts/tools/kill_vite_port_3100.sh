#!/bin/bash
# Kill all processes on port 3100 (vite)

echo "Finding processes on port 3100..."
PIDS=$(lsof -t -i:3100 2>/dev/null)

if [ -z "$PIDS" ]; then
    echo "No process found on port 3100"
    exit 0
fi

echo "Found PIDs: $PIDS"

for PID in $PIDS; do
    echo "Killing PID $PID..."
    kill -9 $PID 2>/dev/null && echo "  Killed $PID" || echo "  Failed to kill $PID (may need sudo)"
done

sleep 1
echo ""
echo "Checking port 3100 again..."
lsof -i:3100 2>/dev/null || echo "Port 3100 is now free"
