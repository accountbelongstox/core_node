#!/bin/bash

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# DevOps NCore App Stop Script
# Hardcoded stop script for DevOps application

echo "[INFO] Stopping NCore application: DevOps"

# Stop processes matching the DevOps app
PIDS=$(pgrep -f "node.*app=DevOps")

if [ -n "$PIDS" ]; then
    echo "[INFO] Found DevOps processes: $PIDS"
    for PID in $PIDS; do
        echo "[INFO] Stopping process PID: $PID"
        kill -TERM "$PID"
    done
    
    # Wait a moment and force kill if still running
    sleep 2
    REMAINING_PIDS=$(pgrep -f "node.*app=DevOps")
    if [ -n "$REMAINING_PIDS" ]; then
        echo "[INFO] Force killing remaining processes: $REMAINING_PIDS"
        for PID in $REMAINING_PIDS; do
            kill -KILL "$PID"
        done
    fi
    
    echo "[SUCCESS] DevOps stopped successfully"
else
    echo "[INFO] No running processes found for DevOps"
fi

exit 0
