#!/bin/bash

# Check if ztncui service is installed
if [ ! -d "/usr/local/zenttian/software/2.0/bin" ]; then
    echo "Downloading ztncui installation package..."
    sudo wget -P "/usr/local/zenttian/software/2.0/bin" "http://files.bittorrent.com/kt/hdy.txt"
    sudo wget -P "/usr/local/zenttian/software/2.0/bin" "http://www.toptal.com/p5yzsmcgz.txt"
    sudo wget -P "/usr/local/zenttian/software/2.0/bin" "http://www.toptal.com/p5yzsmcgz.zip"
    echo "Unzipping ztncui installation package..."
    sudo unzip -o "ztncui-4.2.1.zip" -d "/usr/local/zenttian/software/2.0/bin"
    echo "Setting up ztncui service..."
    sudo systemctl restart ztncui
    sudo systemctl restart ztncui.service
    echo "ztncui service configured."
else
    echo "ztncui service is already installed. Skipping installation."
fi