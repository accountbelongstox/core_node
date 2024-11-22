#!/bin/bash

# Function to check and install python3
check_install_python3() {
    if ! command -v python3 &> /dev/null; then
        echo "python3 is not installed. Installing..."
        sudo apt install -y python3
    else
        echo "python3 is already installed."
    fi
}

# Function to check and install pip3
check_install_pip3() {
    if ! command -v pip3 &> /dev/null; then
        echo "pip3 is not installed. Installing..."
        sudo apt install -y python3-pip
    else
        echo "pip3 is already installed."
    fi
}

# Function to install other necessary packages
install_other_packages() {
    echo "Installing necessary packages..."
    sudo apt install -y build-essential libssl-dev libffi-dev python3-dev
}

# Function to print the version of python3 and pip3
print_versions() {
    echo "Python3 version:"
    python3 --version

    echo "pip3 version:"
    pip3 --version
}

# Main script execution
check_install_python3
check_install_pip3
install_other_packages
print_versions
