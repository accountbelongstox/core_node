#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
COMMON_DIR="${PARENT_DIR_LEVEL_2}/common"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$COMMON_DIR/common_functions.sh"

# Check if Node.js installation is enabled
INSTALL_NODE=$(get_var "INSTALL_NODE")
if [ "$INSTALL_NODE" != "true" ]; then
    echo "[31] Skipping npmrc configuration (INSTALL_NODE: $INSTALL_NODE)"
    exit 0
fi

# Get region information
SELECTED_REGION=$(get_var "SELECTED_REGION")
echo "[31] Selected Region: $SELECTED_REGION"

SHELLS_SCRIPTS_DIR="$(dirname "$PARENT_DIR_LEVEL_2")/scripts"
CHECK_NPMRC_SCRIPT="$SHELLS_SCRIPTS_DIR/check_npmrc.js"

configure_pnpm_global_dirs() {
    if ! command -v pnpm >/dev/null 2>&1; then
        echo "[31] pnpm not installed, skipping global directory configuration"
        return 0
    fi

    local pnpm_global_bin=$(pnpm config get global-bin-dir 2>/dev/null)
    local pnpm_global_dir=$(pnpm config get global-dir 2>/dev/null)
    local pnpm_store_dir=$(pnpm config get store-dir 2>/dev/null)

    local needs_configuration=false
    if [ -z "$pnpm_global_bin" ] || [ "$pnpm_global_bin" = "undefined" ]; then
        needs_configuration=true
    fi

    local current_store_dir=$(pnpm store path 2>/dev/null)
    if [[ "$current_store_dir" == *"MyBest"* ]] || [ -z "$pnpm_store_dir" ] || [ "$pnpm_store_dir" = "undefined" ]; then
        echo "[31] Detected user-specific store path or unconfigured store-dir, reconfiguration needed"
        needs_configuration=true
    fi

    if [ "$needs_configuration" = true ]; then
        echo "[31] Configuring pnpm directories..."

        local node_home
        if [ -n "$NODE_HOME" ]; then
            node_home="$NODE_HOME"
        elif [ -n "$NODE_BIN" ]; then
            node_home=$(dirname $(dirname "$NODE_BIN"))
        else
            node_home=$(dirname $(dirname $(which node 2>/dev/null || echo "/usr/local")))
        fi

        local pnpm_global_dir_new="$node_home/pnpm-global"
        local pnpm_global_bin_new="$pnpm_global_dir_new/bin"
        local pnpm_store_dir_new="$CORE_NODE_DATA_DIR/.pnpm-store"

        echo "[31] Setting pnpm directories..."
        echo "[31]   global-dir: $pnpm_global_dir_new"
        echo "[31]   global-bin-dir: $pnpm_global_bin_new"
        echo "[31]   store-dir: $pnpm_store_dir_new"

        pnpm config set global-dir "$pnpm_global_dir_new"
        pnpm config set global-bin-dir "$pnpm_global_bin_new"
        pnpm config set store-dir "$pnpm_store_dir_new"

        mkdir -p "$pnpm_global_dir_new"
        mkdir -p "$pnpm_global_bin_new"
        mkdir -p "$pnpm_store_dir_new"

        echo "[31] pnpm directories configured successfully"
    else
        echo "[31] pnpm directories already configured:"
        echo "[31]   global-dir: $pnpm_global_dir"
        echo "[31]   global-bin-dir: $pnpm_global_bin"
        echo "[31]   store-dir: $pnpm_store_dir"
    fi
}

fix_npm_config() {
    local USE_SUDO=$(get_var "USE_SUDO")
    if [ -z "$USE_SUDO" ]; then
        USE_SUDO="sudo"
    fi

    echo "[31] Checking and fixing pnpm configuration..."

    if [ -n "$PNPM_HOME" ]; then
        echo "[31] Clearing PNPM_HOME: $PNPM_HOME"
        unset PNPM_HOME
    fi

    if [ -f /etc/environment ]; then
        if grep -q "NPM_CONFIG_PREFIX" /etc/environment; then
            echo "[31] Removing NPM_CONFIG_PREFIX from /etc/environment..."
            $USE_SUDO sed -i '/^NPM_CONFIG_PREFIX=/d' /etc/environment
        fi
    fi

    # Configure pnpm global directories
    configure_pnpm_global_dirs

    echo "[31] Configuration check completed"
    return 0
}

# Print section header
print_header() {
    echo -e "\n\033[1;34m=== $1 ===\033[0m"
    echo -e "\033[1;34m$(printf '=%.0s' {1..50})\033[0m\n"
}

# Print step info
print_step() {
    echo -e "\033[0;36m>>> $1\033[0m"
}

# Print success message
print_success() {
    echo -e "\033[0;32m[OK] $1\033[0m"
}

# Print error message
print_error() {
    echo -e "\033[0;31m[ERROR] $1\033[0m"
}

# Main execution starts here
print_header_from_common_functions "PNPM Configuration Setup"

fix_npm_config

# Step 1: Check script existence
print_step_from_common_functions "Checking pnpm configuration script..."
if [ ! -f "$CHECK_NPMRC_SCRIPT" ]; then
    print_error_from_common_functions "Configuration script not found at: $CHECK_NPMRC_SCRIPT"
    exit 1
fi
print_success_from_common_functions "Found configuration script"

# Step 2: Display current pnpm configuration
print_step_from_common_functions "Current pnpm configuration before updates:"
echo "----------------------------------------"
pnpm config list 2>/dev/null || echo "pnpm config not available"
echo "----------------------------------------"

