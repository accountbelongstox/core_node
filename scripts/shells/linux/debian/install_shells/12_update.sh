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

# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Source repository manager for repair functions
source "$PARENT_DIR_LEVEL_1/debian_com/repository_manager.sh"

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This script must be run as root!"
    echo "Please run: $USE_SUDO bash $0"
    exit 1
fi

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

# Main execution
echo "Starting system update and repair process..."

# Use repository manager's repair functions
echo "Repairing apt repositories using repository manager..."
manage_repositories

# Try to update package lists
echo "Updating package lists..."
if ! $USE_SUDO apt update; then
    echo "Standard update failed, trying with --allow-unauthenticated..."
    $USE_SUDO apt update --allow-unauthenticated || {
        echo "Warning: Some repositories may have issues, but continuing..."
    }
fi

# Install packages and configure Git
install_packages_and_configure_git

echo "Configuring system parameters..."
$USE_SUDO sysctl fs.inotify.max_user_watches=524288
$USE_SUDO sysctl -p

echo "Setup completed successfully!"
