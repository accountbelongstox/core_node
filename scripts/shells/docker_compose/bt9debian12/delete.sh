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