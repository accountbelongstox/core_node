#!/bin/bash
if ! which sshd &> /dev/null; then
    echo "Installing OpenSSH..."
    sudo apt install -y openssh-server
    sudo systemctl enable ssh
    echo "Starting ssh service..."
    sudo systemctl start ssh
else
    if sudo systemctl is-active --quiet ssh; then
        echo "ssh service is already running."
    else
        echo "Starting ssh service..."
        sudo systemctl start ssh
    fi
fi


SCRIPT_ROOT_DIR=$(cat "/usr/script_global_var/SCRIPT_ROOT_DIR")
COMMON_SCRIPTS_DIR=$(cat "/usr/script_global_var/COMMON_SCRIPTS_DIR")
CHECK_SSH_SCRIPT="$COMMON_SCRIPTS_DIR/check_ssh_config.js"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if the script exists
if [ ! -f "$CHECK_SSH_SCRIPT" ]; then
    echo "Error: SSH config check script not found at $CHECK_SSH_SCRIPT"
    exit 1
fi

# Run the SSH config check script
echo "Running SSH configuration check..."
sudo node "$CHECK_SSH_SCRIPT"

# Check if SSH service needs restart
if [ $? -eq 0 ]; then
    echo "Checking if SSH service needs restart..."
    if systemctl is-active --quiet ssh; then
        echo "Restarting SSH service to apply changes..."
        sudo systemctl restart ssh
        echo "SSH service restarted successfully."
    else
        echo "Starting SSH service..."
        sudo systemctl start ssh
        echo "SSH service started successfully."
    fi
else
    echo "Error occurred while checking SSH configuration."
    exit 1
fi

echo "SSH configuration check completed."

