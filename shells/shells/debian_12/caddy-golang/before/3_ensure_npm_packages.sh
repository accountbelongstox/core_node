#!/bin/bash

# Get the script root directory and common scripts directory from global variables
if [ ! -f "/usr/script_global_var/SCRIPT_ROOT_DIR" ] || [ ! -f "/usr/script_global_var/COMMON_SCRIPTS_DIR" ]; then
    echo "Error: Required global variables not found"
    exit 1
fi

SCRIPT_ROOT_DIR=$(cat "/usr/script_global_var/SCRIPT_ROOT_DIR")
COMMON_SCRIPTS_DIR=$(cat "/usr/script_global_var/COMMON_SCRIPTS_DIR")
CHECK_PACKAGES_SCRIPT="$COMMON_SCRIPTS_DIR/check_global_packages.js"

# Function to extract package names from npm list output
get_installed_packages() {
    # Use the Node.js script to get the package list
    if [ -f "$CHECK_PACKAGES_SCRIPT" ]; then
        GLOBAL_PACKAGES=$(node "$CHECK_PACKAGES_SCRIPT" list)
    else
        echo "Warning: check_global_packages.js not found at $CHECK_PACKAGES_SCRIPT"
        echo "Falling back to npm list command"
        GLOBAL_PACKAGES=$(npm list -g --depth=0)
    fi
    echo "$GLOBAL_PACKAGES" | grep -v 'npm@' | sed -n 's/.*\([@/][^@]*\)@.*/\1/p' | sed 's/^[@/]*//'
}

# Function to check if a package is installed
is_package_installed() {
    local package_name=$1
    if [ -f "$CHECK_PACKAGES_SCRIPT" ]; then
        node "$CHECK_PACKAGES_SCRIPT" check "$package_name" > /dev/null 2>&1
        return $?
    else
        echo "$INSTALLED_PACKAGES" | grep -q "^${package_name}$"
        return $?
    fi
}

# Function to install package if not already installed
ensure_package() {
    local package=$1
    if ! is_package_installed "$package"; then
        echo "Installing $package..."
        if [ -f "$CHECK_PACKAGES_SCRIPT" ]; then
            node "$CHECK_PACKAGES_SCRIPT" install "$package"
        else
            npm install -g "$package"
        fi
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
if [ -f "$CHECK_PACKAGES_SCRIPT" ]; then
    node "$CHECK_PACKAGES_SCRIPT" list
else
    npm list -g --depth=0
fi

# Display npm configuration
echo -e "\nNPM Configuration:"
npm config list

echo -e "\nPackage installation completed successfully"
