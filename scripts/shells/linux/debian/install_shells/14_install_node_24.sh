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
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Declare all variables at the beginning
INSTALL_NODE=$(get_var "INSTALL_NODE")
INSTALL_MODE=$(get_var "INSTALL_MODE")
SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}
# NODE_VERSION, NODE_SHORT_VERSION, NODE_INSTALL_DIR, NODE_DOWNLOAD_URL are already defined in gvar_common.sh
# Use official Node.js download URL only
NODE_DOWNLOAD_URLS=(
    "$NODE_DOWNLOAD_URL"
)
# Use global temporary directory structure
SCRIPT_TEMP_DIR=$(create_script_temp_dir "14_install_node_24")
TAR_FILE="$SCRIPT_TEMP_DIR/node-$NODE_VERSION-linux-x64.tar.xz"
EXTRACT_DIR="$SCRIPT_TEMP_DIR/node-$NODE_VERSION-linux-x64"
NODE_BIN_DIR="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin"

if [ "$INSTALL_NODE" = "false" ]; then
    echo "Skipping Node.js installation, INSTALL_NODE: $INSTALL_NODE, INSTALL_MODE: $INSTALL_MODE"
    exit 0
fi

echo "COMPILE_DIR: $COMPILE_DIR"
echo "SELECTED_REGION: $SELECTED_REGION"
echo "NODE_VERSION: $NODE_VERSION"
echo "NODE_INSTALL_DIR: $NODE_INSTALL_DIR"

# Function to migrate from old directory structure
migrate_old_nodejs_installation() {
    local old_base_dir=$(map_web_path "dev_system_old")
    
    if [ ! -d "$old_base_dir" ]; then
        return 0
    fi
    
    echo "Detected old installation directory: $old_base_dir"
    echo "Removing old directory completely..."
    
    if [ -f /etc/environment ]; then
        echo "Cleaning old directory references from /etc/environment..."
        $USE_SUDO sed -i "\|$old_base_dir|d" /etc/environment
    fi
    
    for binary in node npm npx; do
        local link_path="/usr/local/bin/$binary"
        if [ -L "$link_path" ]; then
            local target=$(readlink "$link_path")
            if [[ "$target" == *"$old_base_dir"* ]]; then
                echo "Removing symlink pointing to old directory: $link_path"
                $USE_SUDO rm -f "$link_path"
            fi
        fi
    done
    
    echo "Removing old base directory: $old_base_dir"
    $USE_SUDO rm -rf "$old_base_dir"
    
    echo "Old directory removal completed"
    return 0
}

# Function to detect and fix previous installation issues
detect_and_fix_previous_issues() {
    echo "Detecting and fixing previous installation issues..."
    
    # First, migrate from old directory structure if needed
    migrate_old_nodejs_installation
    
    # 1. Fix broken environment variables from previous runs
    echo "Checking /etc/environment for broken entries..."
    if [ -f /etc/environment ]; then
        # Remove invalid NODE-V* entries
        if grep -q "NODE-V.*_HOME=" /etc/environment; then
            echo "Found broken NODE-V*_HOME entries, removing..."
            $USE_SUDO sed -i '/NODE-V.*_HOME=/d' /etc/environment
        fi

        # Remove invalid entries that don't follow KEY="VALUE" format
        if grep -q "^[^=]*=[^\"]*$" /etc/environment | grep -v "^PATH="; then
            echo "Found entries without proper quoting, fixing..."
            $USE_SUDO sed -i 's/^\([^=]*\)=\([^"]*\)$/\1="\2"/' /etc/environment
        fi

        # Remove duplicate NODE_HOME entries
        if [ $(grep -c "^NODE_HOME=" /etc/environment) -gt 1 ]; then
            echo "Found duplicate NODE_HOME entries, removing duplicates..."
            $USE_SUDO sed -i '/^NODE_HOME=/d' /etc/environment
        fi

        # Remove duplicate NODE_PATH entries
        if [ $(grep -c "^NODE_PATH=" /etc/environment) -gt 1 ]; then
            echo "Found duplicate NODE_PATH entries, removing duplicates..."
            $USE_SUDO sed -i '/^NODE_PATH=/d' /etc/environment
        fi
    fi
    
    # 2. Fix broken symlinks
    echo "Checking for broken symlinks in /usr/local/bin..."
    for binary in node npm npx; do
        local link_path="/usr/local/bin/$binary"
        if [ -L "$link_path" ] && [ ! -e "$link_path" ]; then
            echo "Found broken symlink: $link_path, removing..."
            $USE_SUDO rm -f "$link_path"
        fi
    done

    # 3. Clean up old Node.js installations in wrong locations
    echo "Checking for Node.js installations in wrong locations..."
    local wrong_locations=(
        "/usr/local/node"
        "/opt/node"
        "/var/node"
    )

    for wrong_location in "${wrong_locations[@]}"; do
        if [ -d "$wrong_location" ] && [ "$wrong_location" != "$NODE_INSTALL_DIR" ]; then
            echo "Found old Node.js installation in wrong location: $wrong_location"
            read -p "Remove old installation at $wrong_location? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                $USE_SUDO rm -rf "$wrong_location"
                echo "Removed: $wrong_location"
            fi
        fi
    done

    # 4. Fix npm global directory permissions and clean up conflicting npmrc files
    if [ -d "$COMPILE_DIR/npm-global" ]; then
        echo "Fixing npm global directory permissions..."
        if [ "$(id -u)" -eq 0 ]; then
            chown -R root:root "$COMPILE_DIR/npm-global" 2>/dev/null || true
            chmod -R 755 "$COMPILE_DIR/npm-global"
        else
            $USE_SUDO chown -R $(whoami):$(whoami) "$COMPILE_DIR/npm-global" 2>/dev/null || true
            $USE_SUDO chmod -R 755 "$COMPILE_DIR/npm-global"
        fi
    fi

    # 5. Clean up conflicting npmrc files when running as root
    if [ "$(id -u)" -eq 0 ]; then
        echo "Cleaning up conflicting npmrc files..."
        # Remove user-specific npmrc files that might conflict with root configuration
        find /home -name ".npmrc" -type f -exec rm -f {} \; 2>/dev/null || true
        # Clean up any project-specific npmrc that might conflict
        find /tmp -name ".npmrc" -type f -exec rm -f {} \; 2>/dev/null || true
    fi
    
    echo "Previous issues detection and fixing completed."
    return 0
}

