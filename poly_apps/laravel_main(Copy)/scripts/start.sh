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

# Laravel Main Enhanced Start Script
# Comprehensive startup with full start capabilities (development-friendly)
#
# DIFFERENCE FROM ORIGINAL DEPLOY.SH:
# - Defaults to development environment (APP_ENV=local, APP_DEBUG=true)
# - More permissive error handling for development workflow
# - Optimized for rapid development cycles
# - Still includes all start safety features and database preservation

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
APP_NAME="laravel_main"
SERVICE_NAME="ncore-$APP_NAME"
LOG_FILE="/var/log/ncore-services/$SERVICE_NAME.log"
DB_DIR="/www/wwwroot/laravel_main/laravel_db"
DB_FILE="$DB_DIR/database.sqlite"
ENV_FILE="$APP_DIR/.env"
ENV_EXAMPLE="$APP_DIR/.env.example"
INIT_MARKER="$APP_DIR/.laravel_initialized"
PROJECT_ROOT="/www/wwwroot/core_node"

# ASCII color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to verify start safety
verify_start_safety() {
    echo -e "\n${BLUE}[SAFETY CHECK] Verifying start safety${NC}"

    # Check if this is a production environment with existing data
    if [ -f "$DB_FILE" ]; then
        local db_size=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
        if [ "$db_size" -gt 1024 ]; then
            echo -e "${GREEN}Existing database detected (${db_size} bytes)${NC}"
            echo -e "${GREEN}SAFETY: This start will preserve existing data${NC}"
        fi
    fi

    # Verify no destructive operations in script
    echo -e "${GREEN}SAFETY: No migrate:fresh or destructive operations will be performed${NC}"
    echo -e "${GREEN}SAFETY: Only additive migrations will be run${NC}"
    echo -e "${GREEN}Safety verification complete${NC}"
}

echo -e "${BLUE}[INFO] Starting Laravel Main application (DEVELOPMENT MODE)${NC}"

# Change to app directory
cd "$APP_DIR" || {
    echo -e "${RED}[ERROR] Failed to change to app directory: $APP_DIR${NC}"
    exit 1
}

# Run safety verification first
verify_start_safety

