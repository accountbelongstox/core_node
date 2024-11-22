#!/bin/bash

# Set up the base URL for EPEL and other repositories
EPEL_REPO="https://dl.fedoraproject.org/pub/epel/7/x86_64/Packages/e/epel-release-7-14.noarch.rpm"

# Function to check if EPEL is enabled
check_epel() {
    yum repolist | grep -q "epel"
}

# Function to enable EPEL repository
enable_epel() {
    echo "Enabling EPEL repository..."
    sudo yum install -y "$EPEL_REPO"
}

# Function to install packages
install_packages_and_configure_git() {
    echo "Installing essential packages..."
    sudo yum install -y lsof cronie curl vim git make gcc gcc-c++ \
    rsync htop nano wget openssl-devel bzip2-devel \
    readline-devel sqlite-devel llvm ncurses-devel \
    xz-devel tk-devel libffi-devel liblzma-devel dnsutils

    # Set git configuration
    sudo git config --global http.sslVerify "false"

    echo "Essential packages installed."
}

# Check if EPEL is enabled, if not, enable it
if ! check_epel; then
    enable_epel
fi

# Update the system
echo "Updating system..."
sudo yum update -y

# Install the essential packages and configure Git
install_packages_and_configure_git

echo "Setup completed."
