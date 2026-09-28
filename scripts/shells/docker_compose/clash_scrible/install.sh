#!/bin/bash

# Function to print error messages in red
print_error() {
    echo -e "\033[31m$1\033[0m"  # Red color text
}

# Function to reinstall Node.js using opkg
reinstall_node() {
    echo "Reinstalling Node.js..."

    # Remove old binaries
    rm -f "/usr/bin/node"
    rm -f "/usr/bin/npm"
    rm -f "/usr/bin/npx"
    
    # Update opkg and reinstall Node.js
    opkg update
    opkg install gcc g++ libc libatomic
    opkg install node

    # Check if installation was successful
    if command -v node &> /dev/null; then
        echo "Node.js reinstalled successfully."
        node -v
    else
        print_error "Node.js installation failed. Exiting."
        exit 1
    fi
}

# Check if Node.js is installed and functioning properly
if command -v node &> /dev/null; then
    echo "Node.js is installed. Verifying functionality..."
    
    # Try running `node -v` to check if Node.js is functional
    if ! node -v &> /dev/null; then
        print_error "Node.js is installed but not functioning. Attempting to reinstall..."
        reinstall_node
    else
        echo "Node.js is functioning correctly."
    fi
else
    echo "Node.js is not installed. Proceeding with installation..."
    reinstall_node
fi

# Run node main.js and handle failure
if [ -f "main.js" ]; then
    echo "Executing node main.js..."
    
    if ! node main.js; then
        print_error "Execution of node main.js failed. Reinstalling Node.js..."
        reinstall_node
        echo "Retrying to execute node main.js..."
        node main.js
    fi
else
    print_error "main.js file not found. Please make sure it exists in the current directory."
    exit 1
fi
