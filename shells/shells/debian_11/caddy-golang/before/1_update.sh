#!/bin/bash

# Define mirror and Debian version
DEBIAN_MIRROR="https://mirrors.tuna.tsinghua.edu.cn/debian/"
DEBIAN_VERSION="bullseye"

# Function to check if Tsinghua mirror is already configured
check_thu_mirror() {
    sudo grep -q "^deb $DEBIAN_MIRROR $DEBIAN_VERSION" /etc/apt/sources.list
}

# Function to back up the current sources.list
backup_sources() {
    sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak
}

# Function to configure Tsinghua University mirror
config_thu_mirror() {
    echo "Configuring Tsinghua University mirror for Debian 11 (Bullseye)..."
    sudo tee /etc/apt/sources.list >/dev/null <<EOF
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bullseye main contrib non-free
# deb-src https://mirrors.tuna.tsinghua.edu.cn/debian/ bullseye main contrib non-free
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bullseye-updates main contrib non-free
# deb-src https://mirrors.tuna.tsinghua.edu.cn/debian/ bullseye-updates main contrib non-free
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bullseye-backports main contrib non-free
# deb-src https://mirrors.tuna.tsinghua.edu.cn/debian/ bullseye-backports main contrib non-free
deb https://mirrors.tuna.tsinghua.edu.cn/debian-security bullseye-security main contrib non-free
# deb-src https://mirrors.tuna.tsinghua.edu.cn/debian-security bullseye-security main contrib non-free
EOF
    sudo apt update
    echo "Tsinghua University mirror configured for Debian 11 (Bullseye)."
}

# Function to install essential packages and configure Git
install_packages_and_configure_git() {
    echo "Installing essential packages..."
    sudo apt install -y lsof cron curl vim git build-essential rsync htop \
    nano wget openssl libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
    xz-utils tk-dev libffi-dev liblzma-dev make software-properties-common \
    cron dnsutils libvips-dev

    # Disable SSL verification for Git
    sudo git config --global http.sslVerify "false"

    echo "Essential packages installed."
}

# Main logic
if check_thu_mirror; then
    echo "Tsinghua University mirror is already configured. Skipping."
else
    backup_sources
    config_thu_mirror
fi

# Update package lists
sudo apt update

# Install packages and configure Git
install_packages_and_configure_git

echo "Setup completed."
