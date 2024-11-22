#!/bin/bash
if ! which sshd &> /dev/null; then
    echo "Installing OpenSSH..."
    sudo apt install -y openssh-server
    sudo systemctl enable ssh
    echo "Starting ssh service..."
    sudo systemctl start ssh
else
    echo "sshd_config file exists. Please review the existing configuration for Ubuntu 22."
    if sudo systemctl is-active --quiet ssh; then
        echo "ssh service is already running."
    else
        echo "Starting ssh service..."
        sudo systemctl start ssh
    fi
fi