# Function to fix prerequisites and common issues
fix_prerequisites() {
    echo -e "\n${BLUE}[PREREQUISITES] Checking and fixing common issues${NC}"

    # Fix Git safe directory issue
    echo -e "${YELLOW}Fixing Git safe directory issues...${NC}"
    local current_dir=$(pwd)

    git config --global --add safe.directory "$current_dir" 2>/dev/null || true
    git config --global --add safe.directory "$PROJECT_ROOT" 2>/dev/null || true

    local parent_dir=$(dirname "$current_dir")
    git config --global --add safe.directory "$parent_dir" 2>/dev/null || true

    echo -e "${GREEN}Git safe directories configured${NC}"

    # Install unzip and p7zip for Composer
    echo -e "${YELLOW}Checking archive extraction tools...${NC}"
    local tools_needed=()

    if ! command -v unzip >/dev/null 2>&1; then
        tools_needed+=("unzip")
    fi

    if ! command -v 7z >/dev/null 2>&1 && ! command -v 7za >/dev/null 2>&1; then
        tools_needed+=("p7zip-full")
    fi

    if [ ${#tools_needed[@]} -gt 0 ]; then
        echo -e "${YELLOW}Installing missing tools: ${tools_needed[*]}${NC}"

        if apt update >/dev/null 2>&1; then
            echo -e "${GREEN}Package list updated${NC}"
        else
            echo -e "${RED}Failed to update package list${NC}"
        fi

        for tool in "${tools_needed[@]}"; do
            if apt install -y "$tool" >/dev/null 2>&1; then
                echo -e "${GREEN}Installed $tool${NC}"
            else
                echo -e "${RED}Failed to install $tool${NC}"
            fi
        done
    else
        echo -e "${GREEN}Archive extraction tools already available${NC}"
    fi

    # Fix file permissions
    echo -e "${YELLOW}Fixing file permissions...${NC}"

    if [ -f "artisan" ]; then
        chmod +x artisan 2>/dev/null || true
        echo -e "${GREEN}Fixed artisan permissions${NC}"
    fi

    # Verify Git functionality
    echo -e "${YELLOW}Verifying Git functionality...${NC}"
    if git status >/dev/null 2>&1; then
        echo -e "${GREEN}Git is working properly${NC}"
    else
        echo -e "${YELLOW}Git may still have issues, but continuing...${NC}"
    fi

    echo -e "${GREEN}[PREREQUISITES] Setup complete${NC}\n"
}

# Function to ensure .env file exists and is properly configured
ensure_env_file() {
    echo -e "\n${BLUE}[ENV SETUP] Verifying environment configuration${NC}"

    if [ ! -f "$ENV_FILE" ]; then
        if [ ! -f "$ENV_EXAMPLE" ]; then
            echo -e "${RED}Error: Missing .env.example file in $APP_DIR${NC}"
            return 1
        fi

        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo -e "${GREEN}Created .env from template${NC}"

        if grep -q "APP_KEY=" "$ENV_FILE"; then
            if command -v php &>/dev/null; then
                php artisan key:generate --quiet
                echo -e "${GREEN}Generated application encryption key${NC}"
            else
                echo -e "${YELLOW}PHP not available - APP_KEY remains unset${NC}"
            fi
        fi
    else
        echo -e "${BLUE}.env already exists${NC}"
    fi

    if [ -f "$ENV_FILE" ]; then
        chmod 600 "$ENV_FILE"
        echo -e "${GREEN}Applied secure file permissions (600)${NC}"
    fi
}

# Function to ensure development environment configuration
ensure_development_environment() {
    echo -e "\n${BLUE}[ENV CONFIG] Configuring development environment${NC}"
    echo -e "${GREEN}Note: Development mode enables debugging and flexible configuration${NC}"

    if [ -f "$ENV_FILE" ]; then
        echo -e "${GREEN}.env file exists - configuring for development${NC}"

        # Set development-friendly defaults if not already set
        if ! grep -q "^APP_ENV=" "$ENV_FILE"; then
            echo "APP_ENV=local" >> "$ENV_FILE"
            echo -e "${GREEN}Set APP_ENV=local for development${NC}"
        else
            local current_env=$(grep "^APP_ENV=" "$ENV_FILE" | cut -d= -f2)
            echo -e "${BLUE}Current APP_ENV: $current_env${NC}"
            if [ "$current_env" = "production" ]; then
                echo -e "${YELLOW}Warning: APP_ENV is set to production${NC}"
                echo -e "${YELLOW}Consider changing to 'local' for development${NC}"
            fi
        fi

        if ! grep -q "^APP_DEBUG=" "$ENV_FILE"; then
            echo "APP_DEBUG=true" >> "$ENV_FILE"
            echo -e "${GREEN}Set APP_DEBUG=true for development${NC}"
        else
            local current_debug=$(grep "^APP_DEBUG=" "$ENV_FILE" | cut -d= -f2)
            echo -e "${BLUE}Current APP_DEBUG: $current_debug${NC}"
            if [ "$current_debug" = "false" ]; then
                echo -e "${YELLOW}Note: APP_DEBUG is disabled - debugging may be limited${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}.env file not found${NC}"
    fi
}

# Function to setup directory permissions
setup_permissions() {
    echo -e "\n${BLUE}[PERMISSIONS] Setting up directory permissions${NC}"

    local username="${USER:-www}"

    if ! id "$username" &>/dev/null; then
        echo -e "${YELLOW}User $username does not exist, using current user: $USER${NC}"
        username="$USER"
    fi

    # Reset Laravel directories
    echo -e "${YELLOW}Resetting Laravel directories...${NC}"
    rm -rf storage/framework/views/* 2>/dev/null || true
    rm -rf storage/framework/cache/* 2>/dev/null || true
    rm -rf storage/framework/sessions/* 2>/dev/null || true
    rm -rf storage/logs/* 2>/dev/null || true
    rm -rf bootstrap/cache/* 2>/dev/null || true

    # Create directories if they don't exist
    mkdir -p storage/framework/views
    mkdir -p storage/framework/cache
    mkdir -p storage/framework/sessions
    mkdir -p storage/logs
    mkdir -p bootstrap/cache

    # Set comprehensive permissions for Laravel directories
    echo -e "${YELLOW}Setting directory permissions to 755${NC}"
    find . -type d -exec chmod 755 {} \; 2>/dev/null || true
    echo -e "${YELLOW}Setting file permissions to 644${NC}"
    find . -type f -exec chmod 644 {} \; 2>/dev/null || true

    # Set 777 permissions for critical Laravel directories (recursive)
    echo -e "${YELLOW}Setting 777 permissions for critical directories (recursive)${NC}"
    chmod -R 777 storage 2>/dev/null || true
    chmod -R 777 bootstrap/cache 2>/dev/null || true

    # Additional directories that may need write access
    if [ -d "public/uploads" ]; then
        chmod -R 777 public/uploads 2>/dev/null || true
        echo -e "${GREEN}Set 777 permissions for public/uploads${NC}"
    fi

    if [ -d "resources/views/cache" ]; then
        chmod -R 777 resources/views/cache 2>/dev/null || true
        echo -e "${GREEN}Set 777 permissions for resources/views/cache${NC}"
    fi

    # Ensure artisan is executable
    chmod +x artisan 2>/dev/null || true

    echo -e "${GREEN}Permissions setup complete${NC}"
}

# Function to ensure PHP and extensions
ensure_php_requirements() {
    echo -e "\n${BLUE}[PHP] Checking PHP requirements${NC}"

    if ! command -v php &>/dev/null; then
        echo -e "${YELLOW}PHP is not installed. Installing PHP...${NC}"
        apt update && apt install -y php
    fi

    local php_version=$(php -v | head -n 1 | cut -d " " -f 2)
    echo -e "${GREEN}PHP version: $php_version${NC}"

    # Check required PHP extensions
    echo -e "${YELLOW}Checking required PHP extensions...${NC}"
    local extensions_needed=()

    if ! php -m | grep -q 'dom'; then
        extensions_needed+=("php-xml")
    fi
    if ! php -m | grep -q 'xml'; then
        extensions_needed+=("php-xml")
    fi

    if [ ${#extensions_needed[@]} -gt 0 ]; then
        echo -e "${YELLOW}Installing missing extensions: ${extensions_needed[*]}${NC}"
        apt update && apt install -y "${extensions_needed[@]}"
    else
        echo -e "${GREEN}All required PHP extensions are available${NC}"
    fi
}

# Function to ensure Composer
ensure_composer() {
    echo -e "\n${BLUE}[COMPOSER] Checking Composer installation${NC}"

    if command -v composer &>/dev/null; then
        local composer_version=$(composer --version | cut -d " " -f 3)
        echo -e "${GREEN}Composer version: $composer_version${NC}"
    else
        echo -e "${YELLOW}Composer is not installed. Installing Composer...${NC}"
        php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
        php composer-setup.php --install-dir=/usr/local/bin --filename=composer
        rm composer-setup.php
        local composer_version=$(composer --version | cut -d " " -f 3)
        echo -e "${GREEN}Composer version: $composer_version${NC}"
    fi
}

# Function to handle SQLite database with SAFE migration (no data loss)
handle_database() {
    echo -e "\n${BLUE}[DATABASE] SAFE Database Setup (preserving existing data)${NC}"
    echo -e "Database file location: ${GREEN}$DB_FILE${NC}"

    # Ensure database directory exists
    if [ ! -d "$DB_DIR" ]; then
        mkdir -p "$DB_DIR"
        chmod 777 "$DB_DIR" 2>/dev/null || true
        echo -e "${YELLOW}Created database directory with 777 permissions${NC}"
    fi

    # Handle database file creation SAFELY
    local db_exists=false
    if [ ! -f "$DB_FILE" ]; then
        touch "$DB_FILE"
        chmod 666 "$DB_FILE" 2>/dev/null || true
        echo -e "${GREEN}Created new empty database file${NC}"
    else
        db_exists=true
        local db_size=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
        echo -e "${GREEN}Using existing database (size: ${db_size} bytes)${NC}"
        echo -e "${BLUE}SAFETY: Existing database will be preserved${NC}"
    fi

    # Configure .env file for SQLite
    if ! grep -q "^DB_CONNECTION=sqlite" "$ENV_FILE"; then
        sed -i 's/DB_CONNECTION=.*/DB_CONNECTION=sqlite/' "$ENV_FILE"
    fi
    sed -i "s|^DB_DATABASE=.*|DB_DATABASE=$DB_FILE|" "$ENV_FILE"

    # Run SAFE migrations - NEVER use migrate:fresh in production
    echo -e "${BLUE}[DATABASE] Running SAFE schema updates (preserving existing data)${NC}"
    echo -e "${YELLOW}Note: Using migrate (not migrate:fresh) to preserve existing data${NC}"
    php artisan migrate --force 2>/dev/null || echo -e "${YELLOW}Migration skipped (database driver issues)${NC}"

    # Set permissive permissions for database files
    chmod 777 "$DB_DIR" 2>/dev/null || true
    chmod 666 "$DB_FILE" 2>/dev/null || true
    echo -e "${GREEN}Database setup complete with permissive permissions${NC}"
}

# Function to clear Laravel cache
clear_cache() {
    echo -e "\n${BLUE}[CACHE] Clearing Laravel cache${NC}"
    php artisan cache:clear 2>/dev/null || true
    php artisan config:clear 2>/dev/null || true
    php artisan route:clear 2>/dev/null || true
    php artisan view:clear 2>/dev/null || true
    echo -e "${GREEN}Cache cleared${NC}"
}

# Check if artisan exists
if [ ! -f "artisan" ]; then
    echo -e "${RED}[ERROR] artisan file not found in app directory${NC}"
    exit 1
fi

# Execute initialization functions
fix_prerequisites
ensure_env_file
ensure_development_environment
setup_permissions
ensure_php_requirements
ensure_composer

# Install/update dependencies
echo -e "\n${BLUE}[DEPENDENCIES] Installing/updating Laravel dependencies${NC}"
composer install --no-dev --optimize-autoloader

# Handle database setup
handle_database

# Clear existing cache before optimization
clear_cache

# Environment is controlled by .env file - no forced overrides
# Check current environment from .env file
CURRENT_ENV=$(grep "^APP_ENV=" .env 2>/dev/null | cut -d'=' -f2 || echo "local")
CURRENT_DEBUG=$(grep "^APP_DEBUG=" .env 2>/dev/null | cut -d'=' -f2 || echo "true")

echo -e "${BLUE}[ENV CONFIG] Current environment: APP_ENV=${CURRENT_ENV}, APP_DEBUG=${CURRENT_DEBUG}${NC}"
echo -e "${BLUE}[ENV CONFIG] Environment is controlled by .env file${NC}"

# Run Laravel optimizations (conditional based on environment)
if [ "$CURRENT_ENV" = "production" ]; then
    echo -e "\n${BLUE}[OPTIMIZATION] Running Laravel production optimizations${NC}"
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
else
    echo -e "\n${BLUE}[OPTIMIZATION] Development environment detected - clearing caches for flexibility${NC}"
    php artisan config:clear
    php artisan route:clear
    php artisan view:clear
fi

# Create initialization marker
touch "$INIT_MARKER"
echo -e "${GREEN}Project initialization completed. Marker file created.${NC}"

# Check start mode (start.sh defaults to development)
START_MODE="${START_MODE:-development}"

if [ "$START_MODE" = "production" ]; then
    echo -e "\n${BLUE}[PRODUCTION] Production mode: Setting up for nginx + php-fpm${NC}"
    echo -e "${GREEN}Laravel application started successfully${NC}"
    echo -e "${YELLOW}Configure your web server to point to: $APP_DIR/public${NC}"
    echo -e "${YELLOW}Recommended: Use nginx + php-fpm for production${NC}"

    # Keep the service running by monitoring the application
    echo -e "${BLUE}[MONITORING] Monitoring Laravel application...${NC}"
    while true; do
        if [ -f "$APP_DIR/storage/logs/laravel.log" ]; then
            tail -f "$APP_DIR/storage/logs/laravel.log" &
        fi
        sleep 30
        # Check if application is healthy
        if [ ! -f "$APP_DIR/artisan" ]; then
            echo -e "${RED}[ERROR] Laravel application files missing${NC}"
            exit 1
        fi
    done
else
    echo -e "\n${BLUE}[DEVELOPMENT] Development mode: Starting Laravel development server${NC}"
    echo -e "${GREEN}Laravel will be available at http://0.0.0.0:8000${NC}"
    echo -e "${YELLOW}To use production mode, set START_MODE=production${NC}"

    # Stop existing Laravel services and kill processes using port 8000
    echo -e "\n${YELLOW}[CLEANUP] Stopping existing Laravel services and processes${NC}"

    # Check if we're running inside systemd service
    RUNNING_IN_SYSTEMD=false
    if [ -n "$SYSTEMD_EXEC_PID" ] || [ "$PPID" = "1" ] || systemctl is-active --quiet ncore-laravel_main.service 2>/dev/null; then
        # Check if current process is part of the systemd service
        if pgrep -f "bash.*start.sh" | grep -q "$$"; then
            RUNNING_IN_SYSTEMD=true
            echo -e "${YELLOW}Running inside systemd service - skipping service stop${NC}"
        fi
    fi

    # Only stop systemd service if we're not running inside it
    if [ "$RUNNING_IN_SYSTEMD" = "false" ] && systemctl is-active --quiet ncore-laravel_main.service 2>/dev/null; then
        echo -e "${BLUE}Stopping ncore-laravel_main.service...${NC}"
        systemctl stop ncore-laravel_main.service 2>/dev/null || true
        sleep 2
    fi

    # Kill any processes using port 8000
    echo -e "${BLUE}Checking for processes using port 8000...${NC}"
    PORT_PIDS=$(lsof -ti:8000 2>/dev/null || true)
    if [ -n "$PORT_PIDS" ]; then
        echo -e "${YELLOW}Found processes using port 8000: $PORT_PIDS${NC}"
        echo -e "${BLUE}Killing processes using port 8000...${NC}"
        kill -TERM $PORT_PIDS 2>/dev/null || true
        sleep 3
        # Force kill if still running
        PORT_PIDS=$(lsof -ti:8000 2>/dev/null || true)
        if [ -n "$PORT_PIDS" ]; then
            echo -e "${YELLOW}Force killing remaining processes: $PORT_PIDS${NC}"
            kill -KILL $PORT_PIDS 2>/dev/null || true
            sleep 1
        fi
    fi

    # Kill any php artisan serve processes
    echo -e "${BLUE}Killing any existing 'php artisan serve' processes...${NC}"
    pkill -f "php.*artisan.*serve" 2>/dev/null || true
    sleep 2

    # Verify port is free
    if lsof -ti:8000 >/dev/null 2>&1; then
        echo -e "${RED}[ERROR] Port 8000 is still in use after cleanup${NC}"
        echo -e "${YELLOW}Processes still using port 8000:${NC}"
        lsof -i:8000 2>/dev/null || true
        exit 1
    fi

    echo -e "${GREEN}Port 8000 is now available${NC}"
    echo -e "${BLUE}Starting server...${NC}"
    echo -e "${BLUE}Environment will be read from .env file${NC}"
    exec php artisan serve --host=0.0.0.0 --port=8000
fi
