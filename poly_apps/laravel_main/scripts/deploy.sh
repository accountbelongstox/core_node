#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# ============================================================================
# Laravel Deployment Script with UP Method Support
# ============================================================================
# This script provides reusable functions for Laravel project deployment
# Includes versioned up() methods for incremental updates
# ============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Source gvar_common.sh for environment detection and path mapping
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GVAR_COMMON="${SCRIPT_DIR}/../../../scripts/shells/linux/common/gvar_common.sh"

if [ -f "$GVAR_COMMON" ]; then
    source "$GVAR_COMMON"
    echo -e "${GREEN}Loaded environment configuration from gvar_common.sh${NC}"
    echo -e "  CORE_NODE_DIR: ${CORE_NODE_DIR}"
    echo -e "  IS_WSL: ${IS_WSL}"
    echo -e "  IS_PRODUCTION: ${IS_PRODUCTION}"
    echo -e "  HAS_DESKTOP_ENVIRONMENT: ${HAS_DESKTOP_ENVIRONMENT}"
else
    echo -e "${YELLOW}Warning: gvar_common.sh not found, using default paths${NC}"
    CORE_NODE_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
    IS_WSL=false
    [ -d "/mnt/c/Users" ] && IS_WSL=true
fi

# ============================================================================
# UP METHODS - Versioned Updates
# ============================================================================
# Each up method represents a specific version update
# Format: up_YYYYMMDD_description()
# ============================================================================

UP_STATE_DIR="${HOME}/.laravel_deploy_state"
UP_STATE_FILE="${UP_STATE_DIR}/up_versions.txt"

# Initialize up state tracking
init_up_state() {
    mkdir -p "$UP_STATE_DIR"
    touch "$UP_STATE_FILE"
}

# Check if up version was already applied
is_up_applied() {
    local version="$1"
    grep -q "^${version}$" "$UP_STATE_FILE" 2>/dev/null
}

# Mark up version as applied
mark_up_applied() {
    local version="$1"
    echo "$version" >> "$UP_STATE_FILE"
    echo -e "${GREEN}[UP] Marked $version as applied${NC}"
}

