#!/bin/bash

GLOBAL_VAR_DIR="/usr/script_global_var"

# Ensure the global variable directory exists
ensure_dir() {
    if [ ! -d "$GLOBAL_VAR_DIR" ]; then
        sudo mkdir -p "$GLOBAL_VAR_DIR"
        echo "Created global variable directory: $GLOBAL_VAR_DIR"
    fi
}

# Set or update a variable
set_var() {
    local var_name="$1"
    local var_value="$2"
    
    if [ -z "$var_name" ] || [ -z "$var_value" ]; then
        echo "Error: Both variable name and value are required"
        echo "Usage: set_var <var_name> <var_value>"
        return 1
    fi
    
    ensure_dir
    echo "$var_value" | sudo tee "$GLOBAL_VAR_DIR/$var_name" > /dev/null
    echo "Variable '$var_name' set to '$var_value'"
}

# Get a variable's value
get_var() {
    local var_name="$1"
    
    if [ -z "$var_name" ]; then
        echo "Error: Variable name is required"
        echo "Usage: get_var <var_name>"
        return 1
    fi
    
    if [ -f "$GLOBAL_VAR_DIR/$var_name" ]; then
        cat "$GLOBAL_VAR_DIR/$var_name"
    else
        echo "Variable '$var_name' not found"
        echo ""
        return 1
    fi
}

# List all variables
list_vars() {
    ensure_dir
    echo "Global Variables in $GLOBAL_VAR_DIR:"
    if [ -d "$GLOBAL_VAR_DIR" ] && [ "$(ls -A $GLOBAL_VAR_DIR 2>/dev/null)" ]; then
        for file in "$GLOBAL_VAR_DIR"/*; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                value=$(cat "$file")
                echo "$filename = $value"
            fi
        done
    else
        echo "No variables found"
    fi
}

# Delete a variable
delete_var() {
    local var_name="$1"
    
    if [ -z "$var_name" ]; then
        echo "Error: Variable name is required"
        echo "Usage: delete_var <var_name>"
        return 1
    fi
    
    if [ -f "$GLOBAL_VAR_DIR/$var_name" ]; then
        sudo rm -f "$GLOBAL_VAR_DIR/$var_name"
        echo "Variable '$var_name' deleted"
    else
        echo "Variable '$var_name' not found"
        return 1
    fi
}

# Main command handler
case "$1" in
    "set")
        set_var "$2" "$3"
        ;;
    "get")
        get_var "$2"
        ;;
    "list")
        list_vars
        ;;
    "delete")
        delete_var "$2"
        ;;
    *)
        echo "Usage: $0 <command> [arguments]"
        echo "Commands:"
        echo "  set <var_name> <var_value>  - Set or update a variable"
        echo "  get <var_name>              - Get a variable's value"
        echo "  list                        - List all variables"
        echo "  delete <var_name>           - Delete a variable"
        exit 1
        ;;
esac 