#!/bin/bash
# Enable command tracing - print all commands before execution
set -x

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

# ============================================================================
# CONSTANTS - All constants defined at the beginning
# ============================================================================

# Script directory (deploy.sh location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Save initial working directory
INITIAL_WORK_DIR="$(pwd)"

# Path constants based on SCRIPT_DIR
LARAVEL_DIR="${SCRIPT_DIR}/.."
COMMON_SCRIPTS_DIR="${SCRIPT_DIR}/../../../scripts/shells/linux/common"
GVAR_COMMON="${COMMON_SCRIPTS_DIR}/gvar_common.sh"
COMMON_FUNCTIONS="${COMMON_SCRIPTS_DIR}/common_functions.sh"
GET_REAL_USER_SCRIPT="${COMMON_SCRIPTS_DIR}/get_real_user.sh"

# ============================================================================
# SOURCE COMMON SCRIPTS
# ============================================================================

# Source gvar_common.sh for environment detection and path mapping
    source "$GVAR_COMMON"

# Source common_functions.sh for engineering color output functions
source "$COMMON_FUNCTIONS"

# Source get_real_user.sh for real user detection
if [ -f "$GET_REAL_USER_SCRIPT" ]; then
    source "$GET_REAL_USER_SCRIPT"
else
    # Fallback function if get_real_user.sh is not available
    get_real_user() {
        if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
            echo "$SUDO_USER"
        elif [ "$USER" != "root" ]; then
            echo "$USER"
        else
            echo "$(getent passwd | awk -F: '$3 >= 1000 && $3 < 60000 {print $1; exit}')"
        fi
    }
fi

# ============================================================================
# PRINT ENVIRONMENT AND CONSTANTS INFORMATION
# ============================================================================
print_environment_info() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}Environment and Constants Information${NC}"
    echo -e "${CYAN}========================================${NC}"
    
    echo -e "${BLUE}Script Constants:${NC}"
    echo -e "  SCRIPT_DIR: ${SCRIPT_DIR}"
    echo -e "  INITIAL_WORK_DIR: ${INITIAL_WORK_DIR}"
    echo -e "  LARAVEL_DIR: ${LARAVEL_DIR}"
    echo -e "  COMMON_SCRIPTS_DIR: ${COMMON_SCRIPTS_DIR}"
    
    echo -e "${BLUE}Environment Variables:${NC}"
    echo -e "  USER: ${USER}"
    echo -e "  HOME: ${HOME}"
    echo -e "  PWD: $(pwd)"
    [ -n "$SUDO_USER" ] && echo -e "  SUDO_USER: ${SUDO_USER}"
    [ -n "$CORE_NODE_DIR" ] && echo -e "  CORE_NODE_DIR: ${CORE_NODE_DIR}"
    
    echo -e "${BLUE}System Detection:${NC}"
    echo -e "  IS_WSL: ${IS_WSL}"
    echo -e "  IS_PRODUCTION: ${IS_PRODUCTION}"
    echo -e "  HAS_DESKTOP_ENVIRONMENT: ${HAS_DESKTOP_ENVIRONMENT}"
    
    local real_user=$(get_real_user)
    echo -e "${BLUE}Real User:${NC}"
    echo -e "  REAL_USER: ${real_user}"
    
    echo -e "${BLUE}Tools:${NC}"
    [ -n "$USE_SUDO" ] && echo -e "  USE_SUDO: ${USE_SUDO}" || echo -e "  USE_SUDO: (not set)"
    command -v php &>/dev/null && echo -e "  PHP: $(php -v | head -n 1)" || echo -e "  PHP: (not found)"
    command -v composer &>/dev/null && echo -e "  COMPOSER: $(composer --version)" || echo -e "  COMPOSER: (not found)"
    
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

# Print environment and constants information
print_environment_info

