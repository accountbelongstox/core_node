#!/bin/bash

# Path to store the downloaded remove.sh script
REMOVE_SCRIPT_PATH="/tmp/remove.sh"

# Function to download the remove.sh script if not already downloaded
download_remove_script() {
    if [ ! -f "$REMOVE_SCRIPT_PATH" ]; then
        echo "Downloading remove.sh script..."
        wget -qO- https://cdn.jsdelivr.net/gh/lufei/TencentAgentRemove@master/remove.sh -O "$REMOVE_SCRIPT_PATH"
        if [ $? -eq 0 ]; then
            echo "Download successful."
        else
            echo "Error: Failed to download the script."
            exit 1
        fi
    else
        echo "remove.sh script already downloaded, skipping download."
    fi
}

# Function to run the remove.sh script
run_remove_script() {
    echo "Running remove.sh script..."
    bash "$REMOVE_SCRIPT_PATH"
}

# Function to uninstall BaradAgent
uninstall_baradagent() {
    echo "Uninstalling BaradAgent..."
    if [ -d "/usr/local/qcloud/monitor/barad/admin" ]; then
        cd /usr/local/qcloud/monitor/barad/admin || exit
        ./uninstall.sh
        echo "BaradAgent uninstalled successfully."
    else
        echo "BaradAgent is not installed."
    fi
}

# Function to uninstall Sgagent
uninstall_sgagent() {
    echo "Uninstalling Sgagent..."
    if [ -d "/usr/local/qcloud/stargate/admin" ]; then
        cd /usr/local/qcloud/stargate/admin || exit
        ./uninstall.sh
        echo "Sgagent uninstalled successfully."
    else
        echo "Sgagent is not installed."
    fi
}

# Function to uninstall YunJing Agent
uninstall_yunjing() {
    echo "Uninstalling YunJing..."
    if [ -f "/usr/local/qcloud/YunJing/uninst.sh" ]; then
        cd /usr/local/qcloud/YunJing || exit
        ./uninst.sh
        echo "YunJing uninstalled successfully."
    else
        echo "YunJing is not installed."
    fi
}

# Function to stop BaradAgent
stop_baradagent() {
    echo "Stopping BaradAgent..."
    if [ -d "/usr/local/qcloud/monitor/barad/admin" ]; then
        cd /usr/local/qcloud/monitor/barad/admin || exit
        ./stop.sh
        echo "BaradAgent stopped successfully."
    else
        echo "BaradAgent is not installed."
    fi
}

# Function to stop Sgagent
stop_sgagent() {
    echo "Stopping Sgagent..."
    if [ -d "/usr/local/qcloud/stargate/admin" ]; then
        cd /usr/local/qcloud/stargate/admin || exit
        ./stop.sh
        echo "Sgagent stopped successfully."
    else
        echo "Sgagent is not installed."
    fi
}

# Function to stop YunJing
stop_yunjing() {
    echo "Stopping YunJing..."
    if [ -f "/usr/local/qcloud/YunJing/uninst.sh" ]; then
        cd /usr/local/qcloud/YunJing || exit
        ./stop.sh
        echo "YunJing stopped successfully."
    else
        echo "YunJing is not installed."
    fi
}

# Function to remove cron tasks related to Sgagent
remove_sgagent_cron() {
    echo "Removing Sgagent cron tasks..."
    rm -f /etc/cron.d/sgagenttask
    crontab -l | grep -v "stargate" | crontab -
    echo "Sgagent cron tasks removed."
}

# Function to check if agent processes are still running
check_agent_processes() {
    echo "Checking for any remaining agent processes..."
    ps -A | grep -i agent
    if [ $? -eq 0 ]; then
        echo "Warning: Some agent processes are still running."
    else
        echo "No agent processes are running."
    fi
}

# Main logic to uninstall, stop, and remove all components
echo "Starting the uninstallation and stopping of monitoring components..."

# Stop and remove Sgagent first
stop_sgagent
remove_sgagent_cron
uninstall_sgagent

# Stop and remove BaradAgent
stop_baradagent
uninstall_baradagent

# Stop and remove YunJing
stop_yunjing
uninstall_yunjing

# Download and run the TencentAgentRemove script to assist with further uninstallation
download_remove_script
run_remove_script

# Check if any agent processes are still running
check_agent_processes

echo "All monitoring components (Sgagent, BaradAgent, YunJing) have been uninstalled and stopped."
