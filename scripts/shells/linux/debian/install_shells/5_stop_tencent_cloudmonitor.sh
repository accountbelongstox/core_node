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

# Use global temporary directory structure
SCRIPT_TEMP_DIR=$(create_script_temp_dir "5_stop_tencent_cloudmonitor")
REMOVE_SCRIPT_PATH="$SCRIPT_TEMP_DIR/remove.sh"

# Function to download the remove.sh script if not already downloaded
download_remove_script() {
    if [ ! -f "$REMOVE_SCRIPT_PATH" ]; then
        echo "Downloading remove.sh script..."
        if command -v wget >/dev/null 2>&1; then
            wget -qO- https://cdn.jsdelivr.net/gh/lufei/TencentAgentRemove@master/remove.sh -O "$REMOVE_SCRIPT_PATH"
        elif command -v curl >/dev/null 2>&1; then
            curl -sL https://cdn.jsdelivr.net/gh/lufei/TencentAgentRemove@master/remove.sh -o "$REMOVE_SCRIPT_PATH"
        else
            echo "Error: Neither wget nor curl is available for downloading."
            return 1
        fi
        
        if [ $? -eq 0 ] && [ -f "$REMOVE_SCRIPT_PATH" ]; then
            echo "Download successful."
            chmod +x "$REMOVE_SCRIPT_PATH"
        else
            echo "Error: Failed to download the script."
            return 1
        fi
    else
        echo "remove.sh script already downloaded, skipping download."
    fi
}

# Function to run the remove.sh script with error handling
run_remove_script() {
    if [ -f "$REMOVE_SCRIPT_PATH" ]; then
        echo "Running remove.sh script..."
        bash "$REMOVE_SCRIPT_PATH" 2>/dev/null || echo "External remove script completed with some errors (expected if components not installed)"
    else
        echo "Warning: remove.sh script not found, skipping external removal."
    fi
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

# Function to stop TAT Agent (Tencent Automation Tools Agent)
stop_tat_agent() {
    echo "Stopping TAT Agent (Tencent Automation Tools Agent)..."

    # Method 1: Check if TAT Agent is managed by systemd
    if systemctl list-unit-files 2>/dev/null | grep -q "tat_agent.service"; then
        echo "TAT Agent service found in systemd, stopping and disabling..."

        # Check current status
        if systemctl is-active --quiet tat_agent 2>/dev/null; then
            echo "TAT Agent is currently running, stopping..."
            $USE_SUDO systemctl stop tat_agent 2>/dev/null || echo "Failed to stop tat_agent service"
            echo "TAT Agent service stopped"
        else
            echo "TAT Agent service is not running"
        fi

        # Disable auto-start
        if systemctl is-enabled --quiet tat_agent 2>/dev/null; then
            echo "Disabling TAT Agent auto-start..."
            $USE_SUDO systemctl disable tat_agent 2>/dev/null || echo "Failed to disable tat_agent service"
            echo "TAT Agent auto-start disabled"
        else
            echo "TAT Agent auto-start already disabled"
        fi

        # Remove systemd service file
        if [ -f "/etc/systemd/system/tat_agent.service" ]; then
            echo "Removing TAT Agent systemd service file..."
            $USE_SUDO rm -f /etc/systemd/system/tat_agent.service
            $USE_SUDO systemctl daemon-reload
            echo "TAT Agent systemd service file removed"
        fi
    else
        echo "TAT Agent systemd service not found"
    fi

    # Method 2: Kill TAT Agent processes directly
    echo "Checking for running TAT Agent processes..."
    if pgrep -f "tat_agent" >/dev/null 2>&1; then
        echo "Found running TAT Agent processes, terminating..."
        $USE_SUDO pkill -f tat_agent 2>/dev/null || echo "Failed to kill some tat_agent processes"
        sleep 2

        # Force kill if still running
        if pgrep -f "tat_agent" >/dev/null 2>&1; then
            echo "Force killing remaining TAT Agent processes..."
            $USE_SUDO pkill -9 -f tat_agent 2>/dev/null || true
        fi

        echo "TAT Agent processes terminated"
    else
        echo "No TAT Agent processes found running"
    fi

    # Verify TAT Agent is stopped
    echo "Verifying TAT Agent is stopped..."
    if ps aux | grep -v grep | grep -q "tat_agent"; then
        echo "Warning: Some TAT Agent processes may still be running:"
        ps aux | grep -v grep | grep "tat_agent"
    else
        echo "TAT Agent successfully stopped"
    fi

    # Remove TAT Agent directories if they exist
    if [ -d "/usr/local/qcloud/tat_agent" ]; then
        echo "Found TAT Agent installation directory: /usr/local/qcloud/tat_agent"
        echo "Note: Directory preserved. To remove completely, run: sudo rm -rf /usr/local/qcloud/tat_agent"
    fi
}

# Function to check if agent processes are still running
check_agent_processes() {
    echo "Checking for any remaining Tencent agent processes..."
    TENCENT_AGENTS=$(ps -A | grep -E "(sgagent|baradagent|yunjing|tat_agent)" | grep -v grep)
    if [ -n "$TENCENT_AGENTS" ]; then
        echo "Warning: Some Tencent agent processes are still running:"
        echo "$TENCENT_AGENTS"
    else
        echo "No Tencent agent processes are running."
    fi
}

# Main logic to uninstall, stop, and remove all components
echo "Starting the uninstallation and stopping of monitoring components..."
echo ""

# Stop and remove TAT Agent (Tencent Automation Tools Agent)
echo "=== TAT Agent ==="
stop_tat_agent
echo ""

# Stop and remove Sgagent first
echo "=== Sgagent ==="
stop_sgagent
remove_sgagent_cron
uninstall_sgagent
echo ""

# Stop and remove BaradAgent
echo "=== BaradAgent ==="
stop_baradagent
uninstall_baradagent
echo ""

# Stop and remove YunJing
echo "=== YunJing ==="
stop_yunjing
uninstall_yunjing
echo ""

# Download and run the TencentAgentRemove script to assist with further uninstallation
echo "=== External Removal Script ==="
echo "Attempting to download and run external removal script..."
if download_remove_script; then
    run_remove_script
else
    echo "External script download failed, continuing with manual cleanup..."
fi
echo ""

# Check if any agent processes are still running
echo "=== Final Verification ==="
check_agent_processes
echo ""

echo "=========================================="
echo "All monitoring components have been processed:"
echo "  - TAT Agent (Tencent Automation Tools)"
echo "  - Sgagent"
echo "  - BaradAgent"
echo "  - YunJing"
echo "=========================================="
