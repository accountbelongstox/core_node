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

# Check PHP version and compatibility
check_php_version() {
    echo "=== PHP Version Check ==="

    echo "Getting PHP version..."
    php -r "echo PHP_VERSION;" > /tmp/php_version.txt
    local php_version=$(cat /tmp/php_version.txt)
    local php_major=$(echo "$php_version" | cut -d. -f1)
    local php_minor=$(echo "$php_version" | cut -d. -f2)
    rm -f /tmp/php_version.txt

    echo "Current PHP version: $php_version"
    echo "PHP major version: $php_major"
    echo "PHP minor version: $php_minor"

    # Check for PHP 8.4+
    if [ "$php_major" -ge 8 ] && [ "$php_minor" -ge 4 ]; then
        echo ""
        echo "⚠️  WARNING: PHP $php_version detected!"
        echo "PHP 8.4+ removed deprecated mb_ereg functions (mb_split, mb_ereg, etc.)"
        echo ""
        echo "The polyfill has been added to app/Helpers/MbstringPolyfill.php"
        echo "This provides compatibility for Laravel dependencies."
        echo ""
        echo "Recommended actions:"
        echo "  1. Update Laravel and all dependencies to latest versions"
        echo "  2. Run: composer update --with-all-dependencies"
        echo "  3. Review deprecated function usage in vendor packages"
        echo ""
    fi

    # Check required PHP extensions
    local missing_extensions=()
    
    if ! php -m | grep -q mbstring; then
        missing_extensions+=("mbstring")
    fi
    
    if ! php -m | grep -q dom; then
        echo "WARNING: dom extension missing, but xml extension should provide it"
        # Don't add to missing_extensions as it's usually provided by xml
    fi
    
    if ! php -m | grep -q curl; then
        missing_extensions+=("curl")
    fi
    
    if [ ${#missing_extensions[@]} -gt 0 ]; then
        echo "ERROR: Missing required PHP extensions: ${missing_extensions[*]}" >&2
        echo "Install with: sudo apt-get install php$php_major.$php_minor-${missing_extensions[*]}" >&2
        echo ""
        echo "Alternatively, you can run Composer with --ignore-platform-req to skip these checks." >&2
        echo ""
        read -p "Do you want to continue with --ignore-platform-req? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Will use --ignore-platform-req for Composer operations"
            COMPOSER_IGNORE_PLATFORM="--ignore-platform-req=ext-mbstring --ignore-platform-req=ext-dom --ignore-platform-req=ext-curl"
        else
            exit 1
        fi
    else
        echo "Required PHP extensions: INSTALLED ✓"
        COMPOSER_IGNORE_PLATFORM=""
    fi
    echo ""
}

# Auto-detect and setup Composer
auto_detect_composer() {
    composer_cmd=""
    
    # Check if composer is in PATH
    if command -v composer &> /dev/null; then
        composer_cmd="composer"
        echo "[INFO] Composer found in PATH"
        return 0
    fi
    
    # Check for composer in parent directory first (for scripts directory)
    if [ -f "../composer" ]; then
        composer_cmd="php ../composer"
        echo "[INFO] Composer found in parent directory"
        return 0
    fi
    
    # Check for local composer.phar
    if [ -f "./composer.phar" ]; then
        composer_cmd="php ./composer.phar"
        echo "[INFO] Local composer.phar found"
        return 0
    fi
    
    # Check for local composer executable
    if [ -f "./composer" ]; then
        composer_cmd="php ./composer"
        echo "[INFO] Local composer executable found"
        return 0
    fi
    
    # Try to install composer locally
    echo "[INFO] Composer not found, attempting to install locally..."
    
    if command -v php &> /dev/null; then
        echo "[INFO] Downloading Composer installer..."
        if php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"; then
            echo "[INFO] Installing Composer..."
            if php composer-setup.php --install-dir=. --filename=composer; then
                composer_cmd="php ./composer"
                echo "[INFO] Composer installed successfully"
                rm -f composer-setup.php
                return 0
            else
                echo "[ERROR] Failed to install Composer"
                rm -f composer-setup.php
                return 1
            fi
        else
            echo "[ERROR] Failed to download Composer installer"
            return 1
        fi
    else
        echo "[ERROR] PHP not available - cannot install Composer"
        return 1
    fi
}

# Upgrade composer dependencies
upgrade_composer_dependencies() {
    echo "=== Upgrading Composer Dependencies ==="

    if [ ! -f "composer.json" ]; then
        echo "ERROR: composer.json not found in $APP_DIR" >&2
        return 1
    fi

    # Auto-detect Composer
    if ! auto_detect_composer; then
        echo "ERROR: composer not found and could not be installed!" >&2
        return 1
    fi

    echo "Getting Composer version..."
    $composer_cmd --version 2>&1 | head -1 > /tmp/composer_version.txt
    local composer_version=$(cat /tmp/composer_version.txt)
    echo "Composer version: $composer_version"
    rm -f /tmp/composer_version.txt
    echo ""

    # Ask for upgrade confirmation
    echo "This will upgrade all dependencies to their latest compatible versions."
    echo "Current composer.json requires:"
    grep -A 5 '"require":' composer.json || true
    echo ""

    read -p "Do you want to upgrade dependencies? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Upgrading dependencies..."

        # Backup composer.lock
        if [ -f "composer.lock" ]; then
            cp composer.lock composer.lock.backup
            echo "Backed up composer.lock to composer.lock.backup"
        fi

        # Update dependencies
        echo "Running: $composer_cmd update --with-all-dependencies --prefer-stable $COMPOSER_IGNORE_PLATFORM"
        $composer_cmd update --with-all-dependencies --prefer-stable $COMPOSER_IGNORE_PLATFORM || {
            echo "ERROR: Composer update failed!" >&2
            if [ -f "composer.lock.backup" ]; then
                echo "Restoring composer.lock from backup..."
                mv composer.lock.backup composer.lock
            fi
            return 1
        }

        # Dump autoload
        echo "Regenerating autoload files..."
        $composer_cmd dump-autoload --optimize $COMPOSER_IGNORE_PLATFORM

        echo "Dependencies upgraded successfully ✓"
        echo ""
    else
        echo "Skipping dependency upgrade."
        echo ""
    fi
}

# Update composer.json for PHP 8.4 compatibility
update_composer_json_for_php84() {
    echo "=== Checking composer.json PHP Version Requirement ==="

    # Auto-detect Composer first
    if ! auto_detect_composer; then
        echo "WARNING: Composer not available for validation" >&2
        return 0
    fi

    echo "Reading PHP requirement from composer.json..."
    grep -oP '(?<="php": ")[^"]+' composer.json > /tmp/php_req.txt
    local current_php_req=$(cat /tmp/php_req.txt)
    echo "Current PHP requirement: $current_php_req"
    rm -f /tmp/php_req.txt

    # Check if we need to update
    if [[ "$current_php_req" == "^8.2" ]]; then
        echo ""
        echo "⚠️  composer.json still requires PHP ^8.2"
        echo "For PHP 8.4 compatibility, consider updating to:"
        echo '  "php": "^8.2|^8.3|^8.4"'
        echo ""

        read -p "Update PHP requirement in composer.json? (y/N): " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Backup composer.json
            cp composer.json composer.json.backup
            echo "Backed up composer.json to composer.json.backup"

            # Update PHP requirement
            sed -i 's/"php": "\^8\.2"/"php": "^8.2|^8.3|^8.4"/' composer.json

            echo "Updated composer.json PHP requirement ✓"
            echo ""

            # Validate composer.json
            if $composer_cmd validate $COMPOSER_IGNORE_PLATFORM; then
                echo "composer.json is valid ✓"
            else
                echo "ERROR: composer.json validation failed!" >&2
                echo "Restoring from backup..."
                mv composer.json.backup composer.json
                return 1
            fi
        fi
    else
        echo "PHP requirement is already flexible: $current_php_req ✓"
    fi

    echo ""
}

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
echo "Getting environment-specific directories..."
get_database_directory > /tmp/db_dir.txt
DB_DIR=$(cat /tmp/db_dir.txt)
get_project_root > /tmp/project_root.txt
PROJECT_ROOT=$(cat /tmp/project_root.txt)
rm -f /tmp/db_dir.txt /tmp/project_root.txt
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

# Check PHP version first
check_php_version

# Record original directory and change to application directory
echo "Getting current working directory..."
pwd > /tmp/original_dir.txt
ORIGINAL_DIR=$(cat /tmp/original_dir.txt)
rm -f /tmp/original_dir.txt
echo ""
echo "=== Directory Debug Information ==="
echo "Original working directory: $ORIGINAL_DIR"
echo "Target application directory: $APP_DIR"
echo "Script directory: $SCRIPT_DIR"
echo ""

echo "Changing to application directory: $APP_DIR"
cd "$APP_DIR" || {
    echo "ERROR: Failed to change to app directory: $APP_DIR" >&2
    exit 1
}

echo "Getting current working directory after change..."
pwd > /tmp/current_dir.txt
CURRENT_DIR=$(cat /tmp/current_dir.txt)
echo "Current working directory after change: $CURRENT_DIR"
rm -f /tmp/current_dir.txt
echo "=== End Directory Debug ==="
echo ""

# Update composer.json for PHP 8.4 if needed
update_composer_json_for_php84

# Offer to upgrade dependencies
upgrade_composer_dependencies

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
echo "Getting current environment settings..."
get_current_environment "$ENV_FILE" > /tmp/current_env.txt
CURRENT_ENV=$(cat /tmp/current_env.txt)
get_current_debug_setting "$ENV_FILE" > /tmp/current_debug.txt
CURRENT_DEBUG=$(cat /tmp/current_debug.txt)
rm -f /tmp/current_env.txt /tmp/current_debug.txt

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

# Restore original directory
echo ""
echo "=== Directory Restore Debug ==="
echo "Getting current working directory before restore..."
pwd > /tmp/before_restore.txt
BEFORE_RESTORE=$(cat /tmp/before_restore.txt)
echo "Current working directory before restore: $BEFORE_RESTORE"
rm -f /tmp/before_restore.txt
echo "Restoring to original directory: $ORIGINAL_DIR"
cd "$ORIGINAL_DIR" || {
    echo "WARNING: Failed to restore original directory: $ORIGINAL_DIR" >&2
}
echo "Getting current working directory after restore..."
pwd > /tmp/after_restore.txt
AFTER_RESTORE=$(cat /tmp/after_restore.txt)
echo "Current working directory after restore: $AFTER_RESTORE"
rm -f /tmp/after_restore.txt
echo "=== End Directory Restore Debug ==="

# sudo apt update && sudo apt install -y dos2unix &&  find . -maxdepth 3 -type f -name 'deploy.sh' -print0 |  while IFS= read -r -d '' f; do sudo dos2unix "$f" && sudo chmod +x "$f"; done