# Function to configure pnpm mirror and global settings
configure_npm_settings() {
<<<<<<< HEAD
    echo "Configuring pnpm and npm settings..."

    # First ensure npm is available (comes with Node.js)
    local npm_bin="$NODE_BIN_DIR/npm"
    if [ ! -f "$npm_bin" ]; then
        echo "Warning: npm binary not found at $npm_bin, trying system npm..."
        npm_bin=$(which npm 2>/dev/null)
        if [ -z "$npm_bin" ]; then
            echo "Error: npm not found in system PATH"
            return 1
        fi
    fi

    # Install pnpm globally using npm if not already installed
    if ! command -v pnpm >/dev/null 2>&1; then
        echo "Installing pnpm globally..."
        if [ "$(id -u)" -eq 0 ]; then
            "$npm_bin" install -g pnpm
        else
            $USE_SUDO "$npm_bin" install -g pnpm
        fi

        # Create symlink for pnpm
        local pnpm_path="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin/pnpm"
        if [ -f "$pnpm_path" ]; then
            $USE_SUDO ln -sf "$pnpm_path" /usr/local/bin/pnpm
            echo "Created symlink: /usr/local/bin/pnpm -> $pnpm_path"
        fi
    fi

    # Configure pnpm
    if command -v pnpm >/dev/null 2>&1; then
        # Configure pnpm global directories
        local pnpm_global_dir="$NODE_INSTALL_DIR/node-$NODE_VERSION/pnpm-global"
        local pnpm_global_bin="$pnpm_global_dir/bin"

        echo "Configuring pnpm global directories..."
        pnpm config set global-dir "$pnpm_global_dir"
        pnpm config set global-bin-dir "$pnpm_global_bin"

        # Ensure directories exist
        mkdir -p "$pnpm_global_dir"
        mkdir -p "$pnpm_global_bin"

        # Configure registry based on region
        if [ "$SELECTED_REGION" = "China" ]; then
            echo "Region is set to China, configuring pnpm to use China mirror..."
            pnpm config set registry https://repo.huaweicloud.com/repository/npm/
        else
            echo "Region is Global, using default pnpm registry..."
            pnpm config set registry https://registry.npmjs.org/
        fi

        echo "pnpm configuration completed:"
        pnpm config list
    else
        echo "Warning: pnpm installation failed, falling back to npm"
    fi
=======
    echo "Configuring npm settings..."
    return 0
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
}

