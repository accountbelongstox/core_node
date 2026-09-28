#!/bin/bash
SCRIPT_INDEX="12"

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
PARENT_DIR_LEVEL_3="$(dirname "$PARENT_DIR_LEVEL_2")"
PARENT_DIR_LEVEL_4="$(dirname "$PARENT_DIR_LEVEL_3")"
PARENT_DIR_LEVEL_5="$(dirname "$PARENT_DIR_LEVEL_4")"

# Source global variables
source "$PARENT_DIR_LEVEL_5/linux/LGar.sh"
source "$PARENT_DIR_LEVEL_5/linux/common/gvar_common.sh"

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This script must be run as root!"
    echo "Please run: sudo bash $0"
    exit 1
fi

# Function to install essential packages and configure Git
install_packages_and_configure_git() {
    echo "Installing essential packages..."
    apt install -y lsof cron curl vim git build-essential rsync htop \
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

echo "Updating package lists..."
apt update

install_packages_and_configure_git

echo "Configuring system parameters..."
sysctl fs.inotify.max_user_watches=524288
sysctl -p

echo "Setup completed."