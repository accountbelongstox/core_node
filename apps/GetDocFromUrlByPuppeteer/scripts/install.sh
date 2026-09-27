#!/bin/bash

# GetDocFromUrlByPuppeteer NCore App Install Script
# Hardcoded install script for GetDocFromUrlByPuppeteer application

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$APP_DIR")")"
COMMON_INSTALL="$PROJECT_ROOT/scripts/unified_manager/ncore_common_install.sh"

echo "[INFO] Installing dependencies for GetDocFromUrlByPuppeteer application"

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

# GetDocFromUrlByPuppeteer-specific installation logic (if any)
echo "[INFO] GetDocFromUrlByPuppeteer-specific installation completed"

exit 0
