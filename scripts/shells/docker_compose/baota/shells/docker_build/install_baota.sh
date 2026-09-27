#!/bin/bash

# Download the installation script
wget -O install.sh https://download.bt.cn/install/install_lts.sh

# Check if the download was successful
if [ $? -ne 0 ]; then
    echo "Failed to download the install script."
    exit 1
fi

# Run the installation script with automatic "yes" input
bash install.sh ed8484bec -y << EOF
yes
EOF

# Optional: Check the status of the installation
if [ $? -eq 0 ]; then
    echo "Installation completed successfully."
else
    echo "Installation failed."
    exit 1
fi
