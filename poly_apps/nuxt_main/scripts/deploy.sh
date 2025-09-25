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

# Nuxt Main Deploy Script
# Deploys nuxt_main application in production mode

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
SUB_APP="${1:-dev}"

echo "[INFO] Deploying Nuxt Main application"

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

# Set production environment
export NODE_ENV=production

echo "[INFO] Building Nuxt application for production..."

# Build the appropriate sub-app
case "${SUB_APP,,}" in
    "example")
        echo "[INFO] Building nuxt_main:example for production..."
        yarn build:example
        if [ $? -eq 0 ]; then
            echo "[INFO] Starting nuxt_main:example in production mode..."
            yarn start:example
        fi
        ;;
    "codemart")
        echo "[INFO] Building nuxt_main:codemart for production..."
        yarn build:codemart
        if [ $? -eq 0 ]; then
            echo "[INFO] Starting nuxt_main:codemart in production mode..."
            yarn start:codemart
        fi
        ;;
    "dev")
        echo "[INFO] Building nuxt_main:dev for production..."
        yarn build
        if [ $? -eq 0 ]; then
            echo "[INFO] Starting nuxt_main:dev in production mode..."
            yarn start
        fi
        ;;
    "admin")
        echo "[INFO] Building nuxt_main:admin for production..."
        yarn build:admin
        if [ $? -eq 0 ]; then
            echo "[INFO] Starting nuxt_main:admin in production mode..."
            yarn start:admin
        fi
        ;;
    "dashboard")
        echo "[INFO] Building nuxt_main:dashboard for production..."
        yarn build:dashboard
        if [ $? -eq 0 ]; then
            echo "[INFO] Starting nuxt_main:dashboard in production mode..."
            yarn start:dashboard
        fi
        ;;
    *)
        echo "[ERROR] Unknown sub-app: $SUB_APP"
        echo "[INFO] Available sub-apps: example, codemart, dev, admin, dashboard"
        exit 1
        ;;
esac

exit 0