# ============================================================================
# UP: 20251115_install_laravel_mcp
# Date: 2025-11-15
# Description: Install and initialize Laravel MCP for AI integration
# Idempotent: Can be run multiple times safely
# ============================================================================
up_20251115_install_laravel_mcp() {
    local version="20251115_install_laravel_mcp"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-11-15${NC}"
    echo -e "${CYAN}[UP] Description: Install Laravel MCP for AI integration${NC}"

    if is_up_applied "$version"; then
        echo -e "${BLUE}[UP] Note: Already applied before, re-running for idempotency${NC}"
    fi

    echo -e "${CYAN}========================================${NC}"

    local laravel_dir=$(get_laravel_dir)
    if [ -z "$laravel_dir" ]; then
        echo -e "${RED}[UP] ERROR: Laravel directory not found${NC}"
        return 1
    fi

    cd "$laravel_dir" || return 1

    echo -e "${BLUE}[UP] Step 1: Checking Composer...${NC}"
    if ! command -v composer &> /dev/null; then
        echo -e "${RED}[UP] Composer not found${NC}"
        return 1
    fi
    echo -e "${GREEN}[UP] OK Composer found${NC}"

    echo -e "${BLUE}[UP] Step 2: Installing/Updating Laravel MCP...${NC}"
    if $USE_SUDO composer show | grep -q "laravel/mcp"; then
        echo -e "${BLUE}[UP] Laravel MCP already installed, ensuring latest version...${NC}"
        $USE_SUDO composer update laravel/mcp
    else
        echo -e "${BLUE}[UP] Installing Laravel MCP...${NC}"
        $USE_SUDO composer require laravel/mcp
    fi

    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[UP] Warning: Composer operation had issues, checking installation...${NC}"
    fi

    echo -e "${BLUE}[UP] Step 3: Publishing AI routes...${NC}"
    if [ -f "$laravel_dir/routes/ai.php" ]; then
        echo -e "${BLUE}[UP] AI routes already exist, skipping publish${NC}"
    else
        $USE_SUDO php artisan vendor:publish --tag=ai-routes --force
    fi

    if [ -f "$laravel_dir/routes/ai.php" ]; then
        echo -e "${GREEN}[UP] OK AI routes file exists${NC}"
    else
        echo -e "${YELLOW}[UP] WARNING AI routes file not found${NC}"
    fi

    echo -e "${BLUE}[UP] Step 4: Verifying installation...${NC}"
    if $USE_SUDO composer show | grep -q "laravel/mcp"; then
        echo -e "${GREEN}[UP] OK Laravel MCP package installed${NC}"
    else
        echo -e "${RED}[UP] ERROR Laravel MCP package not found${NC}"
        return 1
    fi

    mark_up_applied "$version"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# UP: 20251115_install_octane
# Date: 2025-11-15
# Description: Install Laravel Octane with Swoole support
# Idempotent: Can be run multiple times safely
# ============================================================================
up_20251115_install_octane() {
    local version="20251115_install_octane"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-11-15${NC}"
    echo -e "${CYAN}[UP] Description: Install Laravel Octane with Swoole${NC}"

    if is_up_applied "$version"; then
        echo -e "${BLUE}[UP] Note: Already applied before, re-running for idempotency${NC}"
    fi

    echo -e "${CYAN}========================================${NC}"

    local laravel_dir=$(get_laravel_dir)
    if [ -z "$laravel_dir" ]; then
        echo -e "${RED}[UP] ERROR: Laravel directory not found${NC}"
        return 1
    fi

    cd "$laravel_dir" || return 1

    echo -e "${BLUE}[UP] Step 1: Checking Composer...${NC}"
    if ! command -v composer &> /dev/null; then
        echo -e "${RED}[UP] Composer not found${NC}"
        return 1
    fi
    echo -e "${GREEN}[UP] OK Composer found${NC}"

    echo -e "${BLUE}[UP] Step 2: Installing/Updating Laravel Octane...${NC}"
    # Check if already installed
    if $USE_SUDO composer show | grep -q "laravel/octane"; then
        echo -e "${BLUE}[UP] Laravel Octane already installed, ensuring latest version...${NC}"
        $USE_SUDO composer update laravel/octane
    else
        echo -e "${BLUE}[UP] Installing Laravel Octane...${NC}"
        $USE_SUDO composer require laravel/octane
    fi

    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[UP] Warning: Composer operation had issues, checking installation...${NC}"
    fi

    echo -e "${BLUE}[UP] Step 3: Publishing Octane configuration...${NC}"
    if [ -f "$laravel_dir/config/octane.php" ]; then
        echo -e "${BLUE}[UP] Octane config already exists, skipping publish${NC}"
    else
        $USE_SUDO php artisan octane:install --server=swoole 2>&1 | grep -v "Octane installed successfully"
    fi

    if [ -f "$laravel_dir/config/octane.php" ]; then
        echo -e "${GREEN}[UP] OK Octane config file exists${NC}"
    else
        echo -e "${YELLOW}[UP] WARNING Octane config not found${NC}"
    fi

    echo -e "${BLUE}[UP] Step 4: Verifying installation...${NC}"
    if $USE_SUDO composer show | grep -q "laravel/octane"; then
        echo -e "${GREEN}[UP] OK Laravel Octane package installed${NC}"
    else
        echo -e "${RED}[UP] ERROR Laravel Octane package not found${NC}"
        return 1
    fi

    mark_up_applied "$version"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# UP: 20251127_install_chokidar
# Date: 2025-11-27
# Description: Install chokidar for Octane hot-reload functionality
# Idempotent: Always runs to verify and fix installation
# ============================================================================
up_20251127_install_chokidar() {
    local version="20251127_install_chokidar"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-11-27${NC}"
    echo -e "${CYAN}[UP] Description: Install chokidar for hot-reload${NC}"
    echo -e "${CYAN}[UP] Note: Always runs to ensure proper installation${NC}"
    echo -e "${CYAN}========================================${NC}"

    local laravel_dir=$(get_laravel_dir)
    if [ -z "$laravel_dir" ]; then
        echo -e "${RED}[UP] ERROR: Laravel directory not found${NC}"
        return 1
    fi

    cd "$laravel_dir" || return 1

    echo -e "${BLUE}[UP] Step 1: Checking Node.js and pnpm...${NC}"
    if ! command -v node &> /dev/null; then
        echo -e "${RED}[UP] ERROR: Node.js not found${NC}"
        echo -e "${YELLOW}[UP] Please install Node.js first${NC}"
        return 1
    fi

    if ! command -v pnpm &> /dev/null; then
        echo -e "${RED}[UP] ERROR: pnpm not found${NC}"
        echo -e "${YELLOW}[UP] Please install pnpm first (npm install -g pnpm)${NC}"
        return 1
    fi

    local node_version=$(node --version)
    local pnpm_version=$(pnpm --version)
    echo -e "${GREEN}[UP] OK Node.js: $node_version${NC}"
    echo -e "${GREEN}[UP] OK pnpm: $pnpm_version${NC}"

    echo -e "${BLUE}[UP] Step 2: Checking/Installing chokidar (always runs)...${NC}"

    if [ -d "node_modules/chokidar" ]; then
        echo -e "${BLUE}[UP] chokidar exists, verifying installation...${NC}"
        pnpm install --save-dev chokidar 2>&1 | grep -E "(up to date|added|updated|Progress)" || true
    else
        echo -e "${BLUE}[UP] Installing chokidar...${NC}"
        pnpm install --save-dev chokidar
    fi

    echo -e "${BLUE}[UP] Step 3: Verifying chokidar installation...${NC}"
    if [ -d "node_modules/chokidar" ]; then
        local chokidar_version=$(pnpm list chokidar 2>/dev/null | grep chokidar | head -1 | awk '{print $2}' || echo "unknown")
        echo -e "${GREEN}[UP] OK chokidar installed (version: $chokidar_version)${NC}"
    else
        echo -e "${RED}[UP] ERROR: chokidar not found after installation${NC}"
        return 1
    fi

    echo -e "${BLUE}[UP] Step 4: Testing chokidar functionality...${NC}"
    if node -e "require('chokidar'); console.log('OK')" 2>/dev/null | grep -q "OK"; then
        echo -e "${GREEN}[UP] OK chokidar can be loaded successfully${NC}"
    else
        echo -e "${YELLOW}[UP] WARNING: chokidar test failed, but continuing...${NC}"
    fi

    mark_up_applied "$version"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# REUSABLE FUNCTIONS - Can be called from other scripts
# ============================================================================

# Function to get Laravel directory path
get_laravel_dir() {
    if [ -z "$CORE_NODE_DIR" ]; then
        local script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
        echo "$script_root/poly_apps/laravel_main"
    else
        echo "$CORE_NODE_DIR/poly_apps/laravel_main"
    fi
}

# Function to initialize system directories
initialize_system_directories() {
    echo -e "${BLUE}[DEPLOY] Initializing system directories${NC}"

    local www_root=$(map_web_path "wwwroot")
    local nginx_config_dir=$(map_web_path "nginxconfig")
    local ssl_dir="$nginx_config_dir/ssl"
    local shared_data=$(map_web_path "shared-data")
    local backup_dir=$(map_web_path "backup")
    local laravel_main="$www_root/laravel_main"
    local laravel_db="$laravel_main/laravel_db"

    local db_exists=false
    if find "$laravel_db" -maxdepth 1 -type f \( -name "*.db" -o -name "*.sqlite" -o -name "*.sqlite3" \) 2>/dev/null | grep -q .; then
        db_exists=true
        echo -e "${BLUE}[DEPLOY] Database files detected - will preserve${NC}"
    fi

    local system_dirs=(
        "$nginx_config_dir"
        "$ssl_dir"
        "$nginx_config_dir/sites-available"
        "$nginx_config_dir/sites-enabled"
        "$www_root"
        "$laravel_main"
        "$laravel_db"
        "$laravel_db/tmp"
        "$laravel_db/sessions"
        "$shared_data"
        "$backup_dir"
    )

    for dir in "${system_dirs[@]}"; do
        $USE_SUDO mkdir -p "$dir" 2>/dev/null || {
            echo -e "${RED}[DEPLOY] Failed to create $dir${NC}"
            return 1
        }
        $USE_SUDO chmod 755 "$dir" 2>/dev/null || true
    done

    for dir in "${system_dirs[@]}"; do
        if [ "$dir" = "$laravel_db" ] && [ "$db_exists" = true ]; then
            if [ "$IS_WSL" = true ]; then
                $USE_SUDO chmod 777 "$dir" 2>/dev/null || true
            else
                $USE_SUDO chown $USER:www-data "$dir" 2>/dev/null || {
                    $USE_SUDO chmod 777 "$dir" 2>/dev/null || true
                }
                $USE_SUDO chmod 775 "$dir" 2>/dev/null || true
            fi
        else
            if [ "$IS_WSL" = true ]; then
                $USE_SUDO chmod -R 777 "$dir" 2>/dev/null || true
            else
                $USE_SUDO chown -R $USER:www-data "$dir" 2>/dev/null || {
                    $USE_SUDO chmod -R 777 "$dir" 2>/dev/null || true
                }
                $USE_SUDO chmod -R 775 "$dir" 2>/dev/null || true
            fi
        fi
    done

    echo -e "${GREEN}[DEPLOY] OK System directories initialized${NC}"
    return 0
}

# Function to check if Laravel is available
check_laravel_available() {
    local laravel_dir=$(get_laravel_dir)

    echo -e "${GREEN}[DEPLOY] OK Laravel directory: $laravel_dir${NC}"

    if [ ! -d "$laravel_dir/vendor" ]; then
        echo -e "${YELLOW}[DEPLOY] Running composer install...${NC}"
        cd "$laravel_dir"
        $USE_SUDO composer install --optimize-autoloader
    fi

    cd "$laravel_dir"
    $USE_SUDO php artisan --version >/dev/null 2>&1

    echo -e "${GREEN}[DEPLOY] OK Laravel is ready${NC}"
    return 0
}

# Function to initialize Laravel-specific directories
initialize_laravel_directories() {
    echo -e "${BLUE}[DEPLOY] Initializing Laravel directories${NC}"

    local laravel_dir=$(get_laravel_dir)

    local laravel_dirs=(
        "$laravel_dir/storage/framework/sessions"
        "$laravel_dir/storage/framework/cache"
        "$laravel_dir/storage/framework/views"
        "$laravel_dir/storage/logs"
        "$laravel_dir/storage/app/public"
        "$laravel_dir/bootstrap/cache"
    )

    for dir in "${laravel_dirs[@]}"; do
        $USE_SUDO mkdir -p "$dir" 2>/dev/null || {
            echo -e "${RED}[DEPLOY] Failed to create $dir${NC}"
            return 1
        }
    done

    for dir in "${laravel_dirs[@]}"; do
        if [ "$IS_WSL" = true ]; then
            $USE_SUDO chmod -R 777 "$dir" 2>/dev/null || true
        else
            $USE_SUDO chown -R $USER:www-data "$dir" 2>/dev/null || {
                $USE_SUDO chmod -R 777 "$dir" 2>/dev/null || true
            }
            $USE_SUDO chmod -R 775 "$dir" 2>/dev/null || true
        fi
    done

    echo -e "${GREEN}[DEPLOY] OK Laravel directories initialized${NC}"
    return 0
}

# Check initialization - ensure directories and permissions
check_initialization() {
    echo -e "${BLUE}[INIT] Initializing Laravel environment${NC}"

    local laravel_dir=$(get_laravel_dir)
    cd "$laravel_dir"

    # Create Laravel directories
    $USE_SUDO mkdir -p storage/framework/sessions
    $USE_SUDO mkdir -p storage/framework/cache
    $USE_SUDO mkdir -p storage/framework/views
    $USE_SUDO mkdir -p storage/logs
    $USE_SUDO mkdir -p storage/app/public
    $USE_SUDO mkdir -p bootstrap/cache

    # Create external directories for PathMapper
    local www_root=$(map_web_path "wwwroot")
    $USE_SUDO mkdir -p "$www_root/laravel_db/sessions"
    $USE_SUDO mkdir -p "$www_root/laravel_db/tmp"

    # Set permissions
    if [ "$IS_WSL" = true ]; then
        $USE_SUDO chmod -R 777 storage bootstrap/cache 2>/dev/null || true
        $USE_SUDO chmod -R 777 "$www_root/laravel_db" 2>/dev/null || true
    else
        $USE_SUDO chown -R $USER:www-data storage bootstrap/cache "$www_root/laravel_db" 2>/dev/null || true
        $USE_SUDO chmod -R 775 storage bootstrap/cache "$www_root/laravel_db" 2>/dev/null || true
    fi

    # Create .env if needed
    [ ! -f ".env" ] && cp ".env.example" ".env"
    grep -q "^APP_KEY=base64:" ".env" 2>/dev/null || $USE_SUDO php artisan key:generate --force >/dev/null 2>&1

    echo -e "${GREEN}[INIT] OK Environment initialized${NC}"
    return 0
}

# Run all UP methods in sequence
run_all_ups() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}Running all UP methods${NC}"
    echo -e "${CYAN}========================================${NC}"

    init_up_state

    local failed=0

    up_20251115_install_laravel_mcp || failed=1
    up_20251115_install_octane || failed=1
    up_20251127_install_chokidar || failed=1

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}[UP] All updates applied successfully${NC}"
        return 0
    else
        echo -e "${RED}[UP] Some updates failed${NC}"
        return 1
    fi
}

