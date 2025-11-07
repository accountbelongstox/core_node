#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

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

# Source global variables
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Check if we are running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root!"
    exit 1
fi

# Function to stop Hostguard service
stop_hostguard() {
    echo "Stopping Hostguard service..."

    # Check if init script exists
    if [ -f "/etc/init.d/hostguard" ]; then
        /etc/init.d/hostguard stop
        if [ $? -eq 0 ]; then
            echo "Hostguard service stopped successfully."
        else
            echo "Failed to stop Hostguard service."
        fi
    else
        echo "Hostguard init script not found at /etc/init.d/hostguard"

        # Try systemctl if available
        if command -v systemctl >/dev/null 2>&1; then
            if systemctl list-units --full -all | grep -q "hostguard"; then
                echo "Trying to stop Hostguard via systemctl..."
                systemctl stop hostguard 2>/dev/null
                if [ $? -eq 0 ]; then
                    echo "Hostguard service stopped successfully via systemctl."
                else
                    echo "Hostguard service not running or already stopped."
                fi
            else
                echo "Hostguard service not found in systemctl."
            fi
        else
            echo "Hostguard service not found or not running."
        fi
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
