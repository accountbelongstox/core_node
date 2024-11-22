#!/bin/bash

if ! command -v bt &> /dev/null; then
    echo "Installing Baota panel..."
    wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh ed8484bec
else
    echo "bt command is already installed."
fi
