#!/bin/bash
# Check if aliyun.service is running
if systemctl is-active --quiet aliyun.service; then
    echo "aliyun.service is running. Proceeding with uninstallation."

    # Download and execute the uninstallation scripts
    sudo wget "http://update2.aegis.aliyun.com/download/uninstall.sh" && chmod +x uninstall.sh &&./uninstall.sh
    sudo wget http://update.aegis.aliyun.com/download/quartz_uninstall.sh && chmod +x quartz_uninstall.sh &&./quartz_uninstall.sh
    sudo wget http://update.aegis.aliyun.com/download/uninstall.sh && chmod +x uninstall.sh &&./uninstall.sh

    # Additional cleanup commands
    echo "Uninstalling Aliyun service..."
    sudo pkill aliyun-service
    sudo rm -fr /etc/init.d/agentwatch /usr/sbin/aliyun-service
    sudo rm -rf /usr/local/aegis*
    sudo systemctl stop aliyun.service
    sudo systemctl disable aliyun.service
    sudo rm -rf /usr/local/share/assist-daemon
    sudo rm -rf /usr/local/share/aliyun-assis
fi

if systemctl list-units --full -all | grep -Fq "aliyun"; then
    echo "aliyun.service exists, stopping the service..."
    sudo systemctl stop aliyun
fi

if systemctl list-units --full -all | grep -Fq "aegis"; then
    echo "aegis.service exists, stopping the service..."
    sudo systemctl stop aegis
fi

if systemctl list-units --full -all | grep -Fq "aliyun"; then
    echo "aliyun.service exists, disabling the service..."
    sudo systemctl disable aliyun
fi

if systemctl list-units --full -all | grep -Fq "aegis"; then
    echo "aegis.service exists, disabling the service..."
    sudo systemctl disable aegis
fi

SERVICE_FILE="/etc/init.d/aliyun"
if [ -f "$SERVICE_FILE" ]; then
    echo "aliyun.service exists, stopping the service..."
    sudo systemctl stop aliyun
fi