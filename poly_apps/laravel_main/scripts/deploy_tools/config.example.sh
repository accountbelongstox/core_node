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

# Deployment Configuration Example
# Copy this file to config.sh and customize for your environment

# Application settings
export APP_NAME="laravel_main"
export SERVICE_NAME="ncore-laravel_main"

# Database settings
export DB_CONNECTION="sqlite"
export DB_DIR="/mnt/d/wwwroot/laravel_main/laravel_db"
export DB_FILE="$DB_DIR/database.sqlite"

# Project settings
export PROJECT_ROOT="/mnt/d/programing/core_node"

# Deployment mode: production or development
export DEPLOY_MODE="development"

# Server settings
export APP_SERVER_HOST="0.0.0.0"
export APP_SERVER_PORT="8000"

# File permissions settings
export APP_USER="www"
export APP_GROUP="www"

# Enable debug output
export DEBUG_MODE="1"

# Log file location
export LOG_FILE="/var/log/ncore-services/$SERVICE_NAME.log"

# Minimum disk space required (in MB)
export MIN_DISK_SPACE="100"

# System package manager
export PKG_MANAGER="apt"

# PHP version (optional, leave empty for latest)
export PHP_VERSION=""

# Python version (optional, leave empty for latest)
export PYTHON_VERSION="3"
