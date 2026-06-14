#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
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
