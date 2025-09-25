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

# Nuxt Main Start Script
# Starts nuxt_main application with sub-app selection

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
SUB_APP="${1:-}"

echo "[INFO] Starting Nuxt Main application"

# Change to app directory
cd "$APP_DIR" || {
    echo "[ERROR] Failed to change to app directory: $APP_DIR"
    exit 1
}

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "[ERROR] package.json not found in app directory"
    exit 1
fi

# Determine which sub-app to start
if [ -z "$SUB_APP" ]; then
    echo "[INFO] Available sub-apps:"
    echo "  example  - yarn dev:example"
    echo "  codemart - yarn dev:codemart"
    echo "  dev      - yarn dev"
    echo "  admin    - yarn dev:admin"
    echo "  dashboard- yarn dev:dashboard"
    
    read -p "Enter sub-app name (default: dev): " SUB_APP
    if [ -z "$SUB_APP" ]; then
        SUB_APP="dev"
    fi
fi

# Start the appropriate sub-app
case "${SUB_APP,,}" in
    "example")
        echo "[INFO] Starting nuxt_main:example..."
        yarn dev:example
        ;;
    "codemart")
        echo "[INFO] Starting nuxt_main:codemart..."
        yarn dev:codemart
        ;;
    "dev")
        echo "[INFO] Starting nuxt_main:dev..."
        yarn dev
        ;;
    "admin")
        echo "[INFO] Starting nuxt_main:admin..."
        yarn dev:admin
        ;;
    "dashboard")
        echo "[INFO] Starting nuxt_main:dashboard..."
        yarn dev:dashboard
        ;;
    *)
        echo "[ERROR] Unknown sub-app: $SUB_APP"
        echo "[INFO] Available sub-apps: example, codemart, dev, admin, dashboard"
        exit 1
        ;;
esac