# Step 3: Display current .npmrc files (pnpm also uses .npmrc)
print_step_from_common_functions "Current .npmrc files before updates:"
echo "----------------------------------------"
if [ -f ~/.npmrc ]; then
    echo "User .npmrc (~/.npmrc):"
    cat ~/.npmrc
else
    echo "No user .npmrc file found"
fi

if [ -f /etc/npmrc ]; then
    echo -e "\nSystem-wide npmrc (/etc/npmrc):"
    cat /etc/npmrc
else
    echo -e "\nNo system-wide npmrc file found"
fi
echo "----------------------------------------"

# Step 4: Run npmrc configuration script
print_step_from_common_functions "Running npmrc configuration script..."
if [ -f "$CHECK_NPMRC_SCRIPT" ]; then
    if [ "$SELECTED_REGION" != "Global" ]; then
        "$NODE_BIN" "$CHECK_NPMRC_SCRIPT" 
        if [ $? -ne 0 ]; then
            print_error_from_common_functions "Failed to configure npmrc"
            exit 1
        fi
        print_success_from_common_functions "Npmrc configuration completed"
    else
        print_step_from_common_functions "Skipping npmrc configuration for Global environment"
    fi
else
    print_step_from_common_functions "Warning: check_npmrc.js not found, verifying basic configuration..."
    
    if [ "$SELECTED_REGION" = "China" ]; then
        echo "[31] Setting up China mirror configuration..."
        pnpm config set registry https://repo.huaweicloud.com/repository/npm/
        pnpm config set disturl https://repo.huaweicloud.com/nodejs
        pnpm config set sass_binary_site https://repo.huaweicloud.com/node-sass
        pnpm config set sharp_libvips_binary_host https://repo.huaweicloud.com/node-libvips
        pnpm config set python_mirror https://repo.huaweicloud.com/python
        pnpm config set electron_mirror https://repo.huaweicloud.com/electron/
        pnpm config set electron_builder_binaries_mirror https://repo.huaweicloud.com/electron-builder-binaries/
        pnpm config set canvas_binary_host_mirror https://repo.huaweicloud.com/node-canvas-prebuilt/
        pnpm config set node_sqlite3_binary_host_mirror https://repo.huaweicloud.com/node-sqlite3/
        pnpm config set better_sqlite3_binary_host_mirror https://repo.huaweicloud.com/better-sqlite3/
    else
        echo "[31] Setting up Global registry configuration..."
        pnpm config set registry https://registry.npmjs.org/
    fi
fi

# Step 5: Verify configuration
print_header_from_common_functions "Configuration Verification"

print_step_from_common_functions "Checking registry configuration..."
REGISTRY=$(pnpm config get registry)
echo "Registry: $REGISTRY"

print_step_from_common_functions "Checking binary mirrors..."
echo "Node binary mirror: $(pnpm config get disturl 2>/dev/null || echo 'not set')"
echo "Electron mirror: $(pnpm config get electron_mirror 2>/dev/null || echo 'not set')"
echo "Python mirror: $(pnpm config get python_mirror 2>/dev/null || echo 'not set')"
echo "Node-sass mirror: $(pnpm config get sass_binary_site 2>/dev/null || echo 'not set')"

print_step_from_common_functions "Checking updated .npmrc files:"
echo "----------------------------------------"
if [ -f ~/.npmrc ]; then
    echo "Updated user .npmrc (~/.npmrc):"
    cat ~/.npmrc
fi

if [ -f /etc/npmrc ]; then
    echo -e "\nUpdated system-wide npmrc (/etc/npmrc):"
    cat /etc/npmrc
fi
echo "----------------------------------------"

# Step 6: Test pnpm access
print_step_from_common_functions "Testing pnpm registry access..."
if pnpm ping >/dev/null 2>&1; then
    print_success_from_common_functions "Successfully connected to pnpm registry"
else
    print_error_from_common_functions "Failed to connect to pnpm registry (this is non-fatal)"
fi

# Final status
print_header_from_common_functions "Configuration Summary"
echo "User npmrc location: ~/.npmrc"
echo "System npmrc location: /etc/npmrc"
echo "Global node_modules: $(pnpm root -g 2>/dev/null || echo 'not available')"
echo "PNPM cache location: $(pnpm config get cache 2>/dev/null || echo 'not available')"
echo "PNPM version: $(pnpm -v)"
echo "Node version: $(node -v)"

# Verify all required configurations
print_step_from_common_functions "Verifying all required configurations..."
REQUIRED_CONFIGS=(
    "registry"
    "disturl"
    "sass_binary_site"
    "sharp_libvips_binary_host"
    "python_mirror"
    "electron_mirror"
    "electron_builder_binaries_mirror"
    "canvas_binary_host_mirror"
    "node_sqlite3_binary_host_mirror"
    "better_sqlite3_binary_host_mirror"
)

CONFIG_STATUS="OK"
for config in "${REQUIRED_CONFIGS[@]}"; do
    value=$(npm config get $config 2>/dev/null)
    if [ -z "$value" ] || [ "$value" = "undefined" ]; then
        if [ "$SELECTED_REGION" = "China" ]; then
            print_error_from_common_functions "Missing configuration: $config"
            CONFIG_STATUS="FAILED"
        else
            echo "[31] Configuration $config not set (optional for Global region)"
        fi
    else
        print_success_from_common_functions "$config = $value"
    fi
done

if [ "$CONFIG_STATUS" = "OK" ]; then
    print_header_from_common_functions "NPM Configuration Successfully Completed"
    print_success_from_common_functions "All required configurations are properly set"
else
    print_header_from_common_functions "NPM Configuration Incomplete"
    print_error_from_common_functions "Some configurations are missing or incorrect"
fi
