#!/bin/bash

# Check if the script is run as root
if [ "$(id -u)" -ne 0 ]; then
    echo "Please run this script as root or using sudo."
    exit 1
fi

# Update the package list and install necessary packages
echo "Updating package list and installing required packages..."
apt-get update
apt-get install -y locales

# Generate the required locale
echo "Generating en_US.UTF-8 locale..."
sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen
locale-gen en_US.UTF-8

# Set the system-wide locale
echo "Setting system-wide locale..."
update-locale LANG=en_US.UTF-8
update-locale LC_ALL=en_US.UTF-8

# Set environment variables for the current session
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Verify the locale settings
echo "Verifying locale settings..."
locale

echo "Locale setup completed. The system is now configured to use en_US.UTF-8."

# The rest of your SSH setup code remains unchanged
# ...