check_node_installation() {
    echo "Checking Node.js installation..."

    # First check if binaries exist in expected location
    local node_bin="$NODE_BIN_DIR/node"
    local npm_bin="$NODE_BIN_DIR/npm"

    if [ ! -f "$node_bin" ] || [ ! -f "$npm_bin" ]; then
        echo "Node.js not found in expected location: $NODE_INSTALL_DIR"

        # Try to find Node.js in system locations
        echo "Searching for existing Node.js installations..."
        local system_node=$(which node 2>/dev/null)
        local system_npm=$(which npm 2>/dev/null)

        if [ -n "$system_node" ] && [ -n "$system_npm" ]; then
            echo "Found system Node.js at: $system_node"
            local system_version=$("$system_node" -v 2>/dev/null | sed 's/^v//')
            local system_major=$(echo "$system_version" | cut -d. -f1)

            if [ "$system_major" -ge "$NODE_SHORT_VERSION" ]; then
                echo "System Node.js version $system_version is >= $NODE_SHORT_VERSION (required)"
                echo "Will create proper symlinks and configuration..."
                return 2  # Special return code for system installation found
            else
                echo "System Node.js version $system_version is < $NODE_SHORT_VERSION (required)"
                return 3  # Special return code for old version found
            fi
        fi

        return 1
    fi

    # Check version in target directory
    local current_version
    current_version=$("$node_bin" -v 2>/dev/null | sed 's/^v//')
    if [ -z "$current_version" ]; then
        echo "Failed to get Node.js version from $node_bin"
        return 1
    fi

    local major_version
    major_version=$(echo "$current_version" | cut -d. -f1)

    if [ "$major_version" -ge "$NODE_SHORT_VERSION" ]; then
        echo "Found Node.js $current_version in $NODE_INSTALL_DIR (>= required version $NODE_SHORT_VERSION)"
        return 0
    else
        echo "Node.js version too low. Found: $current_version, Required: >= $NODE_SHORT_VERSION.x"
        return 3  # Old version found
    fi
}

