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
SCRIPT_INDEX="20"

# Source global variables
source "$PARENT_DIR_LEVEL_2/linux/LGar.sh"
source "$PARENT_DIR_LEVEL_5/linux/common/gvar_common.sh"

# Get region information
SELECTED_REGION=$(get_var "SELECTED_REGION")

# Get USE_SUDO variable
USE_SUDO=$(get_var "USE_SUDO")
if [ -z "$USE_SUDO" ]; then
    USE_SUDO="sudo"
fi

# Get ENV_LOCAL variable
ENV_LOCAL=$(get_var "ENV_LOCAL")
if [ -z "$ENV_LOCAL" ]; then
    ENV_LOCAL="cn"
fi

# Correct path to check_global_packages.js
CHECK_PACKAGES_SCRIPT="$PARENT_DIR_LEVEL_2/scripts/check_global_packages.js"

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
    
    # Use npm list to check if package is installed globally
    if npm list -g "$package_name" >/dev/null 2>&1; then
        return 0
    fi
    
    # Also check if the binary exists in PATH (fallback check)
    if command -v "$package_name" >/dev/null 2>&1; then
        return 0
    fi
    
    return 1
}

# Function to install package if not already installed
ensure_package() {
    local package=$1
    
    if is_package_installed "$package"; then
        echo "[$SCRIPT_INDEX] $package is already installed, skipping..."
        return 0
    fi
    
    echo "[$SCRIPT_INDEX] Installing $package..."
    
    # Special handling for puppeteer
    if [ "$package" = "puppeteer" ]; then
        # Install chromium first
        $USE_SUDO apt-get install chromium -y
        
        # Install puppeteer with skip download
        if PUPPETEER_SKIP_DOWNLOAD=true npm install -g "$package"; then
            echo "[$SCRIPT_INDEX] $package installed successfully"
            return 0
        else
            echo "[$SCRIPT_INDEX] Failed to install $package"
            return 1
        fi
    else
        # Install regular package
        if npm install -g "$package"; then
            echo "[$SCRIPT_INDEX] $package installed successfully"
            return 0
        else
            echo "[$SCRIPT_INDEX] Failed to install $package"
            return 1
        fi
    fi
}

# Get currently installed packages
INSTALLED_PACKAGES=$(get_installed_packages)

echo "[$SCRIPT_INDEX] Currently installed global packages:"
echo "$INSTALLED_PACKAGES"
echo "[$SCRIPT_INDEX] ----------------------------------------"

# Package mapping: install_name:import_name
declare -A PACKAGES=(
    ["js-yaml"]="js-yaml"
    ["pm2"]="pm2"
    ["typescript"]="typescript"
    ["ts-node"]="ts-node"
    ["nodemon"]="nodemon"
    ["yarn"]="yarn"
    ["pnpm"]="pnpm"
    ["http-server"]="http-server"
    ["puppeteer"]="puppeteer"
    ["serve"]="serve"
    ["npm-check-updates"]="npm-check-updates"
    ["node-gyp"]="node-gyp"
)

# Convert PACKAGES array to JSON format for Node.js script
PACKAGES_JSON="{"
first=true
for install_name in "${!PACKAGES[@]}"; do
    import_name="${PACKAGES[$install_name]}"
    if [ "$first" = true ]; then
        first=false
    else
        PACKAGES_JSON+=","
    fi
    PACKAGES_JSON+="\"$install_name\":\"$import_name\""
done
PACKAGES_JSON+="}"

echo "[$SCRIPT_INDEX] Checking packages using Node.js script..."
echo "[$SCRIPT_INDEX] Package mapping: $PACKAGES_JSON"

# Use Node.js script to check which packages are missing
if [ -f "$CHECK_PACKAGES_SCRIPT" ]; then
    echo "[$SCRIPT_INDEX] Using Node.js script for package detection..."
    MISSING_PACKAGES=$(node "$CHECK_PACKAGES_SCRIPT" check "$PACKAGES_JSON")
    
    if [ -n "$MISSING_PACKAGES" ] && [ "$MISSING_PACKAGES" != "[]" ]; then
        echo "[$SCRIPT_INDEX] Missing packages detected: $MISSING_PACKAGES"
        
        # Parse missing packages and install them
        echo "$MISSING_PACKAGES" | jq -r '.[]' | while read -r package; do
            if [ -n "$package" ]; then
                echo "[$SCRIPT_INDEX] Installing missing package: $package"
                if ! ensure_package "$package"; then
                    echo "[$SCRIPT_INDEX] Failed to install $package"
                fi
            fi
        done
    else
        echo "[$SCRIPT_INDEX] All required packages are already installed"
    fi
else
    echo "[$SCRIPT_INDEX] Warning: check_global_packages.js not found, falling back to individual package checking..."
    failed_packages=()
    
    for install_name in "${!PACKAGES[@]}"; do
        if ! ensure_package "$install_name"; then
            failed_packages+=("$install_name")
        fi
    done
    
    if [ ${#failed_packages[@]} -gt 0 ]; then
        echo "[$SCRIPT_INDEX] Failed to install packages: ${failed_packages[*]}"
    else
        echo "[$SCRIPT_INDEX] All packages installed successfully"
    fi
fi

echo "[$SCRIPT_INDEX] Package installation process completed"

# Function to handle Node.js binary links
handle_node_binaries() {
    echo "[$SCRIPT_INDEX] Creating symlinks for npm global packages..."
    
    # Get actual Node.js path
    NODE_PATH=$(which node)
    if [ -z "$NODE_PATH" ]; then
        echo "[$SCRIPT_INDEX] Node.js not found in PATH"
        return 1
    fi
    
    # Get Node.js directory
    NODE_DIR=$(dirname "$NODE_PATH")
    
    # Create symlinks for common packages
    local packages=("pm2" "typescript" "ts-node" "nodemon" "yarn" "pnpm" "http-server" "serve")
    
    for package in "${packages[@]}"; do
        local global_bin="/usr/local/bin/$package"
        local npm_bin="$NODE_DIR/$package"
        
        if [ -f "$npm_bin" ] && [ ! -L "$global_bin" ]; then
            echo "[$SCRIPT_INDEX] Creating symlink for $package"
            $USE_SUDO ln -s "$npm_bin" "$global_bin"
        fi
    done
}

# Handle Node.js binaries
handle_node_binaries

# Verify installations
echo "[$SCRIPT_INDEX] Verifying installations..."
if [ -f "$CHECK_PACKAGES_SCRIPT" ]; then
    node "$CHECK_PACKAGES_SCRIPT" list
else
    npm list -g --depth=0
fi

# Display npm configuration
echo "[$SCRIPT_INDEX] NPM Configuration:"
npm config list

echo "[$SCRIPT_INDEX] Package installation process completed successfully"