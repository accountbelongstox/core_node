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

# Nuxt Main Install Script
# Installs dependencies for nuxt_main application

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "[INFO] Installing dependencies for Nuxt Main application"

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

# Install dependencies using yarn
echo "[INFO] Installing dependencies with yarn..."
if yarn install; then
    echo "[SUCCESS] Dependencies installed successfully for nuxt_main"
else
    echo "[ERROR] Failed to install dependencies for nuxt_main"
    exit 1
fi
