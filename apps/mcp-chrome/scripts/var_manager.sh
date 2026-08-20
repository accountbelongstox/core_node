#!/bin/bash
# var_manager.sh
# Bash variable management library
# Handles reading and writing file variables

# Get variable storage directory
# Mirrors pycore system_paths.get_system_cache_dir (single source of truth):
# shared /var/_core_node when creatable and writable, else per-user ~/.core_node.
mcp_get_vars_dir() {
    local mcp_shared_dir="/var/_core_node"

    if [[ -d "$mcp_shared_dir" ]] || mkdir -p "$mcp_shared_dir" 2>/dev/null; then
        if [[ -w "$mcp_shared_dir" ]]; then
            echo "$mcp_shared_dir/.build_global_vars"
            return
        fi
    fi

    echo "$HOME/.core_node/.build_global_vars"
}

# Ensure variable directory exists
mcp_ensure_vars_dir() {
    local mcp_vars_dir=""

    mcp_vars_dir="$(mcp_get_vars_dir)"

    if [[ ! -d "$mcp_vars_dir" ]]; then
        mkdir -p "$mcp_vars_dir"
    fi
}

# Set variable (write to file)
mcp_set_var() {
    local mcp_key="$1"
    local mcp_value="$2"

    local mcp_vars_dir=""
    local mcp_var_file=""

    if [[ -z "$mcp_key" ]]; then
        echo "ERROR: Variable key cannot be empty" >&2
        return
    fi

    mcp_ensure_vars_dir
    mcp_vars_dir="$(mcp_get_vars_dir)"
    mcp_var_file="$mcp_vars_dir/$mcp_key"
    printf '%s' "$mcp_value" > "$mcp_var_file"
}

# Get variable (read from file)
mcp_get_var() {
    # Extremely simple - just use head -c to read all bytes
    local _mcp_file="$(mcp_get_vars_dir)/$1"
    if [ -f "$_mcp_file" ]; then
        head -c 99999 "$_mcp_file" 2>/dev/null
    else
        printf '%s' "${2:-}"
    fi
}

# Remove variable (delete file)
mcp_remove_var() {
    local mcp_key="$1"

    local mcp_vars_dir=""
    local mcp_var_file=""

    if [[ -z "$mcp_key" ]]; then
        echo "ERROR: Variable key cannot be empty" >&2
        return
    fi

    mcp_vars_dir="$(mcp_get_vars_dir)"
    mcp_var_file="$mcp_vars_dir/$mcp_key"

    if [[ -f "$mcp_var_file" ]]; then
        rm -f "$mcp_var_file"
    fi
}

# Clear all variables
mcp_clear_all_vars() {
    local mcp_vars_dir="$(mcp_get_vars_dir)"

    if [[ ! -d "$mcp_vars_dir" ]]; then
        return
    fi

    find "$mcp_vars_dir" -maxdepth 1 -type f -exec rm -f {} \; 2>/dev/null || true

}

# Check if variable exists
mcp_test_var() {
    local mcp_key="$1"
    local mcp_vars_dir=""
    local mcp_var_file=""

    if [[ -z "$mcp_key" ]]; then
        printf 'false'
        return
    fi

    mcp_vars_dir="$(mcp_get_vars_dir)"
    mcp_var_file="$mcp_vars_dir/$mcp_key"

    if [[ -f "$mcp_var_file" ]]; then
        printf 'true'
    else
        printf 'false'
    fi
}

# List all variables (as key-value pairs)
mcp_list_all_vars() {
    local mcp_vars_dir="$(mcp_get_vars_dir)"

    if [[ ! -d "$mcp_vars_dir" ]]; then
        return
    fi

    for mcp_var_file in "$mcp_vars_dir"/*; do
        if [[ -f "$mcp_var_file" ]]; then
            local mcp_key="$(basename "$mcp_var_file")"
            local mcp_value="$(cat "$mcp_var_file" 2>/dev/null || echo "")"
            echo "$mcp_key=$mcp_value"
        fi
    done
}
