#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# ============================================================================
# Laravel Deployment Script with UP Method Support
# ============================================================================
# This script provides reusable functions for Laravel project deployment
# Includes versioned up() methods for incremental updates
# ============================================================================

# ============================================================================
# COMMAND PRINTING FUNCTION
# ============================================================================
# Print command before execution for debugging and transparency
print_cmd() {
    echo -e "${YELLOW}[CMD]${NC} $*" >&2
}

# ============================================================================
# CONSTANTS - All constants defined at the beginning
# ============================================================================

# Script directory (deploy.sh location)
print_cmd "cd \"\$(dirname \"\${BASH_SOURCE[0]}\")\" && pwd"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Save initial working directory
print_cmd "pwd"
INITIAL_WORK_DIR="$(pwd)"

# Path constants based on SCRIPT_DIR
print_cmd "cd \"${SCRIPT_DIR}/..\" && pwd"
LARAVEL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMMON_SCRIPTS_DIR="${SCRIPT_DIR}/../../../scripts/shells/linux/common"
GVAR_COMMON="${COMMON_SCRIPTS_DIR}/gvar_common.sh"
COMMON_FUNCTIONS="${COMMON_SCRIPTS_DIR}/common_functions.sh"
GET_REAL_USER_SCRIPT="${COMMON_SCRIPTS_DIR}/get_real_user.sh"
DEPLOY_UP_METHODS="${SCRIPT_DIR}/deploy_up_methods.sh"

# ============================================================================
# SOURCE COMMON SCRIPTS
# ============================================================================

# Source gvar_common.sh for environment detection and path mapping
print_cmd "source \"$GVAR_COMMON\""
source "$GVAR_COMMON"

# Source common_functions.sh for engineering color output functions
print_cmd "source \"$COMMON_FUNCTIONS\""
source "$COMMON_FUNCTIONS"

print_cmd "source \"$GET_REAL_USER_SCRIPT\""
source "$GET_REAL_USER_SCRIPT"
source "$DEPLOY_UP_METHODS"

# ============================================================================
# GLOBAL VARIABLES - Set after sourcing common scripts
# ============================================================================
# These variables depend on functions/scripts loaded above

# Get real user (depends on get_real_user function)
print_cmd "get_real_user"
REAL_USER=$(get_real_user)

# Get web root path (depends on map_web_path function from gvar_common.sh)
print_cmd "map_web_path \"wwwroot\""
WWW_ROOT=$(map_web_path "wwwroot")

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
    
    echo -e "${BLUE}Real User:${NC}"
    echo -e "  REAL_USER: ${REAL_USER}"
    
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

