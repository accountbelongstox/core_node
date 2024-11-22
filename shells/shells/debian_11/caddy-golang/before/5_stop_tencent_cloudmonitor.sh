#!/bin/bash

# Function to check if a directory exists
check_directory() {
    if [ -d "$1" ]; then
        return 0
    else
        return 1
    fi
}

echo "Starting Tencent Cloud monitor components removal process..."

# Part 1: Handle BaradAgent
BARAD_DIR="/usr/local/qcloud/monitor/barad"
if check_directory "$BARAD_DIR"; then
    echo "Found BaradAgent installation, proceeding with uninstallation..."
    if [ -d "${BARAD_DIR}/admin" ]; then
        cd "${BARAD_DIR}/admin" || exit
        if [ -f "./uninstall.sh" ]; then
            echo "Executing BaradAgent uninstall script..."
            ./uninstall.sh
            echo "BaradAgent uninstallation completed."
        else
            echo "Warning: BaradAgent uninstall script not found."
        fi
    else
        echo "Warning: BaradAgent admin directory not found."
    fi
else
    echo "BaradAgent installation not found, skipping..."
fi

# Part 2: Handle Sgagent
STARGATE_DIR="/usr/local/qcloud/stargate"
if check_directory "$STARGATE_DIR"; then
    echo "Found Sgagent installation, proceeding with uninstallation..."
    
    # Remove Sgagent cron task if exists
    if [ -f "/etc/cron.d/sgagenttask" ]; then
        echo "Removing Sgagent cron task file..."
        rm -f /etc/cron.d/sgagenttask
    else
        echo "Sgagent cron task file not found, skipping..."
    fi
    
    # Remove Sgagent from crontab
    echo "Checking for Sgagent entries in crontab..."
    if crontab -l | grep -q stargate; then
        echo "Removing Sgagent from crontab..."
        crontab -l | grep -v stargate | crontab -
        echo "Sgagent removed from crontab."
    else
        echo "No Sgagent entries found in crontab."
    fi

    # Stop and uninstall Sgagent
    if [ -d "${STARGATE_DIR}/admin" ]; then
        cd "${STARGATE_DIR}/admin" || exit
        if [ -f "./stop.sh" ]; then
            echo "Stopping Sgagent service..."
            ./stop.sh
        fi
        if [ -f "./uninstall.sh" ]; then
            echo "Executing Sgagent uninstall script..."
            ./uninstall.sh
            echo "Sgagent uninstallation completed."
        else
            echo "Warning: Sgagent uninstall script not found."
        fi
    else
        echo "Warning: Sgagent admin directory not found."
    fi
else
    echo "Sgagent installation not found, skipping..."
fi

# Verify removal
echo "Verifying removal..."
if ! check_directory "$BARAD_DIR"; then
    echo "BaradAgent successfully removed."
else
    echo "Warning: BaradAgent directory still exists."
fi

if ! check_directory "$STARGATE_DIR"; then
    echo "Sgagent successfully removed."
else
    echo "Warning: Sgagent directory still exists."
fi

echo "Tencent Cloud monitor components removal process completed."
