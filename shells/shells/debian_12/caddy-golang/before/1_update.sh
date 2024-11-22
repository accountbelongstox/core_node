#!/bin/bash

# Function to install essential packages and configure Git
install_packages_and_configure_git() {
    echo "Installing essential packages..."
    sudo apt install -y lsof cron curl vim git build-essential rsync htop \
    nano wget openssl libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
    xz-utils tk-dev libffi-dev liblzma-dev make software-properties-common \
    cron dnsutils libvips-dev cpulimit
    sudo git config --global http.sslVerify "false"
    echo "Essential packages installed."
}

sudo apt update
install_packages_and_configure_git
echo "Setup completed."