remove_old_node_installation() {
    echo "=================================================="
    echo "Old Node.js version detected"
    echo "=================================================="
    echo "Current Node.js needs to be removed to install version $NODE_SHORT_VERSION"
    echo ""

    # Find all Node.js installations
    local locations_to_remove=()

    # Check target directory
    if [ -d "$NODE_INSTALL_DIR" ]; then
        locations_to_remove+=("$NODE_INSTALL_DIR")
    fi

    # Check common installation locations
    local common_locations=(
        "/usr/local/node"
        "/opt/node"
        "/usr/lib/node"
        "/usr/local/lib/node_modules"
    )

    for loc in "${common_locations[@]}"; do
        if [ -d "$loc" ]; then
            locations_to_remove+=("$loc")
        fi
    done

    # Check symlinks
    local symlinks_to_remove=()
    for binary in node npm npx; do
        local link_path="/usr/local/bin/$binary"
        if [ -L "$link_path" ] || [ -f "$link_path" ]; then
            symlinks_to_remove+=("$link_path")
        fi
    done

    echo "Found Node.js installation(s) at:"
    for loc in "${locations_to_remove[@]}"; do
        echo "  - $loc"
    done

    if [ ${#symlinks_to_remove[@]} -gt 0 ]; then
        echo ""
        echo "Found Node.js symlinks:"
        for link in "${symlinks_to_remove[@]}"; do
            echo "  - $link"
        done
    fi

    echo ""
    echo "Remove old Node.js installation? [Y/n]"
    read -r response

    # Default to yes if user just presses Enter
    if [ -z "$response" ] || [[ "$response" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Removing old Node.js installation..."

        # Remove symlinks first
        for link in "${symlinks_to_remove[@]}"; do
            echo "Removing: $link"
            $USE_SUDO rm -f "$link"
        done

        # Remove directories
        for loc in "${locations_to_remove[@]}"; do
            echo "Removing: $loc"
            $USE_SUDO rm -rf "$loc"
        done

        # Clean up environment variables
        if [ -f /etc/environment ]; then
            echo "Cleaning up environment variables..."
            $USE_SUDO sed -i '/^NODE_HOME=/d' /etc/environment
            $USE_SUDO sed -i '/^NODE_PATH=/d' /etc/environment
            $USE_SUDO sed -i '/^NPM_CONFIG_PREFIX=/d' /etc/environment
        fi

        echo "Old Node.js installation removed successfully"
        return 0
    else
        echo "Installation cancelled by user"
        return 1
    fi
}


install_node() {
    echo "Installing Node.js $NODE_VERSION..."
    echo "Download URL: ${NODE_DOWNLOAD_URLS[0]}"

    cleanup_temp_files_from_common_functions "$EXTRACT_DIR"

    # Check if download already exists using common function
    if ! check_existing_download_from_common_functions "$TAR_FILE" 20971520; then
        echo "Downloading Node.js $NODE_VERSION..."
        # Use common download function with fallback support
        if ! download_with_fallback_from_common_functions "${NODE_DOWNLOAD_URLS[@]}" "$TAR_FILE"; then
            echo "Failed to download Node.js from any source"
            return 1
        fi
    fi

    echo "Extracting Node.js..."
    if ! extract_archive_from_common_functions "$TAR_FILE" "$EXTRACT_DIR" 1; then
        echo "Failed to extract Node.js"
        return 1
    fi

    echo "Installing Node.js to $NODE_INSTALL_DIR..."
    $USE_SUDO mkdir -p "$NODE_INSTALL_DIR"
    if ! $USE_SUDO mv "$EXTRACT_DIR" "$NODE_INSTALL_DIR/node-$NODE_VERSION"; then
        echo "Failed to install Node.js"
        return 1
    fi

    # Set proper permissions
    $USE_SUDO chown -R root:root "$NODE_INSTALL_DIR/node-$NODE_VERSION"
    $USE_SUDO chmod -R 755 "$NODE_INSTALL_DIR/node-$NODE_VERSION"

    cleanup_temp_files_from_common_functions "$EXTRACT_DIR"
    return 0
}

create_symlinks() {
    echo "Creating and verifying symlinks..."

    local node_path="$NODE_BIN_DIR/node"
    local npm_path="$NODE_BIN_DIR/npm"
    local npx_path="$NODE_BIN_DIR/npx"

    if [ ! -f "$node_path" ] || [ ! -f "$npm_path" ]; then
        echo "Error: Node.js binaries not found in $NODE_BIN_DIR"
        return 1
    fi

    $USE_SUDO ln -sf "$node_path" /usr/local/bin/node
    echo "Created symlink: /usr/local/bin/node -> $node_path"

    $USE_SUDO ln -sf "$npm_path" /usr/local/bin/npm
    echo "Created symlink: /usr/local/bin/npm -> $npm_path"

    $USE_SUDO ln -sf "$npx_path" /usr/local/bin/npx
    echo "Created symlink: /usr/local/bin/npx -> $npx_path"

    echo "Core Node.js symlinks created successfully"
    return 0
}

setup_environment() {
    echo "Setting up Node.js environment variables..."

    if [ -f /etc/environment ]; then
        echo "Cleaning up previous broken environment variables..."
        $USE_SUDO sed -i '/NODE-V.*_HOME=/d' /etc/environment
        $USE_SUDO sed -i '/^NODE_HOME=/d' /etc/environment
        $USE_SUDO sed -i '/^NODE_PATH=/d' /etc/environment
    fi

    local actual_node_home="$NODE_INSTALL_DIR/node-$NODE_VERSION"
    local actual_node_path="$actual_node_home/lib/node_modules"

    set_env_and_var "NODE_HOME" "$actual_node_home"
    set_env_and_var "NODE_PATH" "$actual_node_path"

    local current_path=$(grep "^PATH=" /etc/environment 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "$PATH")
    local npm_global_bin="$actual_node_home/bin"

    if [[ "$current_path" != *"$npm_global_bin"* ]]; then
        set_env_and_var "PATH" "$npm_global_bin:$current_path"
        echo "Added npm global directory to PATH"
    else
        echo "npm global directory already in PATH"
    fi

    echo "Environment variables configured:"
    echo "  NODE_HOME: $actual_node_home"
    echo "  NODE_PATH: $actual_node_path"
    echo "  Updated PATH with: $npm_global_bin"

    return 0
}

verify_and_fix_all_configs() {
    echo "=================================================="
    echo "Verifying and fixing all Node.js configurations..."
    echo "=================================================="

    local npm_bin="$NODE_BIN_DIR/npm"
    local pnpm_bin="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin/pnpm"
    local yarn_bin="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin/yarn"

    echo "[1/3] Configuring npm..."
    if [ "$SELECTED_REGION" = "China" ]; then
        "$npm_bin" config set registry https://registry.npmmirror.com
    fi

    echo ""
    echo "[2/3] Installing and configuring pnpm..."
    "$npm_bin" install -g pnpm 2>&1 | grep -v "npm warn"
    $USE_SUDO ln -sf "$pnpm_bin" /usr/local/bin/pnpm
    echo "Linked: /usr/local/bin/pnpm"

    "$pnpm_bin" config set global-dir "$NODE_INSTALL_DIR/node-$NODE_VERSION/pnpm-global"
    "$pnpm_bin" config set global-bin-dir "$NODE_INSTALL_DIR/node-$NODE_VERSION/pnpm-global/bin"
    "$pnpm_bin" config set enable-pre-post-scripts true

    if [ "$SELECTED_REGION" = "China" ]; then
        "$pnpm_bin" config set registry https://repo.huaweicloud.com/repository/npm/
    else
        "$pnpm_bin" config set registry https://registry.npmjs.org/
    fi

    cat > "$HOME/.pnpmrc" <<EOF
registry=$([ "$SELECTED_REGION" = "China" ] && echo "https://repo.huaweicloud.com/repository/npm/" || echo "https://registry.npmjs.org/")
enable-pre-post-scripts=true
EOF
    echo "pnpm configured"

    echo ""
    echo "[3/3] Installing and linking yarn..."
    "$npm_bin" install -g yarn 2>&1 | grep -v "npm warn"
    $USE_SUDO ln -sf "$yarn_bin" /usr/local/bin/yarn
    echo "Linked: /usr/local/bin/yarn"

    echo ""
    echo "=================================================="
    echo "All configurations completed"
    echo "=================================================="
    return 0
}

verify_installation() {
    echo "Verifying installation..."

    # Check binaries in install directory
    local node_bin="$NODE_BIN_DIR/node"
    local npm_bin="$NODE_BIN_DIR/npm"

    if [ ! -f "$node_bin" ] || [ ! -f "$npm_bin" ]; then
        echo "Error: Node.js binaries not found in installation directory"
        return 1
    fi

    # Check symlinks
    if [ ! -L /usr/local/bin/node ] || [ ! -L /usr/local/bin/npm ]; then
        echo "Error: Symlinks verification failed"
        return 1
    fi

    echo "Node.js version: $($node_bin -v)"
    echo "npm version: $($npm_bin -v)"
    if [ -f "$NODE_BIN_DIR/npx" ]; then
        echo "npx version: $($NODE_BIN_DIR/npx -v)"
    fi

    # Show pnpm configuration if available
    if command -v pnpm >/dev/null 2>&1; then
        echo ""
        echo "pnpm version: $(pnpm --version)"
        echo "pnpm configuration:"
        pnpm config list
    fi

    return 0
}

# Main execution
echo "Node.js Installation Script"
echo "Target version: $NODE_VERSION"
echo "Installation directory: $NODE_INSTALL_DIR"

# First, detect and fix any previous installation issues
detect_and_fix_previous_issues

# Check installation status
installation_status=$(check_node_installation)
installation_result=$?

case $installation_result in
    0)
        echo "=================================================="
        echo "Node.js $NODE_VERSION is already installed"
        echo "=================================================="
        echo "Verifying and fixing configuration if needed..."
        echo ""
        ;;
    2)
        echo "=================================================="
        echo "Found compatible system Node.js installation"
        echo "=================================================="
        echo "Will configure symlinks and environment for existing installation."
        echo ""
        ;;
    3)
        echo "=================================================="
        echo "Old Node.js version found"
        echo "=================================================="
        echo ""
        if ! remove_old_node_installation; then
            echo "Installation cancelled"
            exit 0
        fi
        echo ""
        echo "Installing Node.js $NODE_VERSION..."
        if ! install_node; then
            echo "Node.js installation failed"
            exit 1
        fi
        ;;
    1)
        echo "=================================================="
        echo "No Node.js installation found"
        echo "=================================================="
        echo "Installing Node.js $NODE_VERSION..."
        echo ""
        if ! install_node; then
            echo "Node.js installation failed"
            exit 1
        fi
        ;;
esac

if ! create_symlinks; then
    echo "Failed to create symlinks"
    exit 1
fi

if ! setup_environment; then
    echo "Failed to setup environment"
    exit 1
fi

echo ""
verify_and_fix_all_configs

echo ""
if ! verify_installation; then
    echo "Installation verification failed"
    exit 1
fi

echo "Node.js installation completed successfully!"
echo "COMPILE_DIR: $COMPILE_DIR"
echo "Node.js installed in: $NODE_INSTALL_DIR/node-$NODE_VERSION"
echo "npm global packages in: $NODE_INSTALL_DIR/node-$NODE_VERSION"
echo "Node.js binaries linked to: /usr/local/bin/"
echo "To use updated environment variables, restart your shell or run 'source /etc/environment'"
