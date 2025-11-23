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
SCRIPT_INDEX="28"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
# Get region information
SELECTED_REGION=$(get_var "SELECTED_REGION")

# Get USE_SUDO variable
USE_SUDO=$(get_var "USE_SUDO")
if [ -z "$USE_SUDO" ]; then
    USE_SUDO="sudo"
fi

CHECK_PACKAGES_SCRIPT="$(dirname "$PARENT_DIR_LEVEL_2")/scripts/check_global_packages.js"

migrate_old_npm_installation() {
    local old_base_dir="/www/dev_ubuntu24"
    local new_base_dir="/www/_ubuntu_24"
    
    echo "[$SCRIPT_INDEX] Checking for old npm installation references..."
    
    if command -v npm >/dev/null 2>&1; then
        local current_npm_prefix=$(npm config get prefix 2>/dev/null)
        
        if [[ "$current_npm_prefix" == *"$old_base_dir"* ]]; then
            local new_npm_prefix="${current_npm_prefix/$old_base_dir/$new_base_dir}"
            echo "[$SCRIPT_INDEX] Migrating npm prefix: $current_npm_prefix -> $new_npm_prefix"
            npm config set prefix "$new_npm_prefix"
        fi
    fi
    
    if [ -n "$NPM_CONFIG_PREFIX" ] && [[ "$NPM_CONFIG_PREFIX" == *"$old_base_dir"* ]]; then
        export NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX/$old_base_dir/$new_base_dir}"
        echo "[$SCRIPT_INDEX] Updated NPM_CONFIG_PREFIX in current shell: $NPM_CONFIG_PREFIX"
    fi
    
    if [ -f /etc/environment ]; then
        if grep -q "$old_base_dir" /etc/environment; then
            echo "[$SCRIPT_INDEX] Updating /etc/environment references..."
            $USE_SUDO sed -i "s|$old_base_dir|$new_base_dir|g" /etc/environment
        fi
    fi
    
    if [ -d "$old_base_dir" ]; then
        if [ -d "$old_base_dir/nodejs" ]; then
            echo "[$SCRIPT_INDEX] Migrating nodejs directory..."
            if [ ! -d "$new_base_dir" ]; then
                $USE_SUDO mkdir -p "$new_base_dir"
            fi
            
            if [ -d "$new_base_dir/nodejs" ]; then
                $USE_SUDO rsync -a --ignore-existing "$old_base_dir/nodejs/" "$new_base_dir/nodejs/"
            else
                $USE_SUDO mv "$old_base_dir/nodejs" "$new_base_dir/nodejs"
            fi
            
            $USE_SUDO rm -rf "$old_base_dir/nodejs"
        fi
        
        if [ -z "$(ls -A "$old_base_dir" 2>/dev/null)" ]; then
            echo "[$SCRIPT_INDEX] Removing empty old directory: $old_base_dir"
            $USE_SUDO rm -rf "$old_base_dir"
        fi
    fi
    
    echo "[$SCRIPT_INDEX] Migration check completed"
    return 0
}

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

# Function to check if a package is installed and linked correctly
is_package_installed() {
    local package_name=$1
    
    if ! npm list -g "$package_name" >/dev/null 2>&1; then
        return 1
    fi
    
    local npm_bin_dir=$(npm config get prefix 2>/dev/null)/bin
    if [ -z "$npm_bin_dir" ] || [ ! -d "$npm_bin_dir" ]; then
        return 1
    fi
    
    local binary_path="$npm_bin_dir/$package_name"
    if [ ! -e "$binary_path" ]; then
        binary_path=$(which "$package_name" 2>/dev/null)
        if [ -z "$binary_path" ]; then
            return 1
        fi
    fi
    
    local link_path="/usr/local/bin/$package_name"
    if [ -L "$link_path" ]; then
        local current_target=$(readlink -f "$link_path")
        local real_binary=$(readlink -f "$binary_path")
        
        if [ "$current_target" = "$real_binary" ]; then
            return 0
        else
            echo "[$SCRIPT_INDEX] Package $package_name installed but link incorrect"
            return 1
        fi
    fi
    
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
        # Install puppeteer with PUPPETEER_SKIP_DOWNLOAD to avoid chromium installation
        # This is safer and faster than trying to install system chromium
        if PUPPETEER_SKIP_DOWNLOAD=true npm install -g "$package"; then
            echo "[$SCRIPT_INDEX] $package installed successfully"
            echo "[$SCRIPT_INDEX] Note: Puppeteer installed in skip-download mode. Chromium binary will be downloaded on first use."
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

echo "[$SCRIPT_INDEX] NPM Global Package Installation Script"

migrate_old_npm_installation

echo "[$SCRIPT_INDEX] Checking currently installed global packages..."

# Cache the global packages list
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

    # Get npm global binary directory
    local npm_bin_dir
    if command -v npm >/dev/null 2>&1; then
        npm_bin_dir=$(npm bin -g 2>/dev/null)
        if [ -n "$npm_bin_dir" ] && [ -d "$npm_bin_dir" ]; then
            echo "[$SCRIPT_INDEX] npm global bin directory: $npm_bin_dir"
            
            # Create symlinks for all binaries in npm global bin directory
            for binary in "$npm_bin_dir"/*; do
                if [ -f "$binary" ] && [ -x "$binary" ]; then
                    binary_name=$(basename "$binary")
                    
                    # Skip if symlink already exists and points to correct location
                    if [ -L "/usr/local/bin/$binary_name" ]; then
                        local current_target=$(readlink "/usr/local/bin/$binary_name")
                        if [ "$current_target" = "$binary" ]; then
                            continue
                        fi
                    fi
                    
                    echo "[$SCRIPT_INDEX] Creating symlink for: $binary_name"
                    $USE_SUDO ln -sf "$binary" "/usr/local/bin/$binary_name"
                fi
            done
            
            echo "[$SCRIPT_INDEX] npm global package symlinks created successfully"
        else
            echo "[$SCRIPT_INDEX] Warning: npm global bin directory not found"
        fi
    else
        echo "[$SCRIPT_INDEX] Warning: npm command not found"
    fi
}

# Handle binary links
echo "[$SCRIPT_INDEX] Setting up npm global package symlinks..."
handle_node_binaries
