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

# Change to the script's directory and store the absolute path
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Laravel refresh process..."

# Clear Laravel cache
echo "Clearing caches..."
php "$SCRIPT_DIR/artisan" cache:clear
php "$SCRIPT_DIR/artisan" config:clear
php "$SCRIPT_DIR/artisan" route:clear
php "$SCRIPT_DIR/artisan" view:clear

# Clear compiled files
echo "Clearing compiled files..."
php "$SCRIPT_DIR/artisan" clear-compiled

# Try to cache config and routes
echo "Caching configuration and routes..."
php "$SCRIPT_DIR/artisan" config:cache || echo "Warning: Could not cache configuration"
php "$SCRIPT_DIR/artisan" route:cache || echo "Warning: Could not cache routes"

# Optimize the application
echo "Optimizing application..."
php "$SCRIPT_DIR/artisan" optimize || echo "Warning: Could not optimize application"

echo "Laravel refresh process completed!"