# Function to fix prerequisites and common issues
fix_prerequisites() {
    echo -e "\n${BLUE}[PREREQUISITES] Checking and fixing common issues${NC}"

    # 1. Fix Git safe directory issue (WSL/dual boot common problem)
    echo -e "${YELLOW}Fixing Git safe directory issues...${NC}"
    local current_dir=$(pwd)
    local project_root="${CORE_NODE_DIR}"
    
    # Add current directory and project root to Git safe directories
    git config --global --add safe.directory "$current_dir" 2>/dev/null || true
    git config --global --add safe.directory "$project_root" 2>/dev/null || true
    
    # Also add any parent directories that might be causing issues
    local parent_dir=$(dirname "$current_dir")
    git config --global --add safe.directory "$parent_dir" 2>/dev/null || true
    
    echo -e "${GREEN}????Git safe directories configured${NC}"
    
    # 2. Install unzip and p7zip for Composer
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
        
        # Update package list
        if sudo apt update >/dev/null 2>&1; then
            echo -e "${GREEN}????Package list updated${NC}"
        else
            echo -e "${RED}????Failed to update package list${NC}"
        fi
        
        # Install missing tools
        for tool in "${tools_needed[@]}"; do
            if sudo apt install -y "$tool" >/dev/null 2>&1; then
                echo -e "${GREEN}????Installed $tool${NC}"
            else
                echo -e "${RED}????Failed to install $tool${NC}"
            fi
        done
    else
        echo -e "${GREEN}????Archive extraction tools already available${NC}"
    fi
    
    # 3. Fix file permissions for WSL (common issue)
    echo -e "${YELLOW}Fixing file permissions...${NC}"
    
    # Fix script permissions
    if [ -f "$(basename "$0")" ]; then
        chmod +x "$(basename "$0")" 2>/dev/null || true
    fi
    
    # Fix common Laravel file permissions
    if [ -f "artisan" ]; then
        chmod +x artisan 2>/dev/null || true
        echo -e "${GREEN}????Fixed artisan permissions${NC}"
    fi
    
    # 4. Verify Git functionality
    echo -e "${YELLOW}Verifying Git functionality...${NC}"
    if git status >/dev/null 2>&1; then
        echo -e "${GREEN}????Git is working properly${NC}"
    else
        echo -e "${YELLOW}????Git may still have issues, but continuing...${NC}"
    fi
    
    # 5. Check Composer functionality
    echo -e "${YELLOW}Checking Composer zip handling...${NC}"
    if command -v unzip >/dev/null 2>&1 || command -v 7z >/dev/null 2>&1 || command -v 7za >/dev/null 2>&1; then
        echo -e "${GREEN}????Archive extraction tools available for Composer${NC}"
    else
        echo -e "${YELLOW}????No archive tools found - Composer will use PHP zip extension${NC}"
    fi
    
    echo -e "${GREEN}[PREREQUISITES] Setup complete${NC}\n"
}

