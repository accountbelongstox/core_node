#!/bin/bash

# Application Path Constants
# This file defines standard paths for core_node applications
# All paths are resolved relative to the script directory to ensure portability

# Get the directory where this script is located
APP_PATHS_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Calculate core_node root from this script's location
# Script location: /www/programing/core_node/scripts/shells/linux/common/app_paths.sh
# Target: /www/programing/core_node
CORE_NODE_ROOT_FROM_SCRIPTS="$(dirname "$(dirname "$(dirname "$(dirname "$APP_PATHS_SCRIPT_DIR")")")")"

# Laravel Main Application Path
# Default path: /www/programing/core_node/poly_apps/laravel_main
LARAVEL_MAIN_PATH="$CORE_NODE_ROOT_FROM_SCRIPTS/poly_apps/laravel_main"

# Verify path exists (optional check, can be disabled if path might not exist yet)
if [ ! -d "$LARAVEL_MAIN_PATH" ]; then
    # Path doesn't exist, but we still set the constant
    # This allows scripts to use the constant even if the directory doesn't exist yet
    :
fi

# Export constants for use in other scripts

