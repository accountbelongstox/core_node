#!/bin/bash
# Restart the appfactory-master-dashboard daemon service

echo "Restarting daemon service..."
sudo systemctl restart webapp-appfactory-master-dashboard-daemon.service

if [ $? -eq 0 ]; then
    echo "✓ Daemon restarted successfully"
    sleep 2
    echo ""
    echo "Checking daemon status..."
    sudo systemctl status webapp-appfactory-master-dashboard-daemon.service --no-pager | head -15
else
    echo "✗ Failed to restart daemon"
    exit 1
fi