# Ensures the .env file exists and is properly configured
# Usage: ensure_env_file [project_root]
ensure_env_file() {
    local env_file=".env"
    local env_example=".env.example"
    local project_root="${1:-$(pwd)}"
    local full_env_path="${project_root}/${env_file}"

    echo -e "\n${BLUE}[ENV SETUP] Verifying environment configuration${NC}"

    # Verify .env file existence
    if [ ! -f "$full_env_path" ]; then
        if [ ! -f "${project_root}/${env_example}" ]; then
            echo -e "${RED}????Error: Missing ${env_example} file in ${project_root}${NC}"
            return 1
        fi

        # Create from example
        cp "${project_root}/${env_example}" "$full_env_path"
        echo -e "${GREEN}????Created ${env_file} from template${NC}"

        # Generate application key
        if grep -q "APP_KEY=" "$full_env_path"; then
            if command -v php &>/dev/null; then
                (cd "$project_root" && php artisan key:generate --quiet)
                echo -e "${GREEN}????Generated application encryption key${NC}"
            else
                echo -e "${YELLOW}????PHP not available - APP_KEY remains unset${NC}"
            fi
        fi
    else
        echo -e "${BLUE}????${env_file} already exists${NC}"
    fi

    # Set secure permissions
    if [ -f "$full_env_path" ]; then
        chmod 600 "$full_env_path"
        echo -e "${GREEN}????Applied secure file permissions (600)${NC}"
    fi
}

