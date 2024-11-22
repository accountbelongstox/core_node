#!/bin/bash

# Check if the script is run as root
if [ "$(id -u)" -ne 0 ]; then
    echo "Please run this script as root or using sudo."
    exit 1
fi

# Update the package list
echo "Updating package list..."
apt update

# Check if openssh-server is installed
if ! dpkg -l | grep -q openssh-server; then
    echo "openssh-server is not installed. Installing..."
    apt install -y openssh-server
else
    echo "openssh-server is already installed."
fi

# Start the SSH service
echo "Starting SSH service..."
/usr/sbin/sshd

# Configure the SSH service
echo "Configuring SSH service..."
SSHD_CONFIG="/etc/ssh/sshd_config"

# Disable password authentication
if grep -q "^PasswordAuthentication yes" "$SSHD_CONFIG"; then
    sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' "$SSHD_CONFIG"
fi

# Disable root login
if grep -q "^PermitRootLogin yes" "$SSHD_CONFIG"; then
    sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' "$SSHD_CONFIG"
fi

# Generate SSH key pair (if not already exists)
KEY_PATH="/etc/ssh/id_rsa"  # Store private key in /etc/ssh
PUBLIC_KEY_PATH="$KEY_PATH.pub"  # Public key path

if [ ! -f "$KEY_PATH" ]; then
    echo "SSH key not found. Generating..."
    ssh-keygen -t rsa -b 4096 -C "local@gmail.com" -N "" -f "$KEY_PATH"
else
    echo "SSH key already exists."
fi

# Set up authorized_keys for key-based authentication
AUTHORIZED_KEYS="/root/.ssh/authorized_keys"

# Create .ssh directory if it doesn't exist
if [ ! -d "$(dirname "$AUTHORIZED_KEYS")" ]; then
    mkdir -p "$(dirname "$AUTHORIZED_KEYS")"
    chmod 700 "$(dirname "$AUTHORIZED_KEYS")"
fi

# Copy the public key to authorized_keys for SSH authentication
cat "$PUBLIC_KEY_PATH" >> "$AUTHORIZED_KEYS"
chmod 600 "$AUTHORIZED_KEYS"

# Display the public key
echo "Here is the generated public key. Please add it to the necessary servers:"
cat "$PUBLIC_KEY_PATH"

echo "Setup completed. The SSH server is running, and key-based authentication is configured."

