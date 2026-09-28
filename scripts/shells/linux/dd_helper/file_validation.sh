#!/bin/bash

# =============================================================================
# File Validation Functions
# =============================================================================

# File Validation Functions
is_file_valid() {
    local file_path="$1"

    if [ ! -r "$file_path" ]; then
        echo "[WARNING] File is not readable: $file_path"
        return 1
    fi

    if [ ! -s "$file_path" ]; then
        echo "[WARNING] File is empty: $file_path"
        return 1
    fi

    local first_line=$(head -n 1 "$file_path" 2>/dev/null)
    if [[ ! "$first_line" =~ ^#! ]]; then
        echo "[WARNING] File does not start with shebang: $file_path"
        return 1
    fi

    return 0
}
