#!/bin/bash

# Function to ensure directory exists with proper permissions
ensure_web_directory() {
    local path_key="$1"
    local permissions="777"
    local detected_user=$(detect_system_user)
    local detected_group=$(id -gn "$detected_user" 2>/dev/null || echo "$detected_user")
    local owner="${3:-${detected_user}:${detected_group}}"

    # Map to appropriate path using string key
    local actual_path=$(map_web_path "$path_key")

    # Create directory if it doesn't exist
    if [ ! -d "$actual_path" ]; then
        echo "Creating directory: $actual_path (mapped from key: $path_key)" >&2
        $USE_SUDO mkdir -p "$actual_path"
    fi

    # Set permissions
    $USE_SUDO chmod "$permissions" "$actual_path" 2>/dev/null || true

    # Set owner (only if not in WSL, Windows filesystem doesn't support chown)
    if [ "$IS_WSL" = false ]; then
        $USE_SUDO chown "$owner" "$actual_path" 2>/dev/null || true
    fi

    echo "$actual_path"
    return 0
}

# Initialize the global temporary directory base.
# It MUST be writable by the invoking (non-root) user, because scripts clone/build here
# as the user (then `make install` as root). Pitfalls this resolver defends against:
#   * /usr/tmp is a legacy SysV alias for /var/tmp absent on Debian/Ubuntu/Kali; worse,
#     an older revision of this file created it as root:root 0755 (unwritable), and a
#     long-running menu may still EXPORT that stale value onto child scripts.
#   * So a stale/unwritable INHERITED value must be SKIPPED, not preserved -- using
#     "${GLOBAL_TEMP_DIR:-...}" alone would keep the bad /usr/tmp.
# Resolution order (first that is a WRITABLE dir, or can be created writable, wins):
#   exported GLOBAL_TEMP_DIR, $TMPDIR, /var/tmp, /tmp. /var/tmp is preferred (persistent +
#   disk-backed -> good for large source builds, unlike RAM-backed /tmp).
__resolve_global_temp_dir_from_gvar_common() {
    local c
    for c in "${GLOBAL_TEMP_DIR:-}" "${TMPDIR:-}" /var/tmp /tmp; do
        [ -z "$c" ] && continue
        c="${c%/}"
        if { [ -d "$c" ] || mkdir -p "$c" 2>/dev/null; } && [ -w "$c" ]; then
            echo "$c"; return 0
        fi
    done
    echo /tmp
}
GLOBAL_TEMP_DIR="$(__resolve_global_temp_dir_from_gvar_common)"
unset -f __resolve_global_temp_dir_from_gvar_common

# Ensure global temporary directory exists. Only create/chmod when MISSING -- never
# chmod an existing system temp dir, which would clobber its 1777 sticky permissions.
if [ ! -d "$GLOBAL_TEMP_DIR" ]; then
    echo "Creating global temporary directory: $GLOBAL_TEMP_DIR"
    mkdir -p "$GLOBAL_TEMP_DIR" 2>/dev/null || $USE_SUDO mkdir -p "$GLOBAL_TEMP_DIR"
    chmod 1777 "$GLOBAL_TEMP_DIR" 2>/dev/null || $USE_SUDO chmod 1777 "$GLOBAL_TEMP_DIR" 2>/dev/null || true
fi

