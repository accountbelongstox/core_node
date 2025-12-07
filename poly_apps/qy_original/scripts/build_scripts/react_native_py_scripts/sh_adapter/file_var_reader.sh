#!/bin/bash
# ============================================
# File Variable System Reader for Shell
# Reads variables written by Python FileVarSystem
# ============================================

# Global variables
GLOBAL_VAR_DIR="$HOME/.core_node/.global_vars"
NAMESPACE_VAR_DIR=""

# Initialize file variable system
initialize_file_var_system() {
    local namespace="$1"

    if [ -n "$namespace" ]; then
        NAMESPACE_VAR_DIR="$HOME/.core_node/namespaces/$namespace"
    else
        NAMESPACE_VAR_DIR=""
    fi
}

# Get global file variable
get_global_file_var() {
    local key="$1"
    local file_path="$GLOBAL_VAR_DIR/$key"

    if [ -f "$file_path" ]; then
        cat "$file_path"
    else
        echo ""
    fi
}

# Get namespaced file variable
get_namespaced_file_var() {
    local key="$1"

    if [ -z "$NAMESPACE_VAR_DIR" ]; then
        echo "[ERROR] Namespace not initialized" >&2
        return 1
    fi

    local file_path="$NAMESPACE_VAR_DIR/$key"

    if [ -f "$file_path" ]; then
        cat "$file_path"
    else
        echo ""
    fi
}

# Get menu selection (returns JSON)
get_menu_selection() {
    get_global_file_var "MENU_SELECTION"
}

# Parse JSON value (simple jq alternative using Python)
json_get() {
    local json="$1"
    local key="$2"

    echo "$json" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('$key', ''))"
}

# Parse nested JSON value
json_get_nested() {
    local json="$1"
    local key1="$2"
    local key2="$3"

    echo "$json" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('$key1', {}).get('$key2', ''))"
}
