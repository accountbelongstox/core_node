#!/bin/bash

# Function to stop and disable a service
manage_service() {
    local service_name="$1"

    if systemctl list-units --full --all | grep -Fq "$service_name.service"; then
        echo "$service_name.service exists, stopping the service..."
        sudo systemctl stop "$service_name.service"

        echo "$service_name.service exists, disabling the service..."
        sudo systemctl disable "$service_name.service"
    else
        echo "$service_name.service does not exist, skipping."
    fi
}

# Manage Exim service
manage_service "exim"

# Manage Postfix service
manage_service "postfix"

# Check if service command exists for legacy init scripts
if [ -x "$(command -v service)" ]; then
    if [ -f "/etc/init.d/exim" ]; then
        echo "exim service exists, stopping the service..."
        sudo service exim stop
    else
        echo "exim service does not exist, skipping."
    fi

    if [ -f "/etc/init.d/postfix" ]; then
        echo "postfix service exists, stopping the service..."
        sudo service postfix stop
    else
        echo "postfix service does not exist, skipping."
    fi
else
    echo "The 'service' command is not available. Please use alternative methods suitable for your container."
fi
