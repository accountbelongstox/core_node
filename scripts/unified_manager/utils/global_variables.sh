#!/bin/bash
# Unified Global Variable Manager - Bash Implementation
# Centralized variable storage system for Linux/Unix
# Stores variables in: /var/_core_node/_build_global_vars/ or ~/.core_node/.build_global_vars
# Format: filename=key, file_content=value

# Variable declarations - all at top
GLOBAL_VARS_DIR=""
declare -A VARIABLE_KEYS
declare -A STATUS_VALUES

# Initialize variable keys (centralized definitions)
VARIABLE_KEYS=(
    [PLATFORM]="PLATFORM"
    [IS_WINDOWS]="IS_WINDOWS"
    [IS_LINUX]="IS_LINUX"
    [ROOT_DIR]="ROOT_DIR"
    [CACHE_DIR]="CACHE_DIR"
    [TEMP_DIR]="TEMP_DIR"

    [APP_COUNT]="APP_COUNT"
    [APPS_DATA]="APPS_DATA"

    [ENABLE_SYSTEMD]="ENABLE_SYSTEMD"
    [ENABLE_NGINX]="ENABLE_NGINX"
    [ENABLE_FIREWALL]="ENABLE_FIREWALL"
    [ENABLE_DOMAIN_PROXY]="ENABLE_DOMAIN_PROXY"

    [STATUS]="STATUS"
    [LAUNCH_COMMAND]="LAUNCH_COMMAND"

    [CURRENT_INDEX]="CURRENT_INDEX"
    [MAX_APP_NAME_WIDTH]="MAX_APP_NAME_WIDTH"
)

# Status Values
STATUS_VALUES=(
    [SCAN_COMPLETE]="scan_complete"
    [COMMAND_READY]="command_ready"
    [SELECTION_UPDATED]="selection_updated"
    [ERROR_INVALID_INDEX]="error_invalid_index"
    [ERROR_INVALID_SCRIPT]="error_invalid_script"
)

# Check if we have write permission to a directory
has_write_permission() {
    local directory="$1"

    if [[ ! -d "$directory" ]]; then
        mkdir -p "$directory" 2>/dev/null || return 1
    fi

    local test_file="$directory/.write_test"
    if touch "$test_file" 2>/dev/null; then
        rm -f "$test_file" 2>/dev/null
        return 0
    else
        return 1
    fi
}

# Initialize global variables directory
initialize_global_variables() {
    if [[ -n "$GLOBAL_VARS_DIR" ]]; then
        return 0
    fi

    # Try system-wide directory first (with more robust permission handling)
    local system_dir="/var/_core_node/_build_global_vars"
    local user_home="$HOME"
    local user_dir="$user_home/.core_node/.build_global_vars"

    # Try user directory first for better reliability
    if has_write_permission "$(dirname "$user_dir")"; then
        GLOBAL_VARS_DIR="$user_dir"
        if ! mkdir -p "$GLOBAL_VARS_DIR" 2>/dev/null; then
            echo "Error: Cannot create variables directory: $GLOBAL_VARS_DIR" >&2
            return 1
        fi
        chmod 755 "$GLOBAL_VARS_DIR" 2>/dev/null
    elif has_write_permission "$(dirname "$system_dir")"; then
        GLOBAL_VARS_DIR="$system_dir"
        if ! mkdir -p "$GLOBAL_VARS_DIR" 2>/dev/null; then
            echo "Error: Cannot create variables directory: $GLOBAL_VARS_DIR" >&2
            return 1
        fi
        chmod 755 "$GLOBAL_VARS_DIR" 2>/dev/null
    else
        # Final fallback to temp directory
        local temp_dir="/tmp/.core_node_vars_${USER}_$$"
        GLOBAL_VARS_DIR="$temp_dir"
        if ! mkdir -p "$GLOBAL_VARS_DIR" 2>/dev/null; then
            echo "Error: Cannot create variables directory: $GLOBAL_VARS_DIR" >&2
            return 1
        fi
        chmod 700 "$GLOBAL_VARS_DIR" 2>/dev/null
    fi

    return 0
}

# Write a variable to global storage
write_global_var() {
    local key="$1"
    local value="$2"

    if [[ -z "$key" ]]; then
        echo "Error: Variable key cannot be empty" >&2
        return 1
    fi

    if ! initialize_global_variables; then
        return 1
    fi

    local var_file="$GLOBAL_VARS_DIR/$key"

    # Convert boolean values to lowercase
    if [[ "$value" == "True" || "$value" == "False" ]]; then
        value="${value,,}"
    fi

    if ! echo "$value" > "$var_file" 2>/dev/null; then
        echo "Error: Cannot write variable $key" >&2
        return 1
    fi

    return 0
}

# Read a variable from global storage
read_global_var() {
    local key="$1"
    local default="$2"

    if [[ -z "$key" ]]; then
        echo "$default"
        return 0
    fi

    if ! initialize_global_variables; then
        echo "$default"
        return 0
    fi

    local var_file="$GLOBAL_VARS_DIR/$key"

    if [[ -f "$var_file" ]]; then
        local content
        if content=$(cat "$var_file" 2>/dev/null); then
            # Remove trailing whitespace
            content=$(echo "$content" | sed 's/[[:space:]]*$//')
            if [[ -n "$content" ]]; then
                echo "$content"
                return 0
            fi
        fi
    fi

    echo "$default"
    return 0
}

