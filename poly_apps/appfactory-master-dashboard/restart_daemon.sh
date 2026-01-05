#!/bin/bash
# Restart daemon service
sudo systemctl restart webapp-appfactory-master-dashboard-daemon.service
echo "Daemon restarted. Checking status..."
sleep 2
sudo systemctl status webapp-appfactory-master-dashboard-daemon.service --no-pager | head -15
echo ""
echo "Checking for SCAN logs..."
journalctl -u webapp-appfactory-master-dashboard-daemon.service --since "10 seconds ago" --no-pager | grep -E "SCAN|Initial"
