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

# Laravel Main Deployment Script - Entry Point
# This script serves as the main entry point for Laravel deployment
# All actual functionality is delegated to modules in deploy_tools directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_TOOLS_DIR="$SCRIPT_DIR/deploy_tools"
APP_NAME="laravel_main"
SERVICE_NAME="ncore-$APP_NAME"
LOG_FILE="/var/log/ncore-services/$SERVICE_NAME.log"

# Load module functions
if [ -f "$DEPLOY_TOOLS_DIR/environment_checker.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/environment_checker.sh"
    echo "Environment checker module loaded"
else
    echo "ERROR: environment_checker module not found" >&2
    exit 1
fi

if [ -f "$DEPLOY_TOOLS_DIR/system_dependencies.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/system_dependencies.sh"
    echo "System dependencies module loaded"
else
    echo "ERROR: system_dependencies module not found" >&2
    exit 1
fi

if [ -f "$DEPLOY_TOOLS_DIR/permission_manager.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/permission_manager.sh"
    echo "Permission manager module loaded"
else
    echo "ERROR: permission_manager module not found" >&2
    exit 1
fi

if [ -f "$DEPLOY_TOOLS_DIR/environment_setup.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/environment_setup.sh"
    echo "Environment setup module loaded"
else
    echo "ERROR: environment_setup module not found" >&2
    exit 1
fi

if [ -f "$DEPLOY_TOOLS_DIR/database_manager.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/database_manager.sh"
    echo "Database manager module loaded"
else
    echo "ERROR: database_manager module not found" >&2
    exit 1
fi

if [ -f "$DEPLOY_TOOLS_DIR/deployment_helper.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/deployment_helper.sh"
    echo "Deployment helper module loaded"
else
    echo "ERROR: deployment_helper module not found" >&2
    exit 1
fi

if [ -f "$DEPLOY_TOOLS_DIR/safety_checker.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/safety_checker.sh"
    echo "Safety checker module loaded"
else
    echo "ERROR: safety_checker module not found" >&2
    exit 1
fi

if [ -f "$DEPLOY_TOOLS_DIR/nginx_integrator.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/nginx_integrator.sh"
    echo "Nginx integrator module loaded"
else
    echo "ERROR: nginx_integrator module not found" >&2
    exit 1
fi

if [ -f "$DEPLOY_TOOLS_DIR/compatibility_checker.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/compatibility_checker.sh"
    echo "Compatibility checker module loaded"
else
    echo "ERROR: compatibility_checker module not found" >&2
    exit 1
fi

if [ -f "$DEPLOY_TOOLS_DIR/smart_environment_setup.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/smart_environment_setup.sh"
    echo "Smart environment setup module loaded"
else
    echo "ERROR: smart_environment_setup module not found" >&2
    exit 1
fi

# Get environment-specific directories
DB_DIR=$(get_database_directory)
PROJECT_ROOT=$(get_project_root)
DB_FILE="$DB_DIR/database.sqlite"
ENV_FILE="$APP_DIR/.env"
ENV_EXAMPLE="$APP_DIR/.env.example"
INIT_MARKER="$APP_DIR/.laravel_initialized"

# Print initial configuration
echo "Deployment Configuration:"
echo "  SCRIPT_DIR: $SCRIPT_DIR"
echo "  APP_DIR: $APP_DIR"
echo "  APP_NAME: $APP_NAME"
echo "  SERVICE_NAME: $SERVICE_NAME"
echo "  LOG_FILE: $LOG_FILE"
echo "  DB_DIR: $DB_DIR"
echo "  DB_FILE: $DB_FILE"
echo "  ENV_FILE: $ENV_FILE"
echo "  PROJECT_ROOT: $PROJECT_ROOT"

echo ""
echo "Starting Laravel Main Application Deployment (SAFE MODE)"
echo ""

# Run Laravel 12 compatibility check first
echo ""
echo "Performing Laravel 12 compatibility check..."
perform_full_compatibility_check

echo ""
echo "Running smart environment setup..."
echo ""

# Run smart auto-setup before proceeding
run_smart_setup

echo ""
echo "Continuing with deployment..."
echo ""

# Run comprehensive environment check
comprehensive_environment_check

# Change to application directory
cd "$APP_DIR" || {
    echo "ERROR: Failed to change to app directory: $APP_DIR" >&2
    exit 1
}

# Run pre-deployment checks
if ! pre_deployment_check; then
    echo "WARNING: Pre-deployment checks found issues (continuing...)" >&2
fi

# Verify deployment safety
verify_deployment_safety "$DB_FILE"

# Install system dependencies and tools
echo ""
echo "Installing system dependencies..."
install_archive_tools || true
fix_git_safe_directory
fix_script_permissions
verify_git

# Ensure PHP and extensions
ensure_php_requirements || true
ensure_composer || true
ensure_python3 || true
ensure_edgetts || true
check_edge_browser || true

# Setup environment files
ensure_env_file "$ENV_FILE" "$ENV_EXAMPLE"
ensure_production_environment "$ENV_FILE"
configure_database_connection "$ENV_FILE" "$DB_FILE"

# Setup permissions
setup_directory_permissions
verify_critical_permissions

# Install dependencies
install_dependencies || true

# Setup database
setup_database "$DB_DIR" "$DB_FILE" "$ENV_FILE"

# Determine deployment mode
CURRENT_ENV=$(get_current_environment "$ENV_FILE")
CURRENT_DEBUG=$(get_current_debug_setting "$ENV_FILE")

echo ""
echo "Environment configuration: APP_ENV=$CURRENT_ENV, APP_DEBUG=$CURRENT_DEBUG"
echo ""

# Optimize based on environment
if [ "$CURRENT_ENV" = "production" ]; then
    echo "Running production optimizations..."
    optimize_for_production
    create_init_marker "$INIT_MARKER"

    # Integrate with Nginx for production
    echo ""
    echo "Configuring Nginx integration..."
    if integrate_with_nginx "$APP_NAME" "$APP_DIR" "localhost" "8.4"; then
        echo "Nginx integration completed successfully"
    else
        echo "WARNING: Nginx integration encountered issues"
    fi

    echo ""
    print_deployment_summary "$APP_DIR" "production" "$APP_NAME"
else
    echo "Setting up development environment..."
    optimize_for_development
    create_init_marker "$INIT_MARKER"
    echo ""
    print_deployment_summary "$APP_DIR" "development" "$APP_NAME"

    # Start development server
    if stop_development_server 8000; then
        start_development_server "0.0.0.0" "8000"
    fi
fi

# sudo apt update && sudo apt install -y dos2unix &&  find . -maxdepth 3 -type f -name 'deploy.sh' -print0 |  while IFS= read -r -d '' f; do sudo dos2unix "$f" && sudo chmod +x "$f"; done