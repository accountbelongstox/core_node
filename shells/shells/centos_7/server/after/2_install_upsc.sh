#!/bin/bash

# Check if nut-client is installed
if ! rpm -q nut; then
    sudo yum install -y nut
fi

# Check if nut-server is installed
if ! rpm -q nut; then
    sudo yum install -y nut
fi

UPS_CONF="/etc/nut/ups.conf"
UPSD_CONF="/etc/nut/upsd.conf"
UPSD_USERS_CONF="/etc/nut/upsd.users"
UPSMON_CONF="/etc/nut/upsmon.conf"

# Remove old configurations
sudo rm -f "$UPS_CONF" "$UPSD_CONF" "$UPSD_USERS_CONF" "$UPSMON_CONF"

# Create new UPS configuration
sudo bash -c "cat > $UPS_CONF <<EOL
[server_ups]
    desc = \"USB to Serial\"
    driver = nutdrv_qx
    port = auto
EOL"

# Create new UPS daemon configuration
sudo bash -c "cat > $UPSD_CONF <<EOL
LISTEN 127.0.0.1 3493
EOL"

# Create new UPS daemon users configuration
sudo bash -c "cat > $UPSD_USERS_CONF <<EOL
[admin]
    password = 12345678
    actions = set
    actions = fsd
    instcmds = all

[monitor]
    password = 12345678
    upsmon master
EOL"

# Create new UPS monitor configuration
sudo bash -c "cat > $UPSMON_CONF <<EOL
MONITOR server_ups@localhost 1 monitor 12345678 master
SHUTDOWNCMD \"echo 'Home has no current. Proceeding to shut down...'\"
MINSUPPLIES 1
POLLFREQ 5
POLLFREQALERT 5
HOSTSYNC 15
DEADTIME 15
POWERDOWNFLAG /etc/killpower
RBWARNTIME 10
NOCOMMWARNTIME 300
FINALDELAY 5
EOL"

# Enable and start services
sudo systemctl enable nut-monitor.service
sudo systemctl enable nut-server.service
sudo systemctl restart nut-server.service
sudo systemctl restart nut-monitor.service
