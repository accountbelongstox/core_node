#!/bin/bash

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Laravel Main Install Script
# Installs dependencies for laravel_main application

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "[INFO] Installing dependencies for Laravel Main application"

# Change to app directory
cd "$APP_DIR" || {
    echo "[ERROR] Failed to change to app directory: $APP_DIR"
    exit 1
}

# Check if composer.json exists
if [ ! -f "composer.json" ]; then
    echo "[ERROR] composer.json not found in app directory"
    exit 1
fi

# Install PHP dependencies using composer
echo "[INFO] Installing PHP dependencies with composer..."
if ! composer install --no-dev --optimize-autoloader; then
    echo "[ERROR] Failed to install PHP dependencies"
    exit 1
fi

# Check if package.json exists for frontend dependencies
if [ -f "package.json" ]; then
    echo "[INFO] Installing frontend dependencies with npm..."
    if ! npm install; then
        echo "[ERROR] Failed to install frontend dependencies"
        exit 1
    fi
    
    echo "[INFO] Building frontend assets..."
    if ! npm run build; then
        echo "[ERROR] Failed to build frontend assets"
        exit 1
    fi
fi

# Generate application key if needed
if [ ! -f ".env" ]; then
    echo "[INFO] Creating .env file from .env.example..."
    cp ".env.example" ".env"
    php artisan key:generate
fi

echo "[SUCCESS] Dependencies installed successfully for laravel_main"