# Check initialization - ensure directories and permissions
check_initialization() {
    echo -e "${BLUE}[INIT] Fixing Laravel environment permissions${NC}"

    print_cmd "pwd"
    local saved_dir="$(pwd)"
    print_cmd "cd \"$LARAVEL_DIR\""
    cd "$LARAVEL_DIR" || return 1

    # Create Laravel directories that don't exist (never delete existing directories)
    if [ ! -d "storage/framework/sessions" ]; then
        print_cmd "$USE_SUDO mkdir -p storage/framework/sessions"
        $USE_SUDO mkdir -p storage/framework/sessions
    fi
    if [ ! -d "storage/framework/cache" ]; then
        print_cmd "$USE_SUDO mkdir -p storage/framework/cache"
        $USE_SUDO mkdir -p storage/framework/cache
    fi
    if [ ! -d "storage/framework/views" ]; then
        print_cmd "$USE_SUDO mkdir -p storage/framework/views"
        $USE_SUDO mkdir -p storage/framework/views
    fi
    if [ ! -d "storage/logs" ]; then
        print_cmd "$USE_SUDO mkdir -p storage/logs"
        $USE_SUDO mkdir -p storage/logs
    fi
    if [ ! -d "storage/app/public" ]; then
        print_cmd "$USE_SUDO mkdir -p storage/app/public"
        $USE_SUDO mkdir -p storage/app/public
    fi
    if [ ! -d "bootstrap/cache" ]; then
        print_cmd "$USE_SUDO mkdir -p bootstrap/cache"
        $USE_SUDO mkdir -p bootstrap/cache
    fi

    # Create external directories for PathMapper that don't exist
    if [ ! -d "$WWW_ROOT/laravel_db/sessions" ]; then
        print_cmd "$USE_SUDO mkdir -p \"$WWW_ROOT/laravel_db/sessions\""
        $USE_SUDO mkdir -p "$WWW_ROOT/laravel_db/sessions"
    fi
    if [ ! -d "$WWW_ROOT/laravel_db/tmp" ]; then
        print_cmd "$USE_SUDO mkdir -p \"$WWW_ROOT/laravel_db/tmp\""
        $USE_SUDO mkdir -p "$WWW_ROOT/laravel_db/tmp"
    fi

    # Always fix permissions for all directories (existing and newly created)
    # Running as root, change ownership to low privilege user
    if [ "$IS_WSL" = true ]; then
        print_cmd "$USE_SUDO chmod -R 777 storage bootstrap/cache 2>/dev/null || true"
        $USE_SUDO chmod -R 777 storage bootstrap/cache 2>/dev/null || true
        print_cmd "$USE_SUDO chmod -R 777 \"$WWW_ROOT/laravel_db\" 2>/dev/null || true"
        $USE_SUDO chmod -R 777 "$WWW_ROOT/laravel_db" 2>/dev/null || true
    else
        # Fix ownership to real user (running as root, change to low privilege user)
        print_cmd "$USE_SUDO chown -R \"$REAL_USER:$REAL_USER\" storage bootstrap/cache \"$WWW_ROOT/laravel_db\" 2>/dev/null || true"
        $USE_SUDO chown -R "$REAL_USER:$REAL_USER" storage bootstrap/cache "$WWW_ROOT/laravel_db" 2>/dev/null || true
        print_cmd "$USE_SUDO chmod -R 775 storage bootstrap/cache \"$WWW_ROOT/laravel_db\" 2>/dev/null || true"
        $USE_SUDO chmod -R 775 storage bootstrap/cache "$WWW_ROOT/laravel_db" 2>/dev/null || true
    fi

    # Fix permissions for Laravel root directory (../ from script location)
    echo -e "${BLUE}[INIT] Fixing Laravel root directory permissions${NC}"
    if [ "$IS_WSL" = true ]; then
        print_cmd "$USE_SUDO chmod -R 777 \"$LARAVEL_DIR\" 2>/dev/null || true"
        $USE_SUDO chmod -R 777 "$LARAVEL_DIR" 2>/dev/null || true
    else
        # Fix ownership to real user (running as root, change to low privilege user)
        print_cmd "$USE_SUDO chown -R \"$REAL_USER:$REAL_USER\" \"$LARAVEL_DIR\" 2>/dev/null || true"
        $USE_SUDO chown -R "$REAL_USER:$REAL_USER" "$LARAVEL_DIR" 2>/dev/null || true
        print_cmd "$USE_SUDO chmod -R 755 \"$LARAVEL_DIR\" 2>/dev/null || true"
        $USE_SUDO chmod -R 755 "$LARAVEL_DIR" 2>/dev/null || true
        # Special permissions for writable directories
        print_cmd "$USE_SUDO chmod -R 775 \"$LARAVEL_DIR/storage\" \"$LARAVEL_DIR/bootstrap/cache\" 2>/dev/null || true"
        $USE_SUDO chmod -R 775 "$LARAVEL_DIR/storage" "$LARAVEL_DIR/bootstrap/cache" 2>/dev/null || true
    fi

    echo -e "${GREEN}[INIT] OK Environment permissions fixed${NC}"
    
    # Restore original directory
    print_cmd "cd \"$saved_dir\""
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
    print_cmd "pwd"
    local current_dir=$(pwd)
    local project_root="${CORE_NODE_DIR}"
    
    # Add current directory and project root to Git safe directories
    print_cmd "git config --global --add safe.directory \"$current_dir\" 2>/dev/null || true"
    git config --global --add safe.directory "$current_dir" 2>/dev/null || true
    print_cmd "git config --global --add safe.directory \"$project_root\" 2>/dev/null || true"
    git config --global --add safe.directory "$project_root" 2>/dev/null || true
    
    # Also add any parent directories that might be causing issues
    print_cmd "dirname \"$current_dir\""
    local parent_dir=$(dirname "$current_dir")
    print_cmd "git config --global --add safe.directory \"$parent_dir\" 2>/dev/null || true"
    git config --global --add safe.directory "$parent_dir" 2>/dev/null || true
    
    echo -e "${GREEN}[OK] Git safe directories configured${NC}"
    
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
        print_cmd "sudo apt update >/dev/null 2>&1"
        if sudo apt update >/dev/null 2>&1; then
            echo -e "${GREEN}[OK] Package list updated${NC}"
        else
            echo -e "${RED}[ERROR] Failed to update package list${NC}"
        fi
        
        # Install missing tools
        for tool in "${tools_needed[@]}"; do
            print_cmd "sudo apt install -y \"$tool\" >/dev/null 2>&1"
            if sudo apt install -y "$tool" >/dev/null 2>&1; then
                echo -e "${GREEN}[OK] Installed $tool${NC}"
            else
                echo -e "${RED}[ERROR] Failed to install $tool${NC}"
            fi
        done
    else
        echo -e "${GREEN}[OK] Archive extraction tools already available${NC}"
    fi
    
    # 3. Fix file permissions for WSL (common issue)
    echo -e "${YELLOW}Fixing file permissions...${NC}"
    
    # Fix script permissions
    if [ -f "$(basename "$0")" ]; then
        print_cmd "chmod +x \"\$(basename \"\$0\")\" 2>/dev/null || true"
        chmod +x "$(basename "$0")" 2>/dev/null || true
    fi
    
    # Fix common Laravel file permissions
    if [ -f "artisan" ]; then
        print_cmd "chmod +x artisan 2>/dev/null || true"
        chmod +x artisan 2>/dev/null || true
        echo -e "${GREEN}[OK] Fixed artisan permissions${NC}"
    fi
    
    # 4. Verify Git functionality
    echo -e "${YELLOW}Verifying Git functionality...${NC}"
    print_cmd "git status >/dev/null 2>&1"
    if git status >/dev/null 2>&1; then
        echo -e "${GREEN}[OK] Git is working properly${NC}"
    else
        echo -e "${YELLOW}[WARNING] Git may still have issues, but continuing...${NC}"
    fi
    
    # 5. Check Composer functionality
    echo -e "${YELLOW}Checking Composer zip handling...${NC}"
    if command -v unzip >/dev/null 2>&1 || command -v 7z >/dev/null 2>&1 || command -v 7za >/dev/null 2>&1; then
        echo -e "${GREEN}[OK] Archive extraction tools available for Composer${NC}"
    else
        echo -e "${YELLOW}[WARNING] No archive tools found - Composer will use PHP zip extension${NC}"
    fi
    
    echo -e "${GREEN}[PREREQUISITES] Setup complete${NC}\n"
}

