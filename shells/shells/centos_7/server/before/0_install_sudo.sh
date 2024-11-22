#!/bin/bash
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

OS=$(awk -F= '/^ID=/ { print $2 }' /etc/os-release | tr -d '"')
echo "Updating and installing packages for $OS..."

# Check if sudo is installed
if ! which sudo > /dev/null 2>&1; then
    echo "Installing sudo..."
    yum install -y epel-release  # Enable EPEL repository if needed
    yum install -y sudo
fi

# Check if the user is in the wheel group (CentOS uses wheel for sudo)
if id -nG "$USER" | grep -qw "wheel"; then
    echo "User is already in the wheel group."
else
    echo "Adding user to wheel group..."
    sudo usermod -aG wheel "$USER"
    echo "User added to wheel group. Please re-login for changes to take effect."
fi
