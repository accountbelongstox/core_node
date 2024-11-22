#!/bin/bash

# Check if we are running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root!"
    exit 1
fi

# Function to stop Hostguard service
stop_hostguard() {
    echo "Stopping Hostguard service..."
    /etc/init.d/hostguard stop
    if [ $? -eq 0 ]; then
        echo "Hostguard service stopped successfully."
    else
        echo "Failed to stop Hostguard service."
    fi
}

# Function to uninstall Hostguard Agent
uninstall_hostguard() {
    echo "Uninstalling Hostguard Agent..."

    # Check if Hostguard is installed via dpkg (Debian/Ubuntu-based)
    dpkg -l | grep -q hostguard
    if [ $? -eq 0 ]; then
        echo "Hostguard is installed. Proceeding with uninstallation..."
        
        dpkg -P hostguard
        if [ $? -eq 0 ]; then
            echo "Hostguard uninstalled successfully."
        else
            echo "Failed to uninstall Hostguard using dpkg. Trying cleanup..."
            cleanup_hostguard
        fi
    else
        echo "Hostguard is not installed."
    fi
}

# Function to clean up any residual Hostguard files and processes
cleanup_hostguard() {
    # Check for and kill any remaining hostguard processes
    echo "Checking for any remaining hostguard processes..."
    ps -ef | grep -v grep | grep -q hostguard
    if [ $? -eq 0 ]; then
        echo "Found residual Hostguard processes. Killing them..."
        ps -ef | grep hostguard | awk '{print $2}' | xargs kill -9
    else
        echo "No residual Hostguard processes found."
    fi

    # Remove the /usr/local/hostguard directory if it exists
    echo "Checking if /usr/local/hostguard exists..."
    if [ -d "/usr/local/hostguard" ]; then
        echo "Found /usr/local/hostguard directory. Removing it..."
        rm -rf /usr/local/hostguard
    else
        echo "/usr/local/hostguard directory not found."
    fi

    # Remove the /etc/init.d/hostguard file if it exists
    echo "Checking if /etc/init.d/hostguard exists..."
    if [ -f "/etc/init.d/hostguard" ]; then
        echo "Found /etc/init.d/hostguard file. Removing it..."
        rm -f /etc/init.d/hostguard
    else
        echo "/etc/init.d/hostguard file not found."
    fi
}

# Main logic
echo "Starting Hostguard uninstallation process..."

# Stop the Hostguard service
stop_hostguard

# Uninstall Hostguard Agent
uninstall_hostguard

# Final cleanup
cleanup_hostguard

echo "Hostguard Agent uninstallation and cleanup completed."
