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
    local old_base_dir=$(map_web_path "dev_system_old")

    echo "[$SCRIPT_INDEX] Checking for old installation references..."

    if command -v pnpm >/dev/null 2>&1; then
        local current_pnpm_prefix=$(pnpm config get prefix 2>/dev/null)

        if [[ "$current_pnpm_prefix" == *"$old_base_dir"* ]]; then
            echo "[$SCRIPT_INDEX] Clearing pnpm prefix pointing to old directory"
            pnpm config delete prefix
        fi
    fi

    if [ -n "$PNPM_HOME" ]; then
        echo "[$SCRIPT_INDEX] Clearing PNPM_HOME: $PNPM_HOME"
        unset PNPM_HOME
    fi
    
    if [ -f /etc/environment ]; then
        if grep -q "$old_base_dir" /etc/environment; then
            echo "[$SCRIPT_INDEX] Removing old directory references from /etc/environment..."
            $USE_SUDO sed -i "\|$old_base_dir|d" /etc/environment
        fi
        if grep -q "NPM_CONFIG_PREFIX" /etc/environment; then
            echo "[$SCRIPT_INDEX] Removing NPM_CONFIG_PREFIX from /etc/environment..."
            $USE_SUDO sed -i '/^NPM_CONFIG_PREFIX=/d' /etc/environment
        fi
    fi
    
    if [ -d "$old_base_dir" ]; then
        echo "[$SCRIPT_INDEX] Removing old base directory: $old_base_dir"
        $USE_SUDO rm -rf "$old_base_dir"
    fi
    
    echo "[$SCRIPT_INDEX] Migration check completed"
    return 0
}

# Function to extract package names from pnpm list output
get_installed_packages() {
    # Use the Node.js script to get the package list
    if [ -f "$CHECK_PACKAGES_SCRIPT" ]; then
        GLOBAL_PACKAGES=$(node "$CHECK_PACKAGES_SCRIPT" list)
    else
        echo "Warning: check_global_packages.js not found at $CHECK_PACKAGES_SCRIPT"
        echo "Falling back to pnpm list command"
        GLOBAL_PACKAGES=$(pnpm list -g --depth=0 2>/dev/null || npm list -g --depth=0)
    fi
    echo "$GLOBAL_PACKAGES" | grep -v 'pnpm@\|npm@' | sed -n 's/.*\([@/][^@]*\)@.*/\1/p' | sed 's/^[@/]*//'
}

# Function to check if a package is installed and linked correctly
is_package_installed() {
    local package_name=$1

    if ! pnpm list -g "$package_name" >/dev/null 2>&1; then
        return 1
    fi

    local pnpm_bin_dir=$(pnpm bin -g 2>/dev/null)
    if [ -z "$pnpm_bin_dir" ] || [ ! -d "$pnpm_bin_dir" ]; then
        return 1
    fi

    local binary_path="$pnpm_bin_dir/$package_name"
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
        if PUPPETEER_SKIP_DOWNLOAD=true pnpm add -g "$package"; then
            echo "[$SCRIPT_INDEX] $package installed successfully"
            echo "[$SCRIPT_INDEX] Note: Puppeteer installed in skip-download mode. Chromium binary will be downloaded on first use."
            return 0
        else
            echo "[$SCRIPT_INDEX] Failed to install $package"
            return 1
        fi
    else
        # Install regular package
        if pnpm add -g "$package"; then
            echo "[$SCRIPT_INDEX] $package installed successfully"
            return 0
        else
            echo "[$SCRIPT_INDEX] Failed to install $package"
            return 1
        fi
    fi
}

echo "[$SCRIPT_INDEX] PNPM Global Package Installation Script"

migrate_old_npm_installation

# Ensure pnpm is installed first (bootstrap)
echo "[$SCRIPT_INDEX] Ensuring pnpm is installed..."
if ! command -v pnpm >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] pnpm not found, installing via npm..."
    if command -v npm >/dev/null 2>&1; then
        npm install -g pnpm
        # Create symlink
        node_bin_dir=$(dirname $(which node))
        if [ -f "$node_bin_dir/pnpm" ]; then
            $USE_SUDO ln -sf "$node_bin_dir/pnpm" /usr/local/bin/pnpm
            echo "[$SCRIPT_INDEX] pnpm installed successfully"
        fi
    else
        echo "[$SCRIPT_INDEX] ERROR: npm not found, cannot install pnpm"
        exit 1
    fi
else
    echo "[$SCRIPT_INDEX] pnpm is already installed: $(pnpm --version)"
fi

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
    echo "[$SCRIPT_INDEX] Creating symlinks for pnpm global packages..."

    # Get pnpm global binary directory
    local pnpm_bin_dir
    if command -v pnpm >/dev/null 2>&1; then
        pnpm_bin_dir=$(pnpm bin -g 2>/dev/null)
        if [ -n "$pnpm_bin_dir" ] && [ -d "$pnpm_bin_dir" ]; then
            echo "[$SCRIPT_INDEX] pnpm global bin directory: $pnpm_bin_dir"

            # Create symlinks for all binaries in pnpm global bin directory
            for binary in "$pnpm_bin_dir"/*; do
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

            echo "[$SCRIPT_INDEX] pnpm global package symlinks created successfully"
        else
            echo "[$SCRIPT_INDEX] Warning: pnpm global bin directory not found"
        fi
    else
        echo "[$SCRIPT_INDEX] Warning: pnpm command not found"
    fi
}

# Handle binary links
echo "[$SCRIPT_INDEX] Setting up pnpm global package symlinks..."
handle_node_binaries