# Ensures production environment configuration
# Usage: ensure_production_environment [project_root]
ensure_production_environment() {
    local env_file=".env"
    local project_root="${1:-$(pwd)}"
    local full_env_path="${project_root}/${env_file}"
    local changes_made=false

    echo -e "\n${BLUE}[ENV CONFIG] Validating production settings${NC}"

    # Verify .env exists
    if [ ! -f "$full_env_path" ]; then
        echo -e "${RED}????Error: ${env_file} not found in ${project_root}${NC}"
        return 1
    fi

    # Create backup
    cp "$full_env_path" "${full_env_path}.bak"
    
    # Configure APP_ENV
    if grep -q "^APP_ENV=" "$full_env_path"; then
        if ! grep -q "^APP_ENV=production$" "$full_env_path"; then
            sed -i 's/^APP_ENV=.*/APP_ENV=production/' "$full_env_path"
            changes_made=true
            echo -e "${GREEN}????Set APP_ENV to production${NC}"
        fi
    else
        echo "APP_ENV=production" >> "$full_env_path"
        changes_made=true
        echo -e "${GREEN}????Added APP_ENV setting${NC}"
    fi

    # Configure APP_DEBUG
    if grep -q "^APP_DEBUG=" "$full_env_path"; then
        if ! grep -q "^APP_DEBUG=false$" "$full_env_path"; then
            sed -i 's/^APP_DEBUG=.*/APP_DEBUG=false/' "$full_env_path"
            changes_made=true
            echo -e "${GREEN}????Disabled debug mode${NC}"
        fi
    else
        echo "APP_DEBUG=false" >> "$full_env_path"
        changes_made=true
        echo -e "${GREEN}????Added APP_DEBUG setting${NC}"
    fi

    # Cleanup if no changes were needed
    if [ "$changes_made" = false ]; then
        rm -f "${full_env_path}.bak"
        echo -e "${BLUE}????Production settings already configured${NC}"
    else
        echo -e "${GREEN}????Production configuration complete${NC}"
    fi
}

