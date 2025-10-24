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
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$COMMON_DIR/common_functions.sh"

# Check if Node.js installation is enabled
INSTALL_NODE=$(get_var "INSTALL_NODE")
if [ "$INSTALL_NODE" != "true" ]; then
    echo "[29] Skipping npmrc configuration (INSTALL_NODE: $INSTALL_NODE)"
    exit 0
fi

# Get region information
SELECTED_REGION=$(get_var "SELECTED_REGION")
echo "[29] Selected Region: $SELECTED_REGION"

SHELLS_SCRIPTS_DIR="$(dirname "$PARENT_DIR_LEVEL_2")/scripts"
CHECK_NPMRC_SCRIPT="$SHELLS_SCRIPTS_DIR/check_npmrc.js"

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
print_header_from_common_functions "NPM Configuration Setup"

# Step 1: Check script existence
print_step_from_common_functions "Checking npmrc configuration script..."
if [ ! -f "$CHECK_NPMRC_SCRIPT" ]; then
    print_error_from_common_functions "Configuration script not found at: $CHECK_NPMRC_SCRIPT"
    exit 1
fi
print_success_from_common_functions "Found configuration script"

# Step 2: Display current npm configuration
print_step_from_common_functions "Current npm configuration before updates:"
echo "----------------------------------------"
npm config list
echo "----------------------------------------"

# Step 3: Display current .npmrc files
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

# Step 5: Verify configuration
print_header_from_common_functions "Configuration Verification"

print_step_from_common_functions "Checking registry configuration..."
REGISTRY=$(npm config get registry)
echo "Registry: $REGISTRY"

print_step_from_common_functions "Checking binary mirrors..."
echo "Node binary mirror: $(npm config get disturl)"
echo "Electron mirror: $(npm config get electron_mirror)"
echo "Python mirror: $(npm config get python_mirror)"
echo "Node-sass mirror: $(npm config get sass_binary_site)"

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

# Step 6: Test npm access
print_step_from_common_functions "Testing npm registry access..."
npm ping
if [ $? -eq 0 ]; then
    print_success_from_common_functions "Successfully connected to npm registry"
else
    print_error_from_common_functions "Failed to connect to npm registry"
fi

# Final status
print_header_from_common_functions "Configuration Summary"
echo "User npmrc location: ~/.npmrc"
echo "System npmrc location: /etc/npmrc"
echo "Global node_modules: $(npm root -g)"
echo "NPM cache location: $(npm config get cache)"
echo "NPM version: $(npm -v)"
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
    value=$(npm config get $config)
    if [ -z "$value" ]; then
        print_error_from_common_functions "Missing configuration: $config"
        CONFIG_STATUS="FAILED"
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
    exit 1
fi