# Initialize Laravel through the canonical application command.
run_artisan_sys_init() {
    local saved_dir="$(pwd)"

    if [ ! -f "$LARAVEL_DIR/artisan" ]; then
        echo -e "${RED}[ARTISAN] artisan file not found at $LARAVEL_DIR/artisan${NC}"
        return 1
    fi

    print_cmd "cd \"$LARAVEL_DIR\""
    cd "$LARAVEL_DIR" || return 1

    if [ -n "$USE_SUDO" ] && [ "$(id -u)" -eq 0 ]; then
        print_cmd "$USE_SUDO -u \"$REAL_USER\" php artisan config:clear"
        if ! $USE_SUDO -u "$REAL_USER" php artisan config:clear; then
            cd "$saved_dir" || true
            return 1
        fi
        print_cmd "$USE_SUDO -u \"$REAL_USER\" php artisan sys:init 2>&1"
        if ! $USE_SUDO -u "$REAL_USER" php artisan sys:init; then
            cd "$saved_dir" || true
            return 1
        fi
    else
        print_cmd "php artisan config:clear"
        if ! php artisan config:clear; then
            cd "$saved_dir" || true
            return 1
        fi
        print_cmd "php artisan sys:init"
        if ! php artisan sys:init; then
            cd "$saved_dir" || true
            return 1
        fi
    fi

    print_cmd "cd \"$saved_dir\""
    cd "$saved_dir" || true

    echo -e "${GREEN}[ARTISAN] OK Laravel runtime initialized${NC}"
    return 0
}