# ============================================================================
# MAIN EXECUTION - Always runs (idempotent)
# ============================================================================
# Check initialization (ensure directories and permissions)
check_initialization

# Run all UP methods automatically when sourced or executed
run_all_ups

# ============================================================================
# LEGACY DEPLOYMENT FUNCTIONS (kept for reference, not executed automatically)
# ============================================================================
# To run full deployment, execute: bash deploy.sh --full-deploy
# ============================================================================

if [ "${1:-}" = "--full-deploy" ]; then

# Change to the script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo "Changed to directory: $SCRIPT_DIR"

# Function to setup directory permissions
setup_permissions() {
    echo "Setting up directory permissions..."

    # Prompt for username with 5 second timeout
    read -t 5 -p "Enter username [default: www]: " username
    if [ -z "$username" ]; then
        username="www"
    fi

    # Check if user exists
    if ! id "$username" &>/dev/null; then
        echo "User $username does not exist, using current user: $USER"
        username="$USER"
    fi

    # Reset Laravel directories
    echo "Resetting Laravel directories..."
    rm -rf storage/framework/views/*
    rm -rf storage/framework/cache/*
    rm -rf storage/framework/sessions/*
    rm -rf storage/logs/*
    rm -rf bootstrap/cache/*

    # Create directories if they don't exist
    mkdir -p storage/framework/views
    mkdir -p storage/framework/cache
    mkdir -p storage/framework/sessions
    mkdir -p storage/logs
    mkdir -p bootstrap/cache

    # Set ownership and permissions
    echo "Setting ownership to $username:$username"
    chown -R "$username:$username" .
    echo "Setting directory permissions to 755"
    find . -type d -exec chmod 755 {} \;
    echo "Setting file permissions to 644"
    find . -type f -exec chmod 644 {} \;

    # Set special permissions for storage and bootstrap/cache
    echo "Setting special permissions for storage and bootstrap/cache"
    chmod -R 775 storage
    chmod -R 775 bootstrap/cache
}

# Function to check and install PHP 8.4
ensure_php_84() {
    if command -v php &>/dev/null; then
        php_version=$(php -v | head -n 1 | cut -d " " -f 2)
        echo "PHP version: $php_version"
    else
        echo "PHP is not installed. Installing PHP..."
        sudo apt update
        sudo apt install -y php
        php_version=$(php -v | head -n 1 | cut -d " " -f 2)
        echo "PHP version: $php_version"
    fi
}

# Function to check and install required PHP extensions
ensure_php_extensions() {
    echo "Checking required PHP extensions (dom, xml)..."
    if ! php -m | grep -q 'dom'; then
        echo "PHP extension 'dom' not found. Installing..."
        sudo apt update
        sudo apt install -y php-xml
    fi
    if ! php -m | grep -q 'xml'; then
        echo "PHP extension 'xml' not found. Installing..."
        sudo apt update
        sudo apt install -y php-xml
    fi
}

# Function to check and install Composer
ensure_composer() {
    if command -v composer &>/dev/null; then
        composer_version=$(composer --version | cut -d " " -f 3)
        echo "Composer version: $composer_version"
    else
        echo "Composer is not installed. Installing Composer..."
        # Download Composer installer
        php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
        # Verify installer signature
        php -r "if (hash_file('sha384', 'composer-setup.php') === 'e21205b207c3ff031906575712edab6f13eb0b361f2085f1f1237b7126d785e826a450292b6cfd1d64d92e6563bbde02') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;"
        # Install Composer
        sudo php composer-setup.php --install-dir=/usr/local/bin --filename=composer
        # Remove installer
        rm composer-setup.php
        composer_version=$(composer --version | cut -d " " -f 3)
        echo "Composer version: $composer_version"
    fi
}

# Function to check and install vendor dependencies
ensure_vendor() {
    if [ ! -d "vendor" ]; then
        echo "Vendor directory not found. Installing dependencies..."
        composer install
    else
        echo "Vendor directory exists."
    fi
}

# Function to clear Laravel cache
clear_cache() {
    echo "Clearing Laravel cache..."
    php artisan cache:clear
    php artisan config:clear
    php artisan route:clear
    php artisan view:clear
}
# Function to handle SQLite database with intelligent migration
handle_database() {
    # Use gvar_common.sh map_web_path to get correct path
    local wwwroot=$(map_web_path "wwwroot")
    DB_DIR="$wwwroot/laravel_db"
    DB_FILE="$DB_DIR/database.sqlite"
    ENV_FILE=".env"

    echo -e "${BLUE}[DATABASE] Initializing SQLite database${NC}"
    echo "Database file location: ${GREEN}$DB_FILE${NC}"

    # 1. Ensure database directory exists
    if [ ! -d "$DB_DIR" ]; then
        mkdir -p "$DB_DIR"
        echo -e "${YELLOW}Created database directory${NC}"
    fi

    # 2. Handle database file creation
    db_exists=false
    if [ ! -f "$DB_FILE" ]; then
        read -p "Database file does not exist. Create it? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            touch "$DB_FILE"
            echo -e "${GREEN}Created new database file${NC}"
        else
            echo -e "${YELLOW}Skipping database initialization${NC}"
            return
        fi
    else
        db_exists=true
        echo -e "${GREEN}Using existing database${NC}"
    fi

    # 3. Configure .env file
    if [ ! -f "$ENV_FILE" ]; then
        cp .env.example "$ENV_FILE"
        echo -e "${YELLOW}Created .env file from example${NC}"
    fi

    # Update .env with SQLite configuration
    if ! grep -q "^DB_CONNECTION=sqlite" "$ENV_FILE"; then
        sed -i 's/DB_CONNECTION=.*/DB_CONNECTION=sqlite/' "$ENV_FILE"
    fi
    sed -i "s|^DB_DATABASE=.*|DB_DATABASE=$DB_FILE|" "$ENV_FILE"

    # 4. Run appropriate migrations based on database state
    if [ "$db_exists" = true ]; then
        echo -e "${BLUE}[DATABASE] Running schema updates on existing database${NC}"
        php artisan migrate --force
    else
        echo -e "${BLUE}[DATABASE] Initializing new database with migrations${NC}"
        php artisan migrate:fresh --force --seed
    fi

    # 5. Optional configuration (if needed)
    if [ -f "artisan" ] && php artisan | grep -q "database:config"; then
        php artisan database:config
    fi

    # Set proper permissions
    chmod 755 "$DB_DIR"
    chmod 644 "$DB_FILE"
    echo -e "${GREEN}Database setup complete${NC}"
}
# Function to start Laravel server
start_server() {
    echo "Starting Laravel development server..."
    php artisan serve --host=0.0.0.0
}
# Function to configure open_basedir in project's .user.ini
configure_project_open_basedir() {
    echo -e "${BLUE}[PHP CONFIG] Configuring .user.ini${NC}"

    local project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local user_ini_file="$project_root/public/.user.ini"

    mkdir -p "$project_root/public"

    cat > "$user_ini_file" <<'EOF'
; Disable open_basedir for Laravel poly projects to allow PathMapper environment detection
open_basedir = none

; Security settings
disable_functions = exec,passthru,shell_exec,system,proc_open,popen
expose_php = Off
EOF

    chmod 644 "$user_ini_file"
    echo -e "${GREEN}[PHP CONFIG] OK .user.ini configured${NC}"
}

