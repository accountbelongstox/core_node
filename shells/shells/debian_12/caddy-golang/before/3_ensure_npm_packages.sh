#!/bin/bash

# Function to extract package names from npm list output
get_installed_packages() {
    echo "$GLOBAL_PACKAGES" | grep -v 'npm@' | sed -n 's/.*\([@/][^@]*\)@.*/\1/p' | sed 's/^[@/]*//'
}

# Function to check if a package is installed
is_package_installed() {
    local package_name=$1
    echo "$INSTALLED_PACKAGES" | grep -q "^${package_name}$"
}

# Function to install package if not already installed
ensure_package() {
    local package=$1
    if ! is_package_installed "$package"; then
        echo "Installing $package..."
        npm install -g "$package"
        if [ $? -eq 0 ]; then
            echo "$package installed successfully"
        else
            echo "Failed to install $package"
            exit 1
        fi
    else
        echo "$package is already installed"
    fi
}

# Cache the global packages list
echo "Caching global packages list..."
GLOBAL_PACKAGES=$(npm list -g --depth=0)
INSTALLED_PACKAGES=$(get_installed_packages)

echo "Currently installed global packages:"
echo "$INSTALLED_PACKAGES"
echo "----------------------------------------"

# List of packages to install
PACKAGES=(
    "pm2"
    "typescript"
    "ts-node"
    "nodemon"
    "yarn"
    "pnpm"
    "http-server"
    "serve"
    "npm-check-updates"
    "node-gyp"
)

# Install packages
echo "Checking and installing required packages..."
for package in "${PACKAGES[@]}"; do
    ensure_package "$package"
done

# Verify installations
echo -e "\nVerifying installations..."
npm list -g --depth=0

# Display npm configuration
echo -e "\nNPM Configuration:"
npm config list

echo -e "\nPackage installation completed successfully"
