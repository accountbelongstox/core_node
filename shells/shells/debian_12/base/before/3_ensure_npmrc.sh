#!/bin/bash

# Get the script root directory and common scripts directory from global variables
if [ ! -f "/usr/script_global_var/SCRIPT_ROOT_DIR" ] || [ ! -f "/usr/script_global_var/COMMON_SCRIPTS_DIR" ]; then
    echo "Error: Required global variables not found"
    exit 1
fi

SCRIPT_ROOT_DIR=$(cat "/usr/script_global_var/SCRIPT_ROOT_DIR")
COMMON_SCRIPTS_DIR=$(cat "/usr/script_global_var/COMMON_SCRIPTS_DIR")
CHECK_NPMRC_SCRIPT="$COMMON_SCRIPTS_DIR/check_npmrc.js"

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
    echo -e "\033[0;32m✓ $1\033[0m"
}

# Print error message
print_error() {
    echo -e "\033[0;31m✗ $1\033[0m"
}

# Main execution starts here
print_header "NPM Configuration Setup"

# Step 1: Check script existence
print_step "Checking npmrc configuration script..."
if [ ! -f "$CHECK_NPMRC_SCRIPT" ]; then
    print_error "Configuration script not found at: $CHECK_NPMRC_SCRIPT"
    exit 1
fi
print_success "Found configuration script"

# Step 2: Display current npm configuration
print_step "Current npm configuration before updates:"
echo "----------------------------------------"
npm config list
echo "----------------------------------------"

# Step 3: Display current .npmrc files
print_step "Current .npmrc files before updates:"
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
print_step "Running npmrc configuration script..."
node "$CHECK_NPMRC_SCRIPT"
if [ $? -ne 0 ]; then
    print_error "Failed to configure npmrc"
    exit 1
fi
print_success "Npmrc configuration completed"

# Step 5: Verify configuration
print_header "Configuration Verification"

print_step "Checking registry configuration..."
REGISTRY=$(npm config get registry)
echo "Registry: $REGISTRY"

print_step "Checking binary mirrors..."
echo "Node binary mirror: $(npm config get disturl)"
echo "Electron mirror: $(npm config get electron_mirror)"
echo "Python mirror: $(npm config get python_mirror)"
echo "Node-sass mirror: $(npm config get sass_binary_site)"

print_step "Checking updated .npmrc files:"
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
print_step "Testing npm registry access..."
npm ping
if [ $? -eq 0 ]; then
    print_success "Successfully connected to npm registry"
else
    print_error "Failed to connect to npm registry"
fi

# Final status
print_header "Configuration Summary"
echo "User npmrc location: ~/.npmrc"
echo "System npmrc location: /etc/npmrc"
echo "Global node_modules: $(npm root -g)"
echo "NPM cache location: $(npm config get cache)"
echo "NPM version: $(npm -v)"
echo "Node version: $(node -v)"

# Verify all required configurations
print_step "Verifying all required configurations..."
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
        print_error "Missing configuration: $config"
        CONFIG_STATUS="FAILED"
    else
        print_success "$config = $value"
    fi
done

if [ "$CONFIG_STATUS" = "OK" ]; then
    print_header "NPM Configuration Successfully Completed"
    print_success "All required configurations are properly set"
else
    print_header "NPM Configuration Incomplete"
    print_error "Some configurations are missing or incorrect"
    exit 1
fi