configure_laravel_nginx() {
    echo -e "\n\033[34m[LARAVEL NGINX CONFIGURATION]\033[0m"
    echo "This will guide you to add Laravel-specific rules to your Nginx configuration in BT/aapanel."

    echo -e "\n\033[36m=== Required Configuration ===\033[0m"
    cat <<EOF

Add these directives to your site's Nginx configuration in BT/aapanel:

1. Go to: Websites -> Select Site -> Configuration Files
2. Find the "server" block and add:

location / {
    try_files \$uri \$uri/ /index.php?\$query_string;
}

location ~ \.php\$ {
    fastcgi_pass   unix:/tmp/php-cgi-84.sock;
    fastcgi_index  index.php;
    fastcgi_param  SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
    include        fastcgi_params;
    fastcgi_hide_header X-Powered-By;
    
    # Security enhancements
    fastcgi_read_timeout 300;
    fastcgi_buffer_size 128k;
    fastcgi_buffers 4 256k;
}

3. Click "Save" and restart Nginx.
EOF

    echo -e "\n\033[32m????Configuration instructions generated\033[0m"
    echo -e "\033[33mNote:\033[0m Replace '/tmp/php-cgi-84.sock' with your actual PHP-FPM socket path if different."
}
# Check if running on Debian/Ubuntu
if [ -f /etc/debian_version ]; then
    echo "System detected as Debian/Ubuntu"
    
    # Fix prerequisites and common issues first
    fix_prerequisites
    
    ensure_env_file
    ensure_production_environment
    setup_permissions
    ensure_php_84
    ensure_php_extensions
    ensure_composer
    ensure_vendor
    clear_cache
    handle_database
    configure_project_open_basedir
    configure_laravel_nginx
    # Create initialization marker
    touch .laravel_initialized
    echo "Project initialization completed. Marker file created."

    # Start server
    start_server
else
    echo "This script only supports Debian/Ubuntu systems"
    exit 1
fi

fi  # End of --full-deploy check
