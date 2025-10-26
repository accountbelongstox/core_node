#!/bin/bash
# Script: 34_install_composer.sh
# Description: Dedicated Composer installation with PHP 8.4
# Author: System Administrator
# Version: 1.0

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_INDEX="[34_COMPOSER]"

# Source dependencies
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source PHP common variables and functions
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_vars.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_functions.sh"

# Configuration - using variables from php_common_vars.sh
PHP_BINARY="/usr/local/bin/php"

# USE_SUDO is now sourced from gvar_common.sh
# Set Composer environment based on user privileges
if [ "$EUID" -eq 0 ]; then
    # Auto-allow Composer to run as root without interactive prompt
    export COMPOSER_ALLOW_SUPERUSER=1
    export COMPOSER_NO_INTERACTION=1
    echo -e "${YELLOW}$SCRIPT_INDEX Running as root - Composer warnings automatically handled${NC}"
else
    # Ensure non-interactive mode for consistency
    export COMPOSER_NO_INTERACTION=1
fi

# Check if original Composer binary exists and is working
is_original_composer_working() {
    if [ -f "${COMPOSER_TARGET_PATH}.original" ] && [ -x "${COMPOSER_TARGET_PATH}.original" ]; then
        # Test original composer binary directly
        if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d open_basedir= "${COMPOSER_TARGET_PATH}.original" --version >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Check if wrapper exists and is working
is_composer_wrapper_working() {
    if [ -f "$COMPOSER_TARGET_PATH" ] && [ -x "$COMPOSER_TARGET_PATH" ]; then
        # Check if it's a wrapper (contains "#!/bin/bash" and "composer.original")
        if head -n 1 "$COMPOSER_TARGET_PATH" | grep -q "#!/bin/bash" && grep -q "composer.original" "$COMPOSER_TARGET_PATH"; then
            # Test wrapper functionality
            if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_TARGET_PATH" --version >/dev/null 2>&1; then
                return 0
            fi
        fi
    fi
    return 1
}

# Get Composer version from original binary
get_composer_version() {
    if is_original_composer_working; then
        COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d open_basedir= "${COMPOSER_TARGET_PATH}.original" --version 2>/dev/null | grep -oP 'Composer version \K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown"
    else
        echo "not_installed"
    fi
}

# Check if Composer installation is complete and working
is_composer_installation_complete() {
    # Both original binary and wrapper must exist and work
    if is_original_composer_working && is_composer_wrapper_working; then
        return 0
    fi
    return 1
}

# Check command line arguments
FORCE_REINSTALL=false
if [ "$1" = "--force" ] || [ "$1" = "-f" ]; then
    FORCE_REINSTALL=true
    echo -e "${YELLOW}$SCRIPT_INDEX Force reinstall requested${NC}"
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo -e "${CYAN}$SCRIPT_INDEX Composer Installation Script for PHP 8.4${NC}"
    echo -e "${CYAN}Usage: $0 [options]${NC}"
    echo -e "${CYAN}Options:${NC}"
    echo -e "${CYAN}  --force, -f    Force reinstall and recreate all wrappers${NC}"
    echo -e "${CYAN}  --help, -h     Show this help message${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}This script will:${NC}"
    echo -e "${CYAN}  1. Install/update Composer for PHP 8.4${NC}"
    echo -e "${CYAN}  2. Create wrapper scripts to handle root warnings and open_basedir${NC}"
    echo -e "${CYAN}  3. Verify all components are working correctly${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Created files:${NC}"
    echo -e "${CYAN}  /usr/local/bin/composer          (main wrapper)${NC}"
    echo -e "${CYAN}  /usr/local/bin/composer-safe     (explicit safe wrapper)${NC}"
    echo -e "${CYAN}  /usr/local/bin/composer.original (original Composer binary)${NC}"
    exit 0
fi

# Simple installation check
main() {
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Composer Installation for PHP 8.4${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    # Check PHP 8.4 availability
    if [ ! -x "$PHP_BINARY" ]; then
        echo -e "${RED}$SCRIPT_INDEX PHP 8.4 not found at $PHP_BINARY${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Please run 31_ensure_php84_intelligent.sh first${NC}"
        exit 1
    fi

    if ! "$PHP_BINARY" --version | grep -q "PHP 8.4"; then
        echo -e "${RED}$SCRIPT_INDEX $PHP_BINARY is not PHP 8.4${NC}"
        exit 1
    fi

    echo -e "${GREEN}$SCRIPT_INDEX PHP 8.4 confirmed at $PHP_BINARY${NC}"

    # Check current Composer installation status
    local current_version=$(get_composer_version)
    if [ "$current_version" != "not_installed" ] && is_composer_installation_complete && [ "$FORCE_REINSTALL" = false ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Composer $current_version is already installed and working${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Location: $COMPOSER_TARGET_PATH (wrapper)${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Original: ${COMPOSER_TARGET_PATH}.original${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Safe wrapper: /usr/local/bin/composer-safe${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Use --force to reinstall and recreate wrappers${NC}"
        exit 0
    elif [ "$current_version" != "not_installed" ] && [ "$FORCE_REINSTALL" = false ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Composer $current_version found but installation is incomplete${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Missing wrappers or original binary, reinstalling...${NC}"
    fi

    # Show environment configuration
    if [ "$EUID" -eq 0 ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Root user detected - Composer warnings will be automatically handled${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Environment: COMPOSER_ALLOW_SUPERUSER=1, COMPOSER_NO_INTERACTION=1${NC}"
    else
        echo -e "${CYAN}$SCRIPT_INDEX Non-interactive mode enabled: COMPOSER_NO_INTERACTION=1${NC}"
    fi

    # Clean install - remove all composer-related files to ensure clean state
    echo -e "${CYAN}$SCRIPT_INDEX Cleaning existing Composer installations...${NC}"
    $USE_SUDO rm -f "$COMPOSER_TARGET_PATH" 2>/dev/null || true
    $USE_SUDO rm -f "${COMPOSER_TARGET_PATH}.original" 2>/dev/null || true
    $USE_SUDO rm -f "/usr/local/bin/composer-safe" 2>/dev/null || true
    $USE_SUDO rm -f "/usr/local/bin/composer-php84" 2>/dev/null || true

    # Only download and install Composer if original binary doesn't exist
    if ! is_original_composer_working; then
        echo -e "${YELLOW}$SCRIPT_INDEX Composer not found, downloading and installing...${NC}"
        
        # Create temp directory
        local temp_dir=$(mktemp -d)
        local original_dir=$(pwd)
        cd "$temp_dir"

        # Download installer
        echo -e "${CYAN}$SCRIPT_INDEX Downloading Composer installer...${NC}"
        if ! curl -fsSL "$COMPOSER_DOWNLOAD_URL" -o composer-setup.php; then
            echo -e "${RED}$SCRIPT_INDEX Failed to download Composer installer${NC}"
            cd "$original_dir"
            rm -rf "$temp_dir"
            exit 1
        fi

    # Install with open_basedir disabled and environment variables set
    echo -e "${CYAN}$SCRIPT_INDEX Installing Composer...${NC}"
    if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d "open_basedir=none" composer-setup.php --install-dir=/usr/local/bin --filename=composer; then
            echo -e "${GREEN}$SCRIPT_INDEX Composer installed successfully${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX Composer installation failed${NC}"
            cd "$original_dir"
            rm -rf "$temp_dir"
            exit 1
        fi

        # Make executable
        $USE_SUDO chmod +x "$COMPOSER_TARGET_PATH"
        
        # Clean up temp directory
        cd "$original_dir"
        rm -rf "$temp_dir"
    else
        echo -e "${GREEN}$SCRIPT_INDEX Original Composer binary already exists, skipping download${NC}"
    fi

    # Ensure we have the original composer binary
    if [ ! -f "${COMPOSER_TARGET_PATH}.original" ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Moving Composer to original location...${NC}"
        $USE_SUDO mv "$COMPOSER_TARGET_PATH" "${COMPOSER_TARGET_PATH}.original"
    fi

    # Create global wrapper to handle root warnings and open_basedir
    echo -e "${CYAN}$SCRIPT_INDEX Creating global Composer wrapper...${NC}"
    $USE_SUDO tee /usr/local/bin/composer-safe > /dev/null << 'EOF'
#!/bin/bash
# Global Composer wrapper that handles root warnings and open_basedir restrictions
# Usage: composer-safe [composer-arguments]

# Auto-handle root user warnings
export COMPOSER_ALLOW_SUPERUSER=1
export COMPOSER_NO_INTERACTION=1

# Execute original composer with open_basedir disabled for maximum compatibility
# This wrapper directly calls the original composer binary, not the wrapper
# open_basedir is set to none to allow access to all system directories
exec /usr/local/bin/php -d "open_basedir=none" /usr/local/bin/composer.original "$@"
EOF
    $USE_SUDO chmod +x /usr/local/bin/composer-safe

    # Create main composer wrapper
    echo -e "${CYAN}$SCRIPT_INDEX Creating composer wrapper for better compatibility...${NC}"
    $USE_SUDO tee "$COMPOSER_TARGET_PATH" > /dev/null << 'EOF'
#!/bin/bash
# Composer wrapper with automatic environment handling

# Auto-handle root user warnings
if [ "$EUID" -eq 0 ]; then
    export COMPOSER_ALLOW_SUPERUSER=1
    export COMPOSER_NO_INTERACTION=1
fi

# Execute original composer with open_basedir disabled for maximum compatibility
# open_basedir is set to none to allow access to all system directories
exec /usr/local/bin/php -d "open_basedir=none" /usr/local/bin/composer.original "$@"
EOF
    $USE_SUDO chmod +x "$COMPOSER_TARGET_PATH"

    # Verify all wrappers are working correctly
    echo -e "${CYAN}$SCRIPT_INDEX Verifying all Composer wrappers...${NC}"
    
    # Test main composer wrapper
    if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_TARGET_PATH" --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX [OK] Main composer wrapper working${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX [FAIL] Main composer wrapper failed${NC}"
        exit 1
    fi
    
    # Test composer-safe wrapper
    if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 /usr/local/bin/composer-safe --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX [OK] Composer-safe wrapper working${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX [FAIL] Composer-safe wrapper failed${NC}"
        exit 1
    fi
    
    # Test original composer binary
    if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d open_basedir= "${COMPOSER_TARGET_PATH}.original" --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX [OK] Original composer binary working${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX [FAIL] Original composer binary failed${NC}"
        exit 1
    fi

    # Final verification with environment variables
    local final_version=$(get_composer_version)
    if [ "$final_version" != "not_installed" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX [OK] Composer $final_version installed successfully${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX [OK] Location: $COMPOSER_TARGET_PATH${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX [OK] Safe wrapper: /usr/local/bin/composer-safe${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX [OK] Original binary: ${COMPOSER_TARGET_PATH}.original${NC}"
               echo -e "${CYAN}$SCRIPT_INDEX Enhanced Composer Commands:${NC}"
               echo -e "${CYAN}$SCRIPT_INDEX   composer --version         (auto-handles root warnings + open_basedir=none)${NC}"
               echo -e "${CYAN}$SCRIPT_INDEX   composer-safe --version    (explicit safe wrapper)${NC}"
               echo -e "${YELLOW}$SCRIPT_INDEX Note: All wrappers automatically handle root warnings and have open_basedir=none for maximum compatibility${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX [FAIL] Composer installation verification failed${NC}"
        exit 1
    fi
}

# Execute main function
main "$@"