# Function to create script-specific temporary directory (restricted to $GLOBAL_TEMP_DIR/<script_name>)
create_script_temp_dir() {
    local script_name="$1"
    local target_user=""
    local target_group=""
    # Restrict to GLOBAL_TEMP_DIR and prevent path traversal
    case "$script_name" in
        */*|*..*) echo "[ERROR] create_script_temp_dir: invalid script_name (no / or ..): $script_name" >&2; return 1 ;;
    esac
    [ -z "$script_name" ] && echo "[ERROR] create_script_temp_dir: empty script_name" >&2 && return 1
    local script_temp_dir="$GLOBAL_TEMP_DIR/$script_name"
    # Ensure result is strictly under the configured GLOBAL_TEMP_DIR
    case "$script_temp_dir" in
        "$GLOBAL_TEMP_DIR"/*) ;;
        *) echo "[ERROR] create_script_temp_dir: path not under $GLOBAL_TEMP_DIR: $script_temp_dir" >&2; return 1 ;;
    esac

    if [ ! -d "$script_temp_dir" ]; then
        $USE_SUDO mkdir -p "$script_temp_dir"
    fi
    target_user="$(detect_system_user)"
    target_group="$(id -gn "$target_user" 2>/dev/null || echo "$target_user")"
    $USE_SUDO chown -R "$target_user:$target_group" "$script_temp_dir" 2>/dev/null || true
    $USE_SUDO chmod -R 777 "$script_temp_dir" 2>/dev/null || true

    echo "$script_temp_dir"
    return 0
}

# Function to clean up script-specific temporary directory
cleanup_script_temp_dir() {
    local script_name="$1"
    local script_temp_dir="$GLOBAL_TEMP_DIR/$script_name"

    if [ -d "$script_temp_dir" ]; then
        echo "Cleaning up temporary directory: $script_temp_dir"
        $USE_SUDO rm -rf "$script_temp_dir"
    fi
}

# Converge only the two shared-state roots. Writers own the permissions of the
# files and subdirectories they create; recursively rewriting a multi-gigabyte
# data tree on every library source makes service startup state-dependent.
ensure_core_state_roots() {
    local state_dir=""
    local current_owner=""
    local current_mode=""

    CORE_PERMISSION_USER="$(detect_system_user)"
    CORE_PERMISSION_GROUP="$(id -gn "$CORE_PERMISSION_USER" 2>/dev/null || echo "$CORE_PERMISSION_USER")"
    for state_dir in "$CORE_NODE_DATA_DIR" "$GLOBAL_VAR_DIR"; do
        if [ ! -d "$state_dir" ]; then
            $USE_SUDO mkdir -p "$state_dir" 2>/dev/null || mkdir -p "$state_dir" 2>/dev/null || true
        fi
        if [ ! -d "$state_dir" ]; then
            echo "[ERROR] Shared state directory is unavailable: $state_dir" >&2
            continue
        fi
        current_owner="$(stat -c '%U:%G' "$state_dir" 2>/dev/null)"
        if [ "$current_owner" != "$CORE_PERMISSION_USER:$CORE_PERMISSION_GROUP" ]; then
            $USE_SUDO chown "$CORE_PERMISSION_USER:$CORE_PERMISSION_GROUP" "$state_dir" 2>/dev/null || true
        fi
        current_mode="$(stat -c '%a' "$state_dir" 2>/dev/null)"
        if [ "$current_mode" != "777" ]; then
            $USE_SUDO chmod 777 "$state_dir" 2>/dev/null || true
        fi
    done
}

ensure_core_state_roots

# Set IS_GLOBAL based on SELECTED_REGION
set_is_global() {
    local selected_region=$(get_global_var "SELECTED_REGION" "Global")
    if [ "$selected_region" = "Global" ]; then
        IS_GLOBAL="true"
    else
        IS_GLOBAL="false"
    fi
}

# Helper function to normalize key and get file path
_get_var_file_path() {
    local key="$1"
    # Convert key to uppercase and remove any special characters
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]_')
    echo "$GLOBAL_VAR_DIR/$key"
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
    local print="${3:-}"

    # Check if parameters are provided
    if [[ -z "$key" ]] || [[ -z "$val" ]]; then
        echo "Error: Both key and value must be provided"
        echo "Usage: set_global_var <key> <value>"
        return 1
    fi

    # Get normalized file path
    local file_path=$(_get_var_file_path "$key")

    # Read the previous value first so the "Successfully set" line is announced only
    # ONCE per value: the script chain re-initializes the same vars many times, and
    # re-setting the identical value must stay silent (no log flooding).
    local prev_val=""
    [ -f "$file_path" ] && prev_val="$($USE_SUDO cat "$file_path" 2>/dev/null || cat "$file_path" 2>/dev/null)"

    # Write value to file
    if echo "$val" | $USE_SUDO tee "$file_path" >/dev/null; then
        # Keep shared variable files aligned with the common mode-777 policy.
        $USE_SUDO chmod 777 "$file_path" 2>/dev/null || chmod 777 "$file_path" 2>/dev/null || true
        if [[ "$print" != "false" ]] && [ "$prev_val" != "$val" ]; then
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
    local default_value="$2"

    # Check if key is provided
    if [[ -z "$key" ]]; then
        echo "Error: Key must be provided"
        echo "Usage: get_global_var <key> [default_value]"
        return 1
    fi

    # Get normalized file path
    local file_path=$(_get_var_file_path "$key")

    # Check if file exists
    if [[ ! -f "$file_path" ]]; then
        # Return default value if provided, otherwise return empty string
        echo "${default_value:-}"
        return 0
    fi

    # Read and return the value
    local val=$($USE_SUDO cat "$file_path" 2>/dev/null)
    if [[ $? -eq 0 ]]; then
        echo "$val"
        return 0
    else
        # Return default value if read fails
        echo "${default_value:-}"
        return 0
    fi
}

# Alias for get_global_var for backward compatibility
get_var() {
    get_global_var "$@"
}

# Web-server plane (DESIGN_20260817_2115 PART_0): the single shared plane
# constant every plane-aware script resolves through these helpers - never
# parsed from another script's state. Default plane = frankenphp (single
# octane:frankenphp process with the built-in Mercure hub on 443/h3).
web_server_plane() {
    local plane=""
    # Single source: the [W] selector key START_WEB_SERVER (mutex constant).
    # WEB_SERVER_PLANE stays as a synchronized mirror for older readers.
    plane="$(get_global_var START_WEB_SERVER "")"
    if [ -z "$plane" ]; then
        plane="$(get_global_var WEB_SERVER_PLANE 'frankenphp')"
    fi
    case "$plane" in
        nginx) echo "nginx" ;;
        *) echo "frankenphp" ;;
    esac
}

# PHP runtime plane derived from the shared web-server selector unless an
# explicit runtime owner is stored. Plane selection is global state, so it
# belongs beside web_server_plane rather than in a service manager.
php_runtime_plane() {
    local runtime=""

    runtime="$(get_global_var PHP_RUNTIME_PLANE '')"
    if [ -n "$runtime" ]; then
        case "$runtime" in
            system) echo "system" ;;
            *) echo "frankenphp" ;;
        esac
        return 0
    fi
    if [ "$(web_server_plane)" = "nginx" ]; then
        echo "system"
    else
        echo "frankenphp"
    fi
}

set_php_runtime_plane() {
    local runtime=""

    runtime="$1"
    case "$runtime" in
        frankenphp|system) set_global_var PHP_RUNTIME_PLANE "$runtime" 'false' ;;
        *) echo "Error: runtime must be frankenphp or system" >&2 ;;
    esac
}

set_web_server_plane() {
    local plane="$1"
    case "$plane" in
        frankenphp|nginx)
            # Keep the selector key and the mirrored plane key in sync -
            # readers must never see them diverge.
            set_global_var START_WEB_SERVER "$plane" 'false'
            set_global_var WEB_SERVER_PLANE "$plane" 'false'
            ;;
        *) echo "Error: plane must be frankenphp or nginx" >&2 ;;
    esac
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
        # Get normalized file path
        local file_path=$(_get_var_file_path "$key")

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

# Alias for set_global_var for backward compatibility
set_var() {
    set_global_var "$@"
}

# Function to set a variable both in global_var and /etc/environment
set_env_and_var() {
    local key="$1"
    local val="$2"
    set_var "$key" "$val"

    # Ensure /etc/environment contains the variable
    if grep -q "^${key}=" /etc/environment 2>/dev/null; then
        $USE_SUDO sed -i "s|^${key}=.*|${key}=\"${val}\"|g" /etc/environment 2>/dev/null || true
    else
        echo "${key}=\"${val}\"" | $USE_SUDO tee -a /etc/environment >/dev/null 2>&1 || true
    fi
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo bash -c "source /etc/environment" 2>/dev/null || true
    else
        source /etc/environment 2>/dev/null || true
    fi
}

# Set Puppeteer skip download globally by default.
# gvar_common.sh is re-sourced many times across the script chain (every script, often
# several times each via common_functions.sh / apt_repository_manager.sh), which used to
# print "Successfully set global variable: PUPPETEER_SKIP_DOWNLOAD -> true" on every
# source. The value is file-backed and persists for the whole chain, so we announce it
# only ONCE (first establishment) and stay silent on every later re-source/re-init,
# while still ensuring it is exported in the current shell.
if [ "$(get_global_var "PUPPETEER_SKIP_DOWNLOAD" "" 2>/dev/null)" = "true" ]; then
    export PUPPETEER_SKIP_DOWNLOAD="true"
else
    set_env_and_var "PUPPETEER_SKIP_DOWNLOAD" "true"
fi

# Git SSH related URLs - Auto-switch based on region
SELECTED_REGION=$(get_global_var "SELECTED_REGION" "Global" 2>/dev/null || echo "Global")

if [[ "$SELECTED_REGION" == "China" ]]; then
    GIT_SSH_BASE_URL="https://gitee.com/accountbelongstox/core_node/raw/main"
else
    GIT_SSH_BASE_URL="https://raw.githubusercontent.com/accountbelongstox/core_node/main"
fi

GIT_SSH_PUB_URL="$GIT_SSH_BASE_URL/scripts/git/git.ssh.id.ed.pub.js"
GIT_SSH_KEY_URL="$GIT_SSH_BASE_URL/scripts/git/git.ssh.id.ed.js"

# SSH directory configuration
# Always use user's .ssh directory for Git SSH keys
# This ensures Git can find the keys regardless of user privileges
SSH_DIR="$HOME/.ssh"
if [[ "$EUID" -eq 0 ]]; then
    SSH_INSTALLED_FLAG="$GLOBAL_VAR_DIR/SSH_KEYS_INSTALLED_ROOT"
else
    SSH_INSTALLED_FLAG="$GLOBAL_VAR_DIR/SSH_KEYS_INSTALLED_USER"
fi

# Export SSH related variables
export GIT_SSH_BASE_URL
export GIT_SSH_PUB_URL
export GIT_SSH_KEY_URL
export SSH_DIR
export SSH_INSTALLED_FLAG

# Export the GLOBAL_VAR_DIR and GLOBAL_TEMP_DIR
export GLOBAL_VAR_DIR
export GLOBAL_TEMP_DIR
export COMPILE_DIR

# Initialize batch decryption flag
BATCH_DECRYPTION_COMPLETED=false

