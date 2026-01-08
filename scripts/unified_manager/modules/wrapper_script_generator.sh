#!/bin/bash
# Wrapper Script Generator Module
# Provides utilities for generating wrapper scripts for systemd services

# Base directory for wrapper scripts
WRAPPER_SCRIPT_BASE_DIR="/var/_core_node/unified_manager/temp_scripts"

# Colors for logging
COLOR_SUCCESS="\033[32m"
COLOR_INFO="\033[90m"
COLOR_RESET="\033[0m"

# Ensure wrapper script directory exists
ensure_wrapper_script_dir() {
    mkdir -p "$WRAPPER_SCRIPT_BASE_DIR"
}

# Generate a wrapper script for build services
# Arguments: service_name, execute_command
generate_build_wrapper_script() {
    local service_name="$1"
    local execute_command="$2"

    ensure_wrapper_script_dir

    local wrapper_script="$WRAPPER_SCRIPT_BASE_DIR/${service_name}.sh"

    cat > "$wrapper_script" << 'EOF_WRAPPER'
#!/bin/bash
set -e

echo "Starting built application..."
echo "Command: $BUILD_COMMAND"
echo ""

# Execute build start command (command includes full paths)
exec $BUILD_COMMAND
EOF_WRAPPER

    # Replace placeholders
    sed -i "s|\$BUILD_COMMAND|$execute_command|g" "$wrapper_script"

    chmod +x "$wrapper_script"

    echo "$wrapper_script"
}

# Generate a wrapper script for normal dev services
# Arguments: service_name, app_path, execute_command
generate_dev_wrapper_script() {
    local service_name="$1"
    local app_path="$2"
    local execute_command="$3"

    ensure_wrapper_script_dir

    local wrapper_script="$WRAPPER_SCRIPT_BASE_DIR/${service_name}.sh"

    cat > "$wrapper_script" << 'EOF_WRAPPER'
#!/bin/bash
set -e

cd "$APP_PATH"

echo "Starting development application..."
echo "Working directory: $(pwd)"
echo "Command: $DEV_COMMAND"
echo ""

# Execute dev start command
exec $DEV_COMMAND
EOF_WRAPPER

    # Replace placeholders
    sed -i "s|\$APP_PATH|$app_path|g" "$wrapper_script"
    sed -i "s|\$DEV_COMMAND|$execute_command|g" "$wrapper_script"

    chmod +x "$wrapper_script"

    echo "$wrapper_script"
}

# Remove a wrapper script
# Arguments: service_name
remove_wrapper_script() {
    local service_name="$1"
    local wrapper_script="$WRAPPER_SCRIPT_BASE_DIR/${service_name}.sh"

    if [[ -f "$wrapper_script" ]]; then
        rm -f "$wrapper_script"
        echo -e "${COLOR_INFO}Removed wrapper script: $wrapper_script${COLOR_RESET}"
        return 0
    else
        return 1
    fi
}

# Export functions
export -f ensure_wrapper_script_dir
export -f generate_build_wrapper_script
export -f generate_dev_wrapper_script
export -f remove_wrapper_script