# Function to install Laravel services (without domain binding)
# Uses unified laravel_service_manager.sh -> start_service.sh (Octane/Swoole)
# Same code path as App Manager "Ns" command for consistent systemd services
install_laravel_services() {
    echo -e "${BLUE}[SERVICE] Installing Laravel services (without domain binding)${NC}"

    local saved_dir="$(pwd)"

    if [ ! -d "$LARAVEL_DIR" ]; then
        echo -e "${YELLOW}[SERVICE] Laravel directory not found, skipping service installation${NC}"
        return 0
    fi

    local laravel_svc_mgr="$LARAVEL_DIR/../../../scripts/unified_manager/modules/laravel_service_manager.sh"
    # Resolve to absolute path
    laravel_svc_mgr="$(cd "$(dirname "$laravel_svc_mgr")" 2>/dev/null && pwd)/$(basename "$laravel_svc_mgr")"

    if [ -f "$laravel_svc_mgr" ]; then
        echo -e "${BLUE}[SERVICE] Using unified laravel_service_manager.sh${NC}"
        # Only source if install_laravel_service is not already available
        if ! type install_laravel_service >/dev/null 2>&1; then
            source "$laravel_svc_mgr"
        fi
        local app_name
        app_name="$(basename "$LARAVEL_DIR")"
        print_cmd "install_laravel_service \"$app_name\""
        install_laravel_service "$app_name" 2>&1
    else
        # Fallback: direct artisan command (legacy path)
        echo -e "${YELLOW}[SERVICE] Unified manager not found, falling back to direct artisan command${NC}"
        print_cmd "cd \"$LARAVEL_DIR\""
        cd "$LARAVEL_DIR" || return 0
        print_cmd "$USE_SUDO php artisan servermanager:poly_apps $(basename "$LARAVEL_DIR") 2>&1"
        $USE_SUDO php artisan servermanager:poly_apps "$(basename "$LARAVEL_DIR")" 2>&1
    fi

    # Restore original directory
    print_cmd "cd \"$saved_dir\""
    cd "$saved_dir" || true
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
print_cmd "cd \"$INITIAL_WORK_DIR\""
cd "$INITIAL_WORK_DIR" || true

# ============================================================================
# OPTIONAL FULL DEPLOYMENT FUNCTIONS
# ============================================================================
# To run full deployment, execute: bash deploy.sh --full-deploy
# ============================================================================

if [ "${1:-}" = "--full-deploy" ]; then

# Change to the script's directory
print_cmd "cd \"$SCRIPT_DIR\""
cd "$SCRIPT_DIR"
echo "Changed to directory: $SCRIPT_DIR"

# Function to setup directory permissions
setup_permissions() {
    echo -e "${BLUE}[PERMISSIONS] Fixing directory permissions${NC}"

    echo -e "${BLUE}[PERMISSIONS] Using real user: $REAL_USER${NC}"

    # Create directories that don't exist (never delete existing directories)
    if [ ! -d "storage/framework/views" ]; then
        print_cmd "$USE_SUDO mkdir -p storage/framework/views"
        $USE_SUDO mkdir -p storage/framework/views
    fi
    if [ ! -d "storage/framework/cache" ]; then
        print_cmd "$USE_SUDO mkdir -p storage/framework/cache"
        $USE_SUDO mkdir -p storage/framework/cache
    fi
    if [ ! -d "storage/framework/sessions" ]; then
        print_cmd "$USE_SUDO mkdir -p storage/framework/sessions"
        $USE_SUDO mkdir -p storage/framework/sessions
    fi
    if [ ! -d "storage/logs" ]; then
        print_cmd "$USE_SUDO mkdir -p storage/logs"
        $USE_SUDO mkdir -p storage/logs
    fi
    if [ ! -d "bootstrap/cache" ]; then
        print_cmd "$USE_SUDO mkdir -p bootstrap/cache"
        $USE_SUDO mkdir -p bootstrap/cache
    fi

    # Always fix ownership and permissions for all directories (existing and newly created)
    # Running as root, change ownership to low privilege user
    echo -e "${BLUE}[PERMISSIONS] Fixing ownership to $real_user:$real_user${NC}"
    print_cmd "$USE_SUDO chown -R \"$real_user:$real_user\" . 2>/dev/null || true"
    $USE_SUDO chown -R "$real_user:$real_user" . 2>/dev/null || {
        echo -e "${YELLOW}[PERMISSIONS] Warning: Could not change ownership, fixing permissions only${NC}"
    }

    # Fix directory permissions
    echo -e "${BLUE}[PERMISSIONS] Fixing directory permissions to 755${NC}"
    print_cmd "find . -type d -exec $USE_SUDO chmod 755 {} \\; 2>/dev/null || true"
    find . -type d -exec $USE_SUDO chmod 755 {} \; 2>/dev/null || true

    # Fix file permissions
    echo -e "${BLUE}[PERMISSIONS] Fixing file permissions to 644${NC}"
    print_cmd "find . -type f -exec $USE_SUDO chmod 644 {} \\; 2>/dev/null || true"
    find . -type f -exec $USE_SUDO chmod 644 {} \; 2>/dev/null || true

    # Set special permissions for storage and bootstrap/cache
    echo -e "${BLUE}[PERMISSIONS] Fixing special permissions for storage and bootstrap/cache${NC}"
        print_cmd "$USE_SUDO chown -R \"$REAL_USER:$REAL_USER\" storage bootstrap/cache 2>/dev/null || true"
        $USE_SUDO chown -R "$REAL_USER:$REAL_USER" storage bootstrap/cache 2>/dev/null || true
    print_cmd "$USE_SUDO chmod -R 775 storage 2>/dev/null || true"
    $USE_SUDO chmod -R 775 storage 2>/dev/null || true
    print_cmd "$USE_SUDO chmod -R 775 bootstrap/cache 2>/dev/null || true"
    $USE_SUDO chmod -R 775 bootstrap/cache 2>/dev/null || true

    echo -e "${GREEN}[PERMISSIONS] OK Permissions fixed${NC}"
}

# Function to verify PHP installation
verify_php() {
    print_cmd "command -v php"
    if command -v php &>/dev/null; then
        print_cmd "php -v | head -n 1 | cut -d \" \" -f 2"
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
    print_cmd "php -m | grep -q 'dom'"
    if ! php -m | grep -q 'dom'; then
        echo "PHP extension 'dom' not found. Installing..."
        print_cmd "sudo apt update"
        sudo apt update
        print_cmd "sudo apt install -y php-xml"
        sudo apt install -y php-xml
    fi
    print_cmd "php -m | grep -q 'xml'"
    if ! php -m | grep -q 'xml'; then
        echo "PHP extension 'xml' not found. Installing..."
        print_cmd "sudo apt update"
        sudo apt update
        print_cmd "sudo apt install -y php-xml"
        sudo apt install -y php-xml
    fi
}

# Function to verify Composer installation
verify_composer() {
    print_cmd "command -v composer"
    if command -v composer &>/dev/null; then
        print_cmd "composer --version | cut -d \" \" -f 3"
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
    print_cmd "test -d \"vendor\""
    if [ ! -d "vendor" ]; then
        echo "Vendor directory not found. Installing dependencies..."
        print_cmd "composer install"
        composer install
    else
        echo "Vendor directory exists."
    fi
}

# Function to configure open_basedir in project's .user.ini
configure_project_open_basedir() {
    echo -e "${BLUE}[PHP CONFIG] Configuring .user.ini${NC}"

    local project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local user_ini_file="$project_root/public/.user.ini"

    # Only create directory if doesn't exist (never delete existing directories)
    if [ ! -d "$project_root/public" ]; then
        print_cmd "$USE_SUDO mkdir -p \"$project_root/public\""
        $USE_SUDO mkdir -p "$project_root/public"
    fi

    print_cmd "cat > \"$user_ini_file\" <<'EOF'"
    cat > "$user_ini_file" <<'EOF'
; Disable open_basedir for Laravel poly projects to allow PathMapper environment detection
open_basedir = none

; Security settings
disable_functions = exec,passthru,shell_exec,system,proc_open,popen
expose_php = Off
EOF

    # Always fix permissions (running as root, change to low privilege user)
    print_cmd "$USE_SUDO chown \"$REAL_USER:$REAL_USER\" \"$project_root/public\" \"$user_ini_file\" 2>/dev/null || true"
    $USE_SUDO chown "$REAL_USER:$REAL_USER" "$project_root/public" "$user_ini_file" 2>/dev/null || true
    print_cmd "$USE_SUDO chmod 755 \"$project_root/public\" 2>/dev/null || true"
    $USE_SUDO chmod 755 "$project_root/public" 2>/dev/null || true
    print_cmd "$USE_SUDO chmod 644 \"$user_ini_file\" 2>/dev/null || true"
    $USE_SUDO chmod 644 "$user_ini_file" 2>/dev/null || true
    echo -e "${GREEN}[PHP CONFIG] OK .user.ini configured${NC}"
}

# Check if running on Debian/Ubuntu
if [ -f /etc/debian_version ]; then
    echo "System detected as Debian/Ubuntu"
    
    # Fix prerequisites and common issues first
    fix_prerequisites
    
    setup_permissions
    verify_php
    ensure_php_extensions
    verify_composer
    ensure_vendor
    configure_project_open_basedir
    # Create initialization marker
    print_cmd "touch .laravel_initialized"
    touch .laravel_initialized
    echo "Project initialization completed. Marker file created."

else
    echo "This script only supports Debian/Ubuntu systems"
    exit 1
fi

fi  # End of --full-deploy check
