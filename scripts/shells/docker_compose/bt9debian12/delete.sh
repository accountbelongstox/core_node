#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to delete files and directories
delete_items() {
    local item="$1"
    if [ -e "$item" ]; then
        echo "Deleting: $item"
        rm -rf "$item"
    else
        echo "Warning: $item does not exist"
    fi
}

# List of files and directories to delete
delete_list=(
    "/www/server"
    "/www/wwwroot"
    "/www/backup"
    "/root/.pip"
    "/root/.cache"
    "/root/.local"
    "/usr/local/python"
    "/tmp/*"
)

# Execute deletions
echo "Starting deletion process..."
for item in "${delete_list[@]}"; do
    delete_items "$item"
done

echo "Deletion process completed" 