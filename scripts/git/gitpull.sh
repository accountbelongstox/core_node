#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Print information
echo "Workspace Directory: $WORKSPACE_DIR"
echo "Script Directory: $SCRIPT_DIR"
echo "Python Script: $SCRIPT_DIR/git/gliunxpull.py"
echo ""

# Change to workspace directory
cd "$WORKSPACE_DIR"
git add . 
git commit -m "server" 
git pull --no-ff