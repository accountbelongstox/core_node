#!/bin/bash

# Setup Octane Reload Sudoers Configuration
# Allows current user to restart Octane without password

set -e

CURRENT_USER=$(whoami)
SERVICE_NAME="ncore-laravel_main"
SUDOERS_FILE="/etc/sudoers.d/octane-reload"

echo "=== Octane Reload Sudoers Setup ==="
echo "User: $CURRENT_USER"
echo "Service: $SERVICE_NAME"
echo ""

# Check if already configured
if [ -f "$SUDOERS_FILE" ]; then
    echo "âš?Sudoers file already exists: $SUDOERS_FILE"
    read -p "Overwrite? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted"
        exit 0
    fi
fi

# Create sudoers configuration
echo "Creating sudoers configuration..."
cat << EOF | sudo tee $SUDOERS_FILE
# Allow $CURRENT_USER to manage Octane service without password
# Created: $(date)

$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart $SERVICE_NAME
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl reload $SERVICE_NAME
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl stop $SERVICE_NAME
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl start $SERVICE_NAME
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl status $SERVICE_NAME
EOF

# Set correct permissions
sudo chmod 0440 $SUDOERS_FILE

echo ""
echo "âœ?Sudoers configuration created: $SUDOERS_FILE"
echo ""

# Test the configuration
echo "Testing configuration..."
if sudo -n systemctl status $SERVICE_NAME > /dev/null 2>&1; then
    echo "âœ?Test passed! No password required"
else
    echo "âœ?Test failed! Configuration may have issues"
    exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "You can now restart Octane without password:"
echo "  sudo systemctl restart $SERVICE_NAME"
echo ""
echo "Or use the restart script:"
echo "  ./restart_octane.sh"
echo ""
