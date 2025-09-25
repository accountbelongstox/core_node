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

# DocumentOffline NCore App Install Script
# Hardcoded install script for DocumentOffline application

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$APP_DIR")")"
COMMON_INSTALL="$PROJECT_ROOT/scripts/unified_manager/ncore_common_install.sh"

echo "[INFO] Installing dependencies for DocumentOffline application"

# Call common install script first
if [ -f "$COMMON_INSTALL" ]; then
    echo "[INFO] Calling common NCore install script..."
    if bash "$COMMON_INSTALL"; then
        echo "[INFO] Common install completed successfully"
    else
        echo "[ERROR] Common install script failed"
        exit 1
    fi
else
    echo "[ERROR] Common install script not found: $COMMON_INSTALL"
    exit 1
fi

# DocumentOffline-specific installation logic (if any)
echo "[INFO] DocumentOffline-specific installation completed"

exit 0