# Read a boolean variable from global storage
read_global_var_bool() {
    local key="$1"
    local default="$2"

    local value
    value=$(read_global_var "$key" "$default")
    value="${value,,}"

    if [[ "$value" == "true" || "$value" == "1" || "$value" == "yes" || "$value" == "on" ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# Read an integer variable from global storage
read_global_var_int() {
    local key="$1"
    local default="$2"

    local value
    value=$(read_global_var "$key" "$default")

    if [[ "$value" =~ ^[0-9]+$ ]]; then
        echo "$value"
    else
        echo "$default"
    fi
}

# Delete a variable from global storage
remove_global_var() {
    local key="$1"

    if [[ -z "$key" ]]; then
        return 1
    fi

    if ! initialize_global_variables; then
        return 1
    fi

    local var_file="$GLOBAL_VARS_DIR/$key"

    if [[ -f "$var_file" ]]; then
        if rm "$var_file" 2>/dev/null; then
            return 0
        fi
    fi

    return 1
}

# Clear all variables from global storage
clear_all_global_vars() {
    if ! initialize_global_variables; then
        echo "0"
        return 0
    fi

    local deleted_count=0
    local file

    for file in "$GLOBAL_VARS_DIR"/*; do
        if [[ -f "$file" ]]; then
            if rm "$file" 2>/dev/null; then
                ((deleted_count++))
            fi
        fi
    done

    echo "$deleted_count"
}

# List all variable keys in global storage
list_global_vars() {
    if ! initialize_global_variables; then
        return 0
    fi

    local file
    for file in "$GLOBAL_VARS_DIR"/*; do
        if [[ -f "$file" ]]; then
            basename "$file"
        fi
    done
}

# Get the variables directory path
get_global_vars_directory() {
    if ! initialize_global_variables; then
        return 1
    fi

    echo "$GLOBAL_VARS_DIR"
}

# Check if a variable exists in global storage
test_global_var() {
    local key="$1"

    if [[ -z "$key" ]]; then
        return 1
    fi

    if ! initialize_global_variables; then
        return 1
    fi

    local var_file="$GLOBAL_VARS_DIR/$key"

    [[ -f "$var_file" ]]
}

# Generate app-specific variable key
get_app_variable_key() {
    local index="$1"
    local property="$2"

    echo "APP_${index}_${property}"
}

# Convenience functions using standard variable keys

# Write status using standard key
write_global_status() {
    local status="$1"
    write_global_var "${VARIABLE_KEYS[STATUS]}" "$status"
}

# Read status using standard key
read_global_status() {
    read_global_var "${VARIABLE_KEYS[STATUS]}" ""
}

# Write app count using standard key
write_global_app_count() {
    local count="$1"
    write_global_var "${VARIABLE_KEYS[APP_COUNT]}" "$count"
}

# Read app count using standard key
read_global_app_count() {
    read_global_var_int "${VARIABLE_KEYS[APP_COUNT]}" "0"
}

# Write platform information using standard keys
write_global_platform_info() {
    local platform="$1"
    local is_windows="$2"
    local is_linux="$3"

    write_global_var "${VARIABLE_KEYS[PLATFORM]}" "$platform"
    write_global_var "${VARIABLE_KEYS[IS_WINDOWS]}" "$is_windows"
    write_global_var "${VARIABLE_KEYS[IS_LINUX]}" "$is_linux"
}

# Write application data using standard keys
write_global_app_data() {
    local index="$1"
    local name="$2"
    local path="$3"
    local type="$4"
    local framework="$5"
    local port="$6"
    local command="$7"
    local debug="$8"

    write_global_var "$(get_app_variable_key "$index" "NAME")" "$name"
    write_global_var "$(get_app_variable_key "$index" "PATH")" "$path"
    write_global_var "$(get_app_variable_key "$index" "TYPE")" "$type"
    write_global_var "$(get_app_variable_key "$index" "FRAMEWORK")" "$framework"
    write_global_var "$(get_app_variable_key "$index" "PORT")" "$port"
    write_global_var "$(get_app_variable_key "$index" "COMMAND")" "$command"
    write_global_var "$(get_app_variable_key "$index" "DEBUG")" "$debug"
}

# Read application data using standard keys
read_global_app_data() {
    local index="$1"

    echo "NAME=$(read_global_var "$(get_app_variable_key "$index" "NAME")" "")"
    echo "PATH=$(read_global_var "$(get_app_variable_key "$index" "PATH")" "")"
    echo "TYPE=$(read_global_var "$(get_app_variable_key "$index" "TYPE")" "")"
    echo "FRAMEWORK=$(read_global_var "$(get_app_variable_key "$index" "FRAMEWORK")" "")"
    echo "PORT=$(read_global_var "$(get_app_variable_key "$index" "PORT")" "")"
    echo "COMMAND=$(read_global_var "$(get_app_variable_key "$index" "COMMAND")" "")"
    echo "DEBUG=$(read_global_var "$(get_app_variable_key "$index" "DEBUG")" "")"
}

# Auto-initialize on source
initialize_global_variables