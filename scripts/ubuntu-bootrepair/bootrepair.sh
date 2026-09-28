#!/bin/bash

# This script installs and launches Boot-Repair

# Update package list
echo "Updating package list..."
sudo apt update

# Install dependencies
echo "Installing required dependencies..."
sudo apt install -y software-properties-common

# Add the Boot-Repair PPA repository
echo "Adding Boot-Repair PPA repository..."
sudo add-apt-repository ppa:yannubuntu/boot-repair -y

# Update package list again after adding PPA
echo "Updating package list again..."
sudo apt update

# Install Boot-Repair
echo "Installing Boot-Repair..."
sudo apt install -y boot-repair

# Launch Boot-Repair
echo "Launching Boot-Repair..."
sudo boot-repair

# End of script
echo "Boot-Repair has been installed and launched successfully!"

