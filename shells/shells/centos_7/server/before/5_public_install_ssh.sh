#!/bin/bash

# Check if OpenSSH server is installed
if ! which sshd &> /dev/null; then
    echo "Installing OpenSSH..."
    sudo yum install -y openssh-server
    sudo systemctl enable sshd
    echo "Starting ssh service..."
    sudo systemctl start sshd
else
    echo "sshd_config file exists. Please review the existing configuration for CentOS 7."
    if sudo systemctl is-active --quiet sshd; then
        echo "ssh service is already running."
    else
        echo "Starting ssh service..."
        sudo systemctl start sshd
    fi
fi
