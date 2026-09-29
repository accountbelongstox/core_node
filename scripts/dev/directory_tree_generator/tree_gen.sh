#!/bin/bash

# Get current script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/tree_generator.py"

# Check if Python script exists
if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo "Error: Python script not found: $PYTHON_SCRIPT"
    exit 1
fi

# Make Python script executable if needed
chmod +x "$PYTHON_SCRIPT"

# Execute Python script with all arguments
python3 "$PYTHON_SCRIPT" "$@"

# Check execution result
if [ $? -ne 0 ]; then
    echo "Error: Script execution failed"
    exit 1
fi

echo ""
echo "Tree generation completed successfully."