# ============================================================================
# UP METHODS - Versioned Updates
# ============================================================================
# Each up method represents a specific version update
# Format: up_YYYYMMDD_description()
# ============================================================================

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


    echo -e "${CYAN}========================================${NC}"

    local laravel_dir="$LARAVEL_DIR"
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

    echo -e "${GREEN}[UP] $version completed${NC}"

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


    echo -e "${CYAN}========================================${NC}"

    local laravel_dir="$LARAVEL_DIR"
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

    echo -e "${GREEN}[UP] $version completed${NC}"

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

    local laravel_dir="$LARAVEL_DIR"
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

    echo -e "${GREEN}[UP] $version completed${NC}"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# UP: 20251206_install_faker
# Date: 2025-12-06
# Description: Install FakerPHP library for model factories and seeding
# Idempotent: Can be run multiple times safely
# ============================================================================
up_20251206_install_faker() {
    local version="20251206_install_faker"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-12-06${NC}"
    echo -e "${CYAN}[UP] Description: Install FakerPHP for testing${NC}"


    echo -e "${CYAN}========================================${NC}"

    local laravel_dir="$LARAVEL_DIR"
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

    echo -e "${BLUE}[UP] Step 2: Installing/Updating FakerPHP...${NC}"
    if $USE_SUDO composer show | grep -q "fakerphp/faker"; then
        echo -e "${BLUE}[UP] FakerPHP already installed, ensuring latest version...${NC}"
        $USE_SUDO composer update fakerphp/faker --dev
    else
        echo -e "${BLUE}[UP] Installing FakerPHP...${NC}"
        $USE_SUDO composer require fakerphp/faker --dev
    fi

    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[UP] Warning: Composer operation had issues, checking installation...${NC}"
    fi

    echo -e "${BLUE}[UP] Step 3: Verifying installation...${NC}"
    if $USE_SUDO composer show | grep -q "fakerphp/faker"; then
        echo -e "${GREEN}[UP] OK FakerPHP package installed${NC}"
    else
        echo -e "${RED}[UP] ERROR FakerPHP package not found${NC}"
        return 1
    fi

    echo -e "${BLUE}[UP] Step 4: Testing fake() helper...${NC}"
    if php artisan tinker --execute="var_dump(function_exists('fake'));" 2>/dev/null | grep -q "bool(true)"; then
        echo -e "${GREEN}[UP] OK fake() helper function is available${NC}"
    else
        echo -e "${YELLOW}[UP] WARNING fake() helper may not be available${NC}"
    fi

    echo -e "${GREEN}[UP] $version completed${NC}"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# UP: 20251215_install_reverb
# Date: 2025-12-15
# Description: Install Laravel Reverb for WebSocket support
# Idempotent: Can be run multiple times safely
# ============================================================================
up_20251215_install_reverb() {
    local version="20251215_install_reverb"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-12-15${NC}"
    echo -e "${CYAN}[UP] Description: Install Laravel Reverb for WebSocket${NC}"


    echo -e "${CYAN}========================================${NC}"

    local laravel_dir="$LARAVEL_DIR"
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

    echo -e "${BLUE}[UP] Step 2: Installing Pusher PHP Server (Reverb dependency)...${NC}"
    if $USE_SUDO composer show | grep -q "pusher/pusher-php-server"; then
        echo -e "${BLUE}[UP] Pusher PHP Server already installed${NC}"
    else
        echo -e "${BLUE}[UP] Installing pusher/pusher-php-server...${NC}"
        $USE_SUDO composer require pusher/pusher-php-server --with-all-dependencies 2>&1 | grep -E "(Upgrading|Installing|Package)" || true
    fi

    echo -e "${BLUE}[UP] Step 3: Installing/Updating Laravel Reverb...${NC}"
    if $USE_SUDO composer show | grep -q "laravel/reverb"; then
        echo -e "${BLUE}[UP] Laravel Reverb already installed, ensuring latest version...${NC}"
        $USE_SUDO composer update laravel/reverb --with-all-dependencies 2>&1 | grep -E "(Upgrading|Installing|Nothing)" || true
    else
        echo -e "${BLUE}[UP] Installing Laravel Reverb...${NC}"
        $USE_SUDO composer require laravel/reverb --with-all-dependencies 2>&1 | grep -E "(Upgrading|Installing|Package)" || true
    fi

    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[UP] Warning: Composer operation had issues, checking installation...${NC}"
    fi

    echo -e "${BLUE}[UP] Step 4: Publishing Reverb configuration...${NC}"
    if [ -f "$laravel_dir/config/reverb.php" ]; then
        echo -e "${BLUE}[UP] Reverb config already exists, skipping publish${NC}"
    else
        $USE_SUDO php artisan reverb:install --no-interaction 2>&1 | grep -v "npm install" || true
    fi

    if [ -f "$laravel_dir/config/reverb.php" ]; then
        echo -e "${GREEN}[UP] OK Reverb config file exists${NC}"
    else
        echo -e "${YELLOW}[UP] WARNING Reverb config not found${NC}"
    fi

    echo -e "${BLUE}[UP] Step 5: Verifying installation...${NC}"
    if $USE_SUDO composer show | grep -q "laravel/reverb"; then
        echo -e "${GREEN}[UP] OK Laravel Reverb package installed${NC}"
    else
        echo -e "${RED}[UP] ERROR Laravel Reverb package not found${NC}"
        return 1
    fi

    echo -e "${BLUE}[UP] Step 6: Updating .env for Reverb...${NC}"
    if [ -f "$laravel_dir/.env" ]; then
        if ! grep -q "^BROADCAST_CONNECTION=" "$laravel_dir/.env"; then
            echo "BROADCAST_CONNECTION=reverb" >> "$laravel_dir/.env"
            echo -e "${GREEN}[UP] OK Added BROADCAST_CONNECTION=reverb${NC}"
        elif grep -q "^BROADCAST_CONNECTION=log" "$laravel_dir/.env"; then
            sed -i 's/^BROADCAST_CONNECTION=log/BROADCAST_CONNECTION=reverb/' "$laravel_dir/.env"
            echo -e "${GREEN}[UP] OK Updated BROADCAST_CONNECTION to reverb${NC}"
        else
            echo -e "${BLUE}[UP] BROADCAST_CONNECTION already configured${NC}"
        fi

        if ! grep -q "^REVERB_APP_ID=" "$laravel_dir/.env"; then
            echo "" >> "$laravel_dir/.env"
            echo "REVERB_APP_ID=task-system" >> "$laravel_dir/.env"
            echo "REVERB_APP_KEY=reverb-key-$(date +%s)" >> "$laravel_dir/.env"
            echo "REVERB_APP_SECRET=reverb-secret-$(date +%s)" >> "$laravel_dir/.env"
            echo "REVERB_HOST=0.0.0.0" >> "$laravel_dir/.env"
            echo "REVERB_PORT=8080" >> "$laravel_dir/.env"
            echo "REVERB_SCHEME=http" >> "$laravel_dir/.env"
            echo -e "${GREEN}[UP] OK Added Reverb configuration to .env${NC}"
        else
            echo -e "${BLUE}[UP] Reverb env variables already configured${NC}"
        fi
    else
        echo -e "${YELLOW}[UP] WARNING .env file not found${NC}"
    fi

    echo -e "${GREEN}[UP] $version completed${NC}"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# UP: 20251220_install_haikunator
# Date: 2025-12-20
# Description: Install Haikunator PHP for auto-generating nicknames
# Idempotent: Can be run multiple times safely
# ============================================================================
up_20251220_install_haikunator() {
    local version="20251220_install_haikunator"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-12-20${NC}"
    echo -e "${CYAN}[UP] Description: Install Haikunator for nickname generation${NC}"


    echo -e "${CYAN}========================================${NC}"

    local laravel_dir="$LARAVEL_DIR"
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

    echo -e "${BLUE}[UP] Step 2: Installing/Updating Haikunator...${NC}"
    if $USE_SUDO composer show | grep -q "atrox/haikunator"; then
        echo -e "${BLUE}[UP] Haikunator already installed, ensuring latest version...${NC}"
        $USE_SUDO composer update atrox/haikunator
    else
        echo -e "${BLUE}[UP] Installing Haikunator...${NC}"
        $USE_SUDO composer require atrox/haikunator
    fi

    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[UP] Warning: Composer operation had issues, checking installation...${NC}"
    fi

    echo -e "${BLUE}[UP] Step 3: Verifying installation...${NC}"
    if $USE_SUDO composer show | grep -q "atrox/haikunator"; then
        echo -e "${GREEN}[UP] OK Haikunator package installed${NC}"
    else
        echo -e "${RED}[UP] ERROR Haikunator package not found${NC}"
        return 1
    fi

    echo -e "${GREEN}[UP] $version completed${NC}"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# REUSABLE FUNCTIONS - Can be called from other scripts
# ============================================================================

# Check initialization - ensure directories and permissions
check_initialization() {
    echo -e "${BLUE}[INIT] Fixing Laravel environment permissions${NC}"

    local real_user=$(get_real_user)
    local laravel_dir="$LARAVEL_DIR"
    local saved_dir="$(pwd)"
    cd "$laravel_dir" || return 1

    # Create Laravel directories that don't exist (never delete existing directories)
    [ ! -d "storage/framework/sessions" ] && $USE_SUDO mkdir -p storage/framework/sessions
    [ ! -d "storage/framework/cache" ] && $USE_SUDO mkdir -p storage/framework/cache
    [ ! -d "storage/framework/views" ] && $USE_SUDO mkdir -p storage/framework/views
    [ ! -d "storage/logs" ] && $USE_SUDO mkdir -p storage/logs
    [ ! -d "storage/app/public" ] && $USE_SUDO mkdir -p storage/app/public
    [ ! -d "bootstrap/cache" ] && $USE_SUDO mkdir -p bootstrap/cache

    # Create external directories for PathMapper that don't exist
    local www_root=$(map_web_path "wwwroot")
    [ ! -d "$www_root/laravel_db/sessions" ] && $USE_SUDO mkdir -p "$www_root/laravel_db/sessions"
    [ ! -d "$www_root/laravel_db/tmp" ] && $USE_SUDO mkdir -p "$www_root/laravel_db/tmp"

    # Always fix permissions for all directories (existing and newly created)
    # Running as root, change ownership to low privilege user
    if [ "$IS_WSL" = true ]; then
        $USE_SUDO chmod -R 777 storage bootstrap/cache 2>/dev/null || true
        $USE_SUDO chmod -R 777 "$www_root/laravel_db" 2>/dev/null || true
    else
        # Fix ownership to real user (running as root, change to low privilege user)
        $USE_SUDO chown -R "$real_user:$real_user" storage bootstrap/cache "$www_root/laravel_db" 2>/dev/null || true
        $USE_SUDO chmod -R 775 storage bootstrap/cache "$www_root/laravel_db" 2>/dev/null || true
    fi

    # Create .env if needed
    [ ! -f ".env" ] && cp ".env.example" ".env"
    grep -q "^APP_KEY=base64:" ".env" 2>/dev/null || $USE_SUDO php artisan key:generate --force >/dev/null 2>&1

    # Fix permissions for Laravel root directory (../ from script location)
    echo -e "${BLUE}[INIT] Fixing Laravel root directory permissions${NC}"
    if [ "$IS_WSL" = true ]; then
        $USE_SUDO chmod -R 777 "$laravel_dir" 2>/dev/null || true
    else
        # Fix ownership to real user (running as root, change to low privilege user)
        $USE_SUDO chown -R "$real_user:$real_user" "$laravel_dir" 2>/dev/null || true
        $USE_SUDO chmod -R 755 "$laravel_dir" 2>/dev/null || true
        # Special permissions for writable directories
        $USE_SUDO chmod -R 775 "$laravel_dir/storage" "$laravel_dir/bootstrap/cache" 2>/dev/null || true
    fi

    echo -e "${GREEN}[INIT] OK Environment permissions fixed${NC}"
    
    # Restore original directory
    cd "$saved_dir" || true
    return 0
}

# Run all UP methods in sequence
run_all_ups() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}Running all UP methods${NC}"
    echo -e "${CYAN}========================================${NC}"

    local failed=0

    up_20251115_install_laravel_mcp || failed=1
    up_20251115_install_octane || failed=1
    up_20251127_install_chokidar || failed=1
    up_20251206_install_faker || failed=1
    up_20251215_install_reverb || failed=1
    up_20251220_install_haikunator || failed=1

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

# Function to run php artisan sys:init in low privilege user context
run_artisan_sys_init() {
    echo -e "${BLUE}[ARTISAN] Running sys:init command${NC}"
    
    local real_user=$(get_real_user)
    local laravel_dir="$LARAVEL_DIR"
    
    if [ ! -f "$laravel_dir/artisan" ]; then
        echo -e "${YELLOW}[ARTISAN] Warning: artisan file not found, skipping sys:init${NC}"
        return 0
    fi
    
    # Check if sys:init command exists
    local check_cmd=""
    if [ -n "$USE_SUDO" ] && [ "$(id -u)" -eq 0 ]; then
        # Running as root, use sudo to check as real user
        check_cmd="$USE_SUDO -u $real_user php $laravel_dir/artisan list 2>/dev/null"
    else
        # Not running as root, check directly
        check_cmd="php $laravel_dir/artisan list 2>/dev/null"
    fi
    
    if ! eval "$check_cmd" | grep -q "sys:init"; then
        echo -e "${YELLOW}[ARTISAN] Warning: sys:init command not found, skipping${NC}"
        return 0
    fi
    
    # Run php artisan sys:init as low privilege user
    echo -e "${BLUE}[ARTISAN] Executing: php artisan sys:init (as user: $real_user)${NC}"
    local saved_dir="$(pwd)"
    cd "$laravel_dir" || return 0
    
    if [ -n "$USE_SUDO" ] && [ "$(id -u)" -eq 0 ]; then
        # Running as root, use sudo to run as real user
        $USE_SUDO -u "$real_user" php artisan sys:init 2>&1 || {
            echo -e "${YELLOW}[ARTISAN] Warning: sys:init command had issues, but continuing...${NC}"
        }
    else
        # Not running as root, run directly
        php artisan sys:init 2>&1 || {
            echo -e "${YELLOW}[ARTISAN] Warning: sys:init command had issues, but continuing...${NC}"
        }
    fi
    
    # Restore original directory
    cd "$saved_dir" || true
    
    echo -e "${GREEN}[ARTISAN] OK sys:init completed${NC}"
    return 0
}

# ============================================================================
# MAIN EXECUTION - Always runs (idempotent)
# ============================================================================
# Check initialization (ensure directories and permissions)
check_initialization

# Run all UP methods automatically when sourced or executed
run_all_ups

# Run php artisan sys:init in low privilege user context
run_artisan_sys_init

# Install Laravel services (without domain binding)
install_laravel_services

# Restore initial working directory
cd "$INITIAL_WORK_DIR" || true

# ============================================================================
# LEGACY DEPLOYMENT FUNCTIONS (kept for reference, not executed automatically)
# ============================================================================
# To run full deployment, execute: bash deploy.sh --full-deploy
# ============================================================================

if [ "${1:-}" = "--full-deploy" ]; then

# Change to the script's directory
cd "$SCRIPT_DIR"
echo "Changed to directory: $SCRIPT_DIR"

# Function to setup directory permissions
setup_permissions() {
    echo -e "${BLUE}[PERMISSIONS] Fixing directory permissions${NC}"

    local real_user=$(get_real_user)
    echo -e "${BLUE}[PERMISSIONS] Using real user: $real_user${NC}"

    # Create directories that don't exist (never delete existing directories)
    [ ! -d "storage/framework/views" ] && $USE_SUDO mkdir -p storage/framework/views
    [ ! -d "storage/framework/cache" ] && $USE_SUDO mkdir -p storage/framework/cache
    [ ! -d "storage/framework/sessions" ] && $USE_SUDO mkdir -p storage/framework/sessions
    [ ! -d "storage/logs" ] && $USE_SUDO mkdir -p storage/logs
    [ ! -d "bootstrap/cache" ] && $USE_SUDO mkdir -p bootstrap/cache

    # Always fix ownership and permissions for all directories (existing and newly created)
    # Running as root, change ownership to low privilege user
    echo -e "${BLUE}[PERMISSIONS] Fixing ownership to $real_user:$real_user${NC}"
    $USE_SUDO chown -R "$real_user:$real_user" . 2>/dev/null || {
        echo -e "${YELLOW}[PERMISSIONS] Warning: Could not change ownership, fixing permissions only${NC}"
    }

    # Fix directory permissions
    echo -e "${BLUE}[PERMISSIONS] Fixing directory permissions to 755${NC}"
    find . -type d -exec $USE_SUDO chmod 755 {} \; 2>/dev/null || true

    # Fix file permissions
    echo -e "${BLUE}[PERMISSIONS] Fixing file permissions to 644${NC}"
    find . -type f -exec $USE_SUDO chmod 644 {} \; 2>/dev/null || true

    # Set special permissions for storage and bootstrap/cache
    echo -e "${BLUE}[PERMISSIONS] Fixing special permissions for storage and bootstrap/cache${NC}"
    $USE_SUDO chown -R "$real_user:$real_user" storage bootstrap/cache 2>/dev/null || true
    $USE_SUDO chmod -R 775 storage 2>/dev/null || true
    $USE_SUDO chmod -R 775 bootstrap/cache 2>/dev/null || true

    echo -e "${GREEN}[PERMISSIONS] OK Permissions fixed${NC}"
}

# Function to verify PHP installation
verify_php() {
    if command -v php &>/dev/null; then
        php_version=$(php -v | head -n 1 | cut -d " " -f 2)
        echo -e "${GREEN}[VERIFY] PHP version: $php_version${NC}"
        return 0
    else
        echo -e "${RED}[VERIFY] ERROR: PHP is not installed${NC}"
        echo -e "${YELLOW}[VERIFY] Please install PHP before running this script${NC}"
        return 1
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

# Function to verify Composer installation
verify_composer() {
    if command -v composer &>/dev/null; then
        composer_version=$(composer --version | cut -d " " -f 3)
        echo -e "${GREEN}[VERIFY] Composer version: $composer_version${NC}"
        return 0
    else
        echo -e "${RED}[VERIFY] ERROR: Composer is not installed${NC}"
        echo -e "${YELLOW}[VERIFY] Please install Composer before running this script${NC}"
        return 1
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

    # Apply Octane/Swoole compatibility patch immediately after vendor is available
    fix_octane_swoole_compatibility
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

    # 1. Ensure database directory exists and fix permissions
    local real_user=$(get_real_user)
    # Only create if doesn't exist (never delete existing directories)
    if [ ! -d "$DB_DIR" ]; then
        $USE_SUDO mkdir -p "$DB_DIR"
        echo -e "${YELLOW}Created database directory${NC}"
    fi
    # Always fix permissions for directory (existing and newly created)
    # Running as root, change ownership to low privilege user
    $USE_SUDO chown "$real_user:$real_user" "$DB_DIR" 2>/dev/null || true
    $USE_SUDO chmod 755 "$DB_DIR" 2>/dev/null || true

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

    # Always fix proper permissions using real user (running as root, change to low privilege user)
    $USE_SUDO chown "$real_user:$real_user" "$DB_DIR" 2>/dev/null || true
    [ -f "$DB_FILE" ] && $USE_SUDO chown "$real_user:$real_user" "$DB_FILE" 2>/dev/null || true
    $USE_SUDO chmod 755 "$DB_DIR" 2>/dev/null || true
    [ -f "$DB_FILE" ] && $USE_SUDO chmod 644 "$DB_FILE" 2>/dev/null || true
    echo -e "${GREEN}Database setup complete${NC}"
}
# Function to fix Octane/Swoole compatibility
# PHP Version: 8.5 (Upgraded from 8.4)
# Swoole Version: 6.x (Compiled from master for PHP 8.5 compatibility)
#
# Swoole 6.x compatibility patch for Laravel Octane v2.13.x
# Issue: Swoole 6.x changed task event signature (breaking change)
# - Swoole 5.x: task(Server $server, int $taskId, int $fromWorkerId, $data)
# - Swoole 6.x: task(Server $server, Server\Task $task)
#
# This function calls OctaneSwooleCompatFixer.php to apply the patch
# The patch is idempotent (safe to run multiple times)
fix_octane_swoole_compatibility() {
    local laravel_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    local fixer_script="${laravel_root}/app/Support/OctaneSwooleCompatFixer.php"

    # Always try to apply patch, silently skip if conditions not met
    if [ -f "$fixer_script" ] && [ -d "$laravel_root/vendor/laravel/octane" ]; then
        php "$fixer_script" "$laravel_root" >/dev/null 2>&1 || true
    fi

    return 0
}

# Function to install Laravel services (without domain binding)
# Reference: ServerManagerV1PolyAppsCommand.php configureServiceOnly() - installs service without domain
install_laravel_services() {
    echo -e "${BLUE}[SERVICE] Installing Laravel services (without domain binding)${NC}"
    
    local laravel_dir="$LARAVEL_DIR"
    local saved_dir="$(pwd)"
    
    if [ ! -d "$laravel_dir" ]; then
        echo -e "${YELLOW}[SERVICE] Laravel directory not found, skipping service installation${NC}"
        return 0
    fi
    
    cd "$laravel_dir" || return 0
    
    # Install poly app service without domain binding (reference: ServerManagerV1PolyAppsCommand.php line 121-161)
    # php artisan servermanager:poly_apps {appname} without domains parameter = service only mode
    echo -e "${BLUE}[SERVICE] Configuring Laravel main service (service only, no domain binding)...${NC}"
    $USE_SUDO php artisan servermanager:poly_apps laravel_main 2>&1
    
    # Restore original directory
    cd "$saved_dir" || true
}
# Function to configure open_basedir in project's .user.ini
configure_project_open_basedir() {
    echo -e "${BLUE}[PHP CONFIG] Configuring .user.ini${NC}"

    local real_user=$(get_real_user)
    local project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local user_ini_file="$project_root/public/.user.ini"

    # Only create directory if doesn't exist (never delete existing directories)
    [ ! -d "$project_root/public" ] && $USE_SUDO mkdir -p "$project_root/public"

    cat > "$user_ini_file" <<'EOF'
; Disable open_basedir for Laravel poly projects to allow PathMapper environment detection
open_basedir = none

; Security settings
disable_functions = exec,passthru,shell_exec,system,proc_open,popen
expose_php = Off
EOF

    # Always fix permissions (running as root, change to low privilege user)
    $USE_SUDO chown "$real_user:$real_user" "$project_root/public" "$user_ini_file" 2>/dev/null || true
    $USE_SUDO chmod 755 "$project_root/public" 2>/dev/null || true
    $USE_SUDO chmod 644 "$user_ini_file" 2>/dev/null || true
    echo -e "${GREEN}[PHP CONFIG] OK .user.ini configured${NC}"
}

# Check if running on Debian/Ubuntu
if [ -f /etc/debian_version ]; then
    echo "System detected as Debian/Ubuntu"
    
    # Fix prerequisites and common issues first
    fix_prerequisites
    
    ensure_env_file
    ensure_production_environment
    setup_permissions
    verify_php
    ensure_php_extensions
    verify_composer
    ensure_vendor
    fix_octane_swoole_compatibility
    clear_cache
    handle_database
    configure_project_open_basedir
    # Create initialization marker
    touch .laravel_initialized
    echo "Project initialization completed. Marker file created."

else
    echo "This script only supports Debian/Ubuntu systems"
    exit 1
fi

fi  # End of --full-deploy check
