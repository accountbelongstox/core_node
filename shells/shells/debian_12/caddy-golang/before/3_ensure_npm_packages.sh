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

# Function to handle Node.js binary links
handle_node_binaries() {
    echo -e "\033[0;34mHandling Node.js binary links...\033[0m"

    # Get actual Node.js path
    NODE_PATH=$(which node)
    if [ -z "$NODE_PATH" ]; then
        echo -e "\033[0;31mNode.js not found in PATH\033[0m"
        return 1
    }

    # Get real path if it's a symlink
    REAL_NODE_DIR=$(readlink -f "$NODE_PATH")
    BINARY_DIR=$(dirname "$REAL_NODE_DIR")

    echo -e "\033[0;34mNode.js binary directory: $BINARY_DIR\033[0m"

    # Create links for all binaries in the directory
    for binary in "$BINARY_DIR"/*; do
        binary_name=$(basename "$binary")
        target_link="/usr/local/bin/$binary_name"

        # Skip if it's the node binary itself
        if [ "$binary_name" = "node" ]; then
            continue
        fi

        # Remove existing link if it exists
        if [ -e "$target_link" ]; then
            echo -e "\033[0;34mRemoving existing link: $target_link\033[0m"
            rm -f "$target_link"
        fi

        # Create new link
        echo -e "\033[0;34mCreating link for $binary_name\033[0m"
        ln -sf "$binary" "$target_link"
        chmod 777 "$target_link"
    done

    echo -e "\033[0;32mNode.js binary links have been updated successfully\033[0m"
}

# Add this to the end of your script
echo -e "\033[0;34mVerifying Node.js installation...\033[0m"
handle_node_binaries || {
    echo -e "\033[0;31mFailed to handle Node.js binary links\033[0m"
    exit 1
}
