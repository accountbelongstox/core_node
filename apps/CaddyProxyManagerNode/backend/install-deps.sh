#!/bin/bash
cd "$(dirname "$0")/../../"

# Check if sudo exists and set prefix accordingly
SUDO_CMD=""
if command -v sudo >/dev/null 2>&1; then
    SUDO_CMD="sudo"
fi

# Detect OS and install system dependencies
echo "Checking and installing system dependencies..."
if command -v apt-get >/dev/null 2>&1; then
    # Debian/Ubuntu
    echo "Detected Debian/Ubuntu system"
    $SUDO_CMD apt-get update
    $SUDO_CMD apt-get install -y python build-essential
elif command -v yum >/dev/null 2>&1; then
    # CentOS/RHEL
    echo "Detected CentOS/RHEL system"
    $SUDO_CMD yum install -y python make gcc gcc-c++
else
    echo "Warning: Unable to detect package manager. Please install build tools manually."
fi

echo "Installing Node.js dependencies..."
yarn add express \
    sequelize \
    sqlite3 \
    bcrypt \
    jsonwebtoken \
    handlebars \
    chalk \
    envalid

echo "Installing dev dependencies..."
yarn add -D nodemon jest

echo "Dependencies installation completed!" 