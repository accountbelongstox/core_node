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
export LARAVEL_MAIN_PATH
export CORE_NODE_ROOT_FROM_SCRIPTS

