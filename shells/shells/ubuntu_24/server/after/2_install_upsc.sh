#!/bin/bash
if ! dpkg -l | grep -q nut-client; then
#    sudo apt-get update
    sudo apt-get install -y nut-client
fi

if ! dpkg -l | grep -q nut-server; then
#    sudo apt-get update
    sudo apt-get install -y nut-server
fi

UPS_CONF="/etc/nut/ups.conf"
UPSD_CONF="/etc/nut/upsd.conf"
UPSD_USERS_CONF="/etc/nut/upsd.users"
UPSMON_CONF="/etc/nut/upsmon.conf"

sudo rm -f $UPS_CONF $UPSD_CONF $UPSD_USERS_CONF $UPSMON_CONF

sudo bash -c "cat > $UPS_CONF <<EOL
[server_ups]
    desc = \"USB to Serial\"
    driver = nutdrv_qx
    port = auto
EOL"

sudo bash -c "cat > $UPSD_CONF <<EOL
LISTEN 127.0.0.1 3493
EOL"

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

sudo systemctl enable nut-monitor.service

sudo systemctl enable nut-server.service
sudo systemctl restart nut-server.service
sudo systemctl restart nut-monitor.service
