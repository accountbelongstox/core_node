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

# Simplified 12_update.sh - Repository management and system initialization
# Most functionality has been moved to apt_repository_manager.sh
# This script now only handles system initialization and calls repository manager

# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Source repository manager (trust-based programming)
source "$PARENT_DIR_LEVEL_2/common/apt_repository_manager.sh"

# Check if running as root or with sudo
if [ "$(id -u)" -ne 0 ] && [ -z "$USE_SUDO" ]; then
    echo "Error: This script must be run as root or with sudo!"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to initialize core_node shared directories
initialize_core_node_directories() {
    echo "Initializing core_node shared directories..."

    local CORE_NODE_BASE="${CORE_NODE_DATA_DIR}"
    local SHARED_DOWNLOADS="${CORE_NODE_SHARED_DOWNLOADS}"

    if $USE_SUDO mkdir -p "$CORE_NODE_BASE" 2>/dev/null; then
        $USE_SUDO chmod 777 "$CORE_NODE_BASE" 2>/dev/null || true
        echo "Created base directory: $CORE_NODE_BASE"
    fi

    if $USE_SUDO mkdir -p "$SHARED_DOWNLOADS" 2>/dev/null; then
        $USE_SUDO chmod 777 "$SHARED_DOWNLOADS" 2>/dev/null || true
        echo "Created shared downloads directory: $SHARED_DOWNLOADS"
    fi
}

# Function to install essential packages and configure Git
install_packages_and_configure_git() {
    echo "Installing essential packages..."
    $USE_SUDO apt install -y lsof cron curl vim git build-essential rsync htop \
        nano wget openssl libssl-dev zlib1g-dev libbz2-dev \
        libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
        xz-utils tk-dev libffi-dev liblzma-dev make software-properties-common \
        cron dnsutils libvips-dev cpulimit expect tar gzip procps

    # Configure Git globally
    git config --global http.sslVerify "false"
    git config --global user.name "prop-dev"
    git config --global user.email "prop-dev@serve.com"
    echo "Essential packages installed."
}

# Function to fix temporary directory permissions
fix_temp_permissions() {
    echo "Fixing temporary directory permissions..."
    
    $USE_SUDO chmod 1777 /tmp
    $USE_SUDO chown root:root /tmp
    
    $USE_SUDO mkdir -p /var/cache/apt/archives/partial
    $USE_SUDO mkdir -p /var/lib/apt/lists/partial
    $USE_SUDO mkdir -p /var/log/apt
    
    $USE_SUDO chmod 755 /var/cache/apt/archives/partial
    $USE_SUDO chmod 755 /var/lib/apt/lists/partial
    $USE_SUDO chmod 755 /var/log/apt
    
    $USE_SUDO rm -f /tmp/apt.conf.* 2>/dev/null || true
    $USE_SUDO rm -f /tmp/apt-key.* 2>/dev/null || true
    
    echo "Temporary directory permissions fixed"
}

# Main execution
echo "Starting system update and initialization..."

# Initialize core_node directories
initialize_core_node_directories

# Check for skip GPG flag
SKIP_GPG_FIXES=false
if [ "$1" = "--skip-gpg" ] || [ "$1" = "-s" ]; then
    SKIP_GPG_FIXES=true
    echo "Repository repair disabled by user flag"
fi

# Fix temporary directory permissions
fix_temp_permissions

# Execute repository repair using enhanced repository manager
if [ "$SKIP_GPG_FIXES" = true ]; then
    echo "Skipping repository repair as requested..."
    $USE_SUDO sh -c 'echo "APT::Get::AllowUnauthenticated \"true\";" > /etc/apt/apt.conf.d/99allow-unauth' 2>/dev/null || true
else
    echo "=== Repository Repair and Verification ==="
    
    # Use enhanced repository manager to repair repositories
    echo "Using enhanced repository manager for comprehensive repair..."
    repair_repositories_from_apt_repository_manager
    
    # Verify repository health
    echo "Verifying repository health..."
    if verify_repository_health_from_apt_repository_manager; then
        echo "=== Repository Repair Successful ==="
    else
        echo "=== Repository Repair Partially Successful ==="
    fi
fi

# Manage repositories based on configuration
echo "Managing repositories based on configuration..."
manage_repositories_from_apt_repository_manager

# Update package lists
echo "Updating package lists..."
$USE_SUDO apt update 2>/dev/null || $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || true

# Install packages and configure Git
install_packages_and_configure_git

# Fix system parameters
echo "Configuring system parameters..."
$USE_SUDO sysctl fs.inotify.max_user_watches=524288 2>/dev/null || true
$USE_SUDO sysctl -p 2>/dev/null || true

# Final cleanup
echo "Performing final cleanup..."
$USE_SUDO rm -rf /tmp/apt.* /tmp/apt-key.* 2>/dev/null || true

echo "Setup completed successfully!"
