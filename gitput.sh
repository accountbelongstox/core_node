#!/bin/bash
# Check if Python 3 is installed
if python3 --version >/dev/null 2>&1; then
    echo "Python 3 detected. Executing the script..."
    python3 ./scripts/auto_commit.py
else
    echo "Python 3 is not detected. Please install Python 3 and try again."
    exit 1
fi
