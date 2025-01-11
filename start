#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to detect OS type and version
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    elif [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        OS=$DISTRIB_ID
        VER=$DISTRIB_RELEASE
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    echo "Detected OS: $OS $VER"
}

# Function to install nohup based on OS
install_nohup() {
    echo "Installing nohup..."
    
    # Must run as root
    if [ "$(id -u)" != "0" ]; then
        echo "This installation needs root privileges. Please run with sudo."
        exit 1
    fi

    case $OS in
        *Ubuntu*|*Debian*)
            apt-get update
            apt-get install -y coreutils
            ;;
        *CentOS*|*Red*Hat*|*Fedora*|*RHEL*)
            yum -y update
            yum -y install coreutils
            ;;
        *SUSE*)
            zypper refresh
            zypper install -y coreutils
            ;;
        *Alpine*)
            apk update
            apk add coreutils
            ;;
        *)
            echo "Unsupported operating system: $OS"
            exit 1
            ;;
    esac

    if [ $? -eq 0 ]; then
        echo "nohup installed successfully"
    else
        echo "Failed to install nohup"
        exit 1
    fi
}

# Function to check if nohup exists and install if missing
check_nohup() {
    if ! command -v nohup &> /dev/null; then
        echo "nohup command not found. Attempting to install..."
        detect_os
        install_nohup
    fi
}

# Function to create logs directory if it doesn't exist
ensure_logs_dir() {
    local log_dir="$SCRIPT_DIR/logs"
    if [ ! -d "$log_dir" ]; then
        mkdir -p "$log_dir"
    fi
    echo "$log_dir"
}

# Function to get current timestamp
get_timestamp() {
    date "+%Y%m%d_%H%M%S"
}

# Function to check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is not installed"
        exit 1
    fi
}

# Main execution
check_nodejs
check_nohup
LOG_DIR=$(ensure_logs_dir)
TIMESTAMP=$(get_timestamp)
LOG_FILE="$LOG_DIR/app_${TIMESTAMP}.log"

# Start the Node.js application with all passed arguments
echo "Starting application in background mode..."
echo "Command: node $SCRIPT_DIR/main.js $@"
echo "Log file: $LOG_FILE"

# Use nohup to run the application in the background
nohup node "$SCRIPT_DIR/main.js" "$@" >> "$LOG_FILE" 2>&1 &

# Get the process ID
PID=$!
echo $PID > "$LOG_DIR/app.pid"

echo "Application started with PID: $PID"
echo "You can check the logs at: $LOG_FILE"
echo "To stop the application, run: kill $PID" 