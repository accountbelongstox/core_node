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
            return 0
        fi
    fi

    echo "$HOME/.core_node/.build_global_vars"
}

# Ensure variable directory exists
mcp_ensure_vars_dir() {
    local mcp_vars_dir="$(mcp_get_vars_dir)"

    if [[ ! -d "$mcp_vars_dir" ]]; then
        if ! mkdir -p "$mcp_vars_dir" 2>/dev/null; then
            echo "ERROR: Failed to create vars directory: $mcp_vars_dir" >&2
            return 1
        fi
    fi

    return 0
}

# Set variable (write to file)
mcp_set_var() {
    local mcp_key="$1"
    local mcp_value="$2"

    if [[ -z "$mcp_key" ]]; then
        echo "ERROR: Variable key cannot be empty" >&2
        return 1
    fi

    if ! mcp_ensure_vars_dir; then
        return 1
    fi

    local mcp_vars_dir="$(mcp_get_vars_dir)"
    local mcp_var_file="$mcp_vars_dir/$mcp_key"

    if ! echo -n "$mcp_value" > "$mcp_var_file" 2>/dev/null; then
        echo "ERROR: Failed to write variable '$mcp_key'" >&2
        return 1
    fi

    return 0
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

    if [[ -z "$mcp_key" ]]; then
        echo "ERROR: Variable key cannot be empty" >&2
        return 1
    fi

    local mcp_vars_dir="$(mcp_get_vars_dir)"
    local mcp_var_file="$mcp_vars_dir/$mcp_key"

    if [[ -f "$mcp_var_file" ]]; then
        if ! rm -f "$mcp_var_file" 2>/dev/null; then
            echo "WARNING: Failed to delete variable '$mcp_key'" >&2
            return 1
        fi
    fi

    return 0
}

# Clear all variables
mcp_clear_all_vars() {
    local mcp_vars_dir="$(mcp_get_vars_dir)"

    if [[ ! -d "$mcp_vars_dir" ]]; then
        return 0
    fi

    find "$mcp_vars_dir" -maxdepth 1 -type f -exec rm -f {} \; 2>/dev/null || true

    return 0
}

# Check if variable exists
mcp_test_var() {
    local mcp_key="$1"

    if [[ -z "$mcp_key" ]]; then
        return 1
    fi

    local mcp_vars_dir="$(mcp_get_vars_dir)"
    local mcp_var_file="$mcp_vars_dir/$mcp_key"

    [[ -f "$mcp_var_file" ]]
}

# List all variables (as key-value pairs)
mcp_list_all_vars() {
    local mcp_vars_dir="$(mcp_get_vars_dir)"

    if [[ ! -d "$mcp_vars_dir" ]]; then
        return 0
    fi

    for mcp_var_file in "$mcp_vars_dir"/*; do
        if [[ -f "$mcp_var_file" ]]; then
            local mcp_key="$(basename "$mcp_var_file")"
            local mcp_value="$(cat "$mcp_var_file" 2>/dev/null || echo "")"
            echo "$mcp_key=$mcp_value"
        fi
    done
}
