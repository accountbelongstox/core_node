#!/bin/bash

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SCRIPT_ROOT_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$(dirname "$(dirname "$BASE_DIR")")")")")")
main_script="$SCRIPT_ROOT_DIR/main.js"

# Check if Node.js is installed
if command -v node &> /dev/null; then
    # Print the Node.js version
    echo "Node.js is installed."
    node_version=$(node -v)
    echo "Node.js version: $node_version"

    # Execute the main.js script with the provided arguments
    if [ -f "$main_script" ]; then
        echo sudo node "$main_script" role=server action=auto_install app=deploy
        sudo node "$main_script" role=server action=auto_install app=deploy
        echo sudo node "$main_script" role=server action=init app=deploy
        sudo node "$main_script" role=server action=init app=deploy
    else
        echo "main.js not found at $main_script."
    fi
else
    echo "Node.js is not installed. Please install Node.js to proceed."
fi
