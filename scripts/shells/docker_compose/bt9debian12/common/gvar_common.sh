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

# Global variable directory
GLOBAL_VAR_DIR="/usr/core_node/global_var"

check_and_install_sudo() {
    if command -v sudo >/dev/null 2>&1; then
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
}
check_and_install_sudo
# Ensure the global variable directory exists
ensure_dir() {
    if [ ! -d "$GLOBAL_VAR_DIR" ]; then
        $USE_SUDO mkdir -p "$GLOBAL_VAR_DIR"
        echo "Created global variable directory: $GLOBAL_VAR_DIR"
    fi
}
# Function to set global variable
set_var() {
    local key="$1"
    local val="$2"
    local var_dir="/usr/core_node/global_var"

    # Convert key to uppercase
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]')

    # Ensure directory exists
    if [[ ! -d "$var_dir" ]]; then
        $USE_SUDO mkdir -p "$var_dir"
    fi

    # Write or update the value
    echo "$val" | sudo tee "$var_dir/$key" >/dev/null

    if [[ $? -eq 0 ]]; then
        echo "Global variable set: $key = $val"
    else
        echo "Error: Failed to set global variable $key"
        return 1
    fi
}

# Function to get global variable
get_var() {
    local key="$1"
    local var_dir="/usr/core_node/global_var"

    # Convert key to uppercase
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]')

    if [[ -f "$var_dir/$key" ]]; then
        cat "$var_dir/$key"
    fi
}

# Function to store path in global variables
store_path() {
    local name=$1
    local path=$2
    if [[ -n "$path" ]]; then
        set_var "${name}_path" "$path"
        echo "${name} path stored: $path"
    else
        echo "Warning: Could not find ${name} path"
    fi
}

# Function to set global variable in file
set_global_var() {
    local key="$1"
    local val="$2"
    local print="$3"

    # Check if parameters are provided
    if [[ -z "$key" ]] || [[ -z "$val" ]]; then
        echo "Error: Both key and value must be provided"
        echo "Usage: set_global_var <key> <value>"
        return 1
    fi

    # Ensure global var directory exists
    if [[ ! -d "$GLOBAL_VAR_DIR" ]]; then
        $USE_SUDO mkdir -p "$GLOBAL_VAR_DIR"
        if [[ $? -ne 0 ]]; then
            echo "Error: Failed to create directory $GLOBAL_VAR_DIR"
            return 1
        fi
    fi

    # Convert key to uppercase and remove any special characters
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]_')
    local file_path="$GLOBAL_VAR_DIR/$key"

    # Write value to file
    echo "$val" | $USE_SUDO tee "$file_path" >/dev/null
    if [[ $? -eq 0 ]]; then
        if [[ "$print" == "true" ]]; then
            echo "Successfully set global variable: $key -> $val"
        fi
        return 0
    else
        echo "Error: Failed to write to $file_path"
        return 1
    fi
}

# Function to get global variable from file
get_global_var() {
    local key="$1"

    # Check if key is provided
    if [[ -z "$key" ]]; then
        echo "Error: Key must be provided"
        echo "Usage: get_global_var <key>"
        return 1
    fi

    # Convert key to uppercase and remove any special characters
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]_')
    local file_path="$GLOBAL_VAR_DIR/$key"

    # Check if file exists
    if [[ ! -f "$file_path" ]]; then
        echo "Error: Global variable $key not found"
        return 1
    fi

    # Read and return the value
    local val=$($USE_SUDO cat "$file_path" 2>/dev/null)
    if [[ $? -eq 0 ]]; then
        echo "$val"
        return 0
    else
        echo "Error: Failed to read from $file_path"
        return 1
    fi
}

# Function to clear all global variables
clear_all_global_vars() {
    if [[ ! -d "$GLOBAL_VAR_DIR" ]]; then
        echo "Global variable directory does not exist"
        return 0
    fi

    # Remove all files in the directory
    $USE_SUDO rm -f "$GLOBAL_VAR_DIR"/*
    if [[ $? -eq 0 ]]; then
        echo "Successfully cleared all global variables"
        return 0
    else
        echo "Error: Failed to clear global variables"
        return 1
    fi
}

# Function to set multiple global variables with value 'true'
set_multiple_global_vars() {
    local keys=("$@")
    local success=true

    if [[ ${#keys[@]} -eq 0 ]]; then
        echo "Error: No keys provided"
        echo "Usage: set_multiple_global_vars key1 key2 key3 ..."
        return 1
    fi

    for key in "${keys[@]}"; do
        if ! set_global_var "$key" "true"; then
            echo "Failed to set key: $key"
            success=false
        fi
    done

    if [[ "$success" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to remove one or more global variables
remove_global_vars() {
    local keys=("$@")
    local success=true

    if [[ ${#keys[@]} -eq 0 ]]; then
        echo "Error: No keys provided"
        echo "Usage: remove_global_vars key1 key2 key3 ..."
        return 1
    fi

    for key in "${keys[@]}"; do
        # Convert key to uppercase and remove special characters
        key=$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]_')
        local file_path="$GLOBAL_VAR_DIR/$key"

        if [[ -f "$file_path" ]]; then
            $USE_SUDO rm -f "$file_path"
            if [[ $? -eq 0 ]]; then
                echo "Successfully removed global variable: $key"
            else
                echo "Failed to remove global variable: $key"
                success=false
            fi
        else
            echo "Global variable not found: $key"
        fi
    done

    if [[ "$success" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is Debian-based (includes both Debian and Ubuntu)
is_debian_based() {
    if [[ -f /etc/debian_version ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is Debian
is_debian() {
    if is_debian_based && [[ ! -f /etc/lsb-release ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is Ubuntu
is_ubuntu() {
    if [[ -f /etc/lsb-release ]] && grep -qi "ubuntu" /etc/lsb-release; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is CentOS/RHEL based
is_centos() {
    if [[ -f /etc/centos-release ]] || [[ -f /etc/redhat-release ]] ||
        ([[ -f /etc/os-release ]] && grep -qiE "centos|rhel|rocky|almalinux" /etc/os-release); then
        return 0
    else
        return 1
    fi
}

ensure_dir
# Export the GLOBAL_VAR_DIR
export GLOBAL_VAR_DIR
