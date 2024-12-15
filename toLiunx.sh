#!/bin/bash

# Check if dos2unix is installed
if ! command -v dos2unix &> /dev/null; then
    echo "Error: dos2unix is not installed. Installing now..."
    sudo apt update && sudo apt install dos2unix
fi

# Get the current directory
TARGET_DIR=$(pwd)

# Convert all files in the current directory and subdirectories to Linux format
find "$TARGET_DIR" -type f -exec dos2unix {} \;

# Print completion message
echo "All files in $TARGET_DIR have been converted to Linux format (LF)."
