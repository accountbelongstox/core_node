#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
# Source global variables
source "$PARENT_DIR_LEVEL_2$PARENT_DIR_LEVEL_2/linux/LGar.sh"
source "$COMMON_SHELLS_DIR/gvar_common.sh"
if [ -n "$ENV_LOCAL" ]; then
    ENV_LOCAL="$ENV_LOCAL"
else
    ENV_LOCAL=$(get_var "ENV_LOCAL")
    if [ -z "$ENV_LOCAL" ]; then
        ENV_LOCAL="cn"
    fi
fi

CHECK_PACKAGES_SCRIPT="$SHELLS_SCRIPTS_DIR/check_global_packages.js"

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
            if [ "$package" = "puppeteer" ]; then
                ${USE_SUDO} apt-get install chromium -y
                PUPPETEER_SKIP_DOWNLOAD=true \
                PUPPETEER_DOWNLOAD_BASE_URL=https://npmmirror.com/mirrors/puppeteer \
                npm install -g "$package"
            else
                npm install -g "$package"
            fi
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
    "js-yaml"
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
    fi

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
        # SECURITY FIX: Do NOT chmod symlinks - this affects the target files
        # Symlinks inherit permissions from their targets
    done

    echo -e "\033[0;32mNode.js binary links have been updated successfully\033[0m"
}

# Add this to the end of your script
echo -e "\033[0;34mVerifying Node.js installation...\033[0m"
handle_node_binaries || {
    echo -e "\033[0;31mFailed to handle Node.js binary links\033[0m"
    exit 1
}
