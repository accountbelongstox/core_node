#!/usr/bin/env bash

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of functions.
# 6. For Shell (*.sh) scripts: Always use absolute paths, avoid relative paths like "../".
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

#=============================================================================
# Secret Manager Library
#
# This library provides centralized encryption/decryption management for
# secret keys stored in the core_node project.
#
# Directory Structure:
#   .secret_keys/
#     already_encrypted/  - Encrypted files (*.js)
#     .secret_ignore/     - Decrypted raw files (gitignored)
#
# Dependencies:
#   - Node.js (for running disguise.js encryption/decryption tool)
#   - gvar_common.sh (for get_core_node_dir function)
#
# Main Functions:
#   1. secret_decrypt_all    - Decrypt all encrypted files to specified directory
#   2. secret_encrypt_all    - Encrypt all files from source to already_encrypted
#   3. secret_get_key        - Get single key value (auto-decrypt if needed)
#   4. secret_get_all_keys   - Get all keys as associative array
#=============================================================================

BATCH_DECRYPTION_COMPLETED=false

# Source gvar_common.sh for get_core_node_dir function if not already loaded
if ! type get_core_node_dir &>/dev/null; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    source "$SCRIPT_DIR/../linux/common/gvar_common.sh"
fi

#=============================================================================
# Helper function: Get secret directories
#=============================================================================
_secret_get_directories() {
    local core_node_dir=$(get_core_node_dir)

    echo "CORE_NODE_DIR=$core_node_dir"
    echo "SCRIPTS_DIR=$core_node_dir/scripts"
    echo "SECRET_KEYS_DIR=$core_node_dir/.secret_keys"
    echo "ENCRYPTED_DIR=$core_node_dir/.secret_keys/already_encrypted"
    echo "RAW_DIR=$core_node_dir/.secret_keys/.secret_ignore"
}

#=============================================================================
# Helper function: Find disguise.js tool
#=============================================================================
_secret_find_disguise_tool() {
    local scripts_dir="$1"

    if [ -d "$scripts_dir" ]; then
        local disguise_js=$(find "$scripts_dir" -name "disguise.js" -type f 2>/dev/null | head -n 1)
        echo "$disguise_js"
    fi
}

#=============================================================================
# Helper function: Read password with visual feedback
#=============================================================================
# Modes: "asterisk" (show *), "visible" (show plaintext), "silent" (no feedback)
_secret_read_password() {
    local prompt="${1:-Enter password: }"
    local mode="${2:-asterisk}"
    local password=""
    local char=""

    echo -n "$prompt" >&2

    if [ "$mode" = "visible" ]; then
        # Visible mode: show plaintext
        read password
        echo "$password"
        return 0
    elif [ "$mode" = "silent" ]; then
        # Silent mode: traditional behavior
        read -s password
        echo "" >&2
        echo "$password"
        return 0
    fi

    # Asterisk mode: show * for each character
    stty -echo 2>/dev/null
    while IFS= read -r -n1 char; do
        if [[ $char == $'\0' ]]; then
            break
        fi
        if [[ $char == $'\177' ]] || [[ $char == $'\b' ]]; then
            # Backspace
            if [ ${#password} -gt 0 ]; then
                password="${password%?}"
                echo -ne "\b \b" >&2
            fi
        elif [[ $char == $'\n' ]] || [[ $char == $'\r' ]]; then
            # Enter key
            break
        else
            password+="$char"
            echo -n "*" >&2
        fi
    done
    stty echo 2>/dev/null
    echo "" >&2
    echo "$password"
}

#=============================================================================
# Function 1: Decrypt all encrypted files
#=============================================================================
secret_decrypt_all() {
    local output_dir="$1"
    local password="$2"

    eval $(_secret_get_directories)

    if [ -z "$output_dir" ]; then
        output_dir="$RAW_DIR"
    fi

    if [ ! -d "$output_dir" ]; then
        mkdir -p "$output_dir" || {
            echo "[SECRET_DECRYPT_ALL] ERROR: Failed to create output directory: $output_dir" >&2
            return 1
        }
    fi

    if [ ! -d "$ENCRYPTED_DIR" ]; then
        echo "[SECRET_DECRYPT_ALL] ERROR: Encrypted directory not found: $ENCRYPTED_DIR" >&2
        return 1
    fi

    local encrypted_files=()
    # Find both .js and .JS files (case-insensitive)
    while IFS= read -r -d '' enc_file; do
        encrypted_files+=("$enc_file")
    done < <(find "$ENCRYPTED_DIR" \( -name "*.js" -o -name "*.JS" \) -type f -print0 2>/dev/null)

    if [ ${#encrypted_files[@]} -eq 0 ]; then
        echo "[SECRET_DECRYPT_ALL] No encrypted files found in: $ENCRYPTED_DIR" >&2
        echo "[SECRET_DECRYPT_ALL] Checked for both .js and .JS extensions" >&2
        return 0
    fi

    echo "[SECRET_DECRYPT_ALL] Found ${#encrypted_files[@]} encrypted files" >&2

    local disguise_js=$(_secret_find_disguise_tool "$SCRIPTS_DIR")
    if [ -z "$disguise_js" ] || [ ! -f "$disguise_js" ]; then
        echo "[SECRET_DECRYPT_ALL] ERROR: disguise.js not found in: $SCRIPTS_DIR" >&2
        return 1
    fi
    echo "[SECRET_DECRYPT_ALL] Using decryption tool: $disguise_js" >&2

    if [ -z "$password" ]; then
        password=$(_secret_read_password "[SECRET_DECRYPT_ALL] Enter decryption password: " "asterisk")
    fi

    if [ -z "$password" ]; then
        echo "[SECRET_DECRYPT_ALL] ERROR: Password is required" >&2
        return 1
    fi

    local success_count=0
    local fail_count=0
    for encrypted_file in "${encrypted_files[@]}"; do
        local file_name=$(basename "$encrypted_file")
        # Remove extension (.js or .JS)
        local key_name="${file_name%.js}"
        key_name="${key_name%.JS}"
        echo "[SECRET_DECRYPT_ALL] Decrypting: $file_name" >&2
        echo "[SECRET_DECRYPT_ALL]   Executing: node \"$encrypted_file\" pwd \"********\" \"$output_dir\"" >&2

        # Count files before decryption
        local files_before=$(find "$output_dir" -maxdepth 1 -type f 2>/dev/null | wc -l)

        # Run decryption
        local result
        result=$(node "$encrypted_file" pwd "$password" "$output_dir" 2>&1)

        # Count files after decryption
        local files_after=$(find "$output_dir" -maxdepth 1 -type f 2>/dev/null | wc -l)

        # Check if new files were created and have content
        if [ "$files_after" -gt "$files_before" ]; then
            # Find the newly created file(s)
            local new_files=()
            while IFS= read -r -d '' file; do
                new_files+=("$file")
            done < <(find "$output_dir" -maxdepth 1 -type f -newer "$encrypted_file" -print0 2>/dev/null)

            # If no files found with -newer, just check if any files have content
            if [ ${#new_files[@]} -eq 0 ]; then
                while IFS= read -r -d '' file; do
                    local content=$(cat "$file" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
                    if [ -n "$content" ]; then
                        new_files+=("$file")
                        break
                    fi
                done < <(find "$output_dir" -maxdepth 1 -type f -print0 2>/dev/null)
            fi

            if [ ${#new_files[@]} -gt 0 ]; then
                local decrypted_name=$(basename "${new_files[0]}")
                echo "[SECRET_DECRYPT_ALL]   SUCCESS: $file_name -> $decrypted_name" >&2
                ((success_count++))
            else
                echo "[SECRET_DECRYPT_ALL]   FAILED: $file_name (no valid content)" >&2
                echo "[SECRET_DECRYPT_ALL]   Node output: $result" >&2
                ((fail_count++))
            fi
        else
            echo "[SECRET_DECRYPT_ALL]   FAILED: $file_name (no file created)" >&2
            echo "[SECRET_DECRYPT_ALL]   Node output: $result" >&2
            ((fail_count++))
        fi
    done

    echo "" >&2
    echo "[SECRET_DECRYPT_ALL] ========================================" >&2
    echo "[SECRET_DECRYPT_ALL] Decryption Summary:" >&2
    echo "[SECRET_DECRYPT_ALL]   Total files: ${#encrypted_files[@]}" >&2
    echo "[SECRET_DECRYPT_ALL]   Successful:  $success_count" >&2
    echo "[SECRET_DECRYPT_ALL]   Failed:      $fail_count" >&2
    echo "[SECRET_DECRYPT_ALL]   Output dir:  $output_dir" >&2
    echo "[SECRET_DECRYPT_ALL] ========================================" >&2

    password=""
    if [ $fail_count -gt 0 ]; then
        return 1
    fi
    return 0
}

#=============================================================================
# Function 2: Encrypt all files to already_encrypted
#=============================================================================
secret_encrypt_all() {
    local source_dir="$1"
    local password="$2"

    if [ -z "$source_dir" ]; then
        echo "[SECRET_ENCRYPT_ALL] ERROR: Source directory parameter is required" >&2
        echo "[SECRET_ENCRYPT_ALL] Usage: secret_encrypt_all <source_dir> [password]" >&2
        return 1
    fi
    if [ ! -d "$source_dir" ]; then
        echo "[SECRET_ENCRYPT_ALL] ERROR: Source directory not found: $source_dir" >&2
        return 1
    fi

    eval $(_secret_get_directories)

    if [ ! -d "$ENCRYPTED_DIR" ]; then
        mkdir -p "$ENCRYPTED_DIR" || {
            echo "[SECRET_ENCRYPT_ALL] ERROR: Failed to create encrypted directory: $ENCRYPTED_DIR" >&2
            return 1
        }
    fi

    local disguise_js=$(_secret_find_disguise_tool "$SCRIPTS_DIR")
    if [ -z "$disguise_js" ] || [ ! -f "$disguise_js" ]; then
        echo "[SECRET_ENCRYPT_ALL] ERROR: disguise.js not found in: $SCRIPTS_DIR" >&2
        return 1
    fi
    echo "[SECRET_ENCRYPT_ALL] Using encryption tool: $disguise_js" >&2

    local source_files=()
    while IFS= read -r -d '' src_file; do
        local filename=$(basename "$src_file")
        if [[ "$filename" != .* ]]; then
            source_files+=("$src_file")
        fi
    done < <(find "$source_dir" -maxdepth 1 -type f -print0 2>/dev/null)

    if [ ${#source_files[@]} -eq 0 ]; then
        echo "[SECRET_ENCRYPT_ALL] No files found in: $source_dir" >&2
        return 0
    fi
    echo "[SECRET_ENCRYPT_ALL] Found ${#source_files[@]} files to encrypt" >&2

    if [ -z "$password" ]; then
        echo -n "[SECRET_ENCRYPT_ALL] Enter encryption password: " >&2
        read -s password
        echo "" >&2
        echo -n "[SECRET_ENCRYPT_ALL] Confirm password: " >&2
        read -s password_confirm
        echo "" >&2
        if [ "$password" != "$password_confirm" ]; then
            echo "[SECRET_ENCRYPT_ALL] ERROR: Passwords do not match" >&2
            return 1
        fi
    fi
    if [ -z "$password" ]; then
        echo "[SECRET_ENCRYPT_ALL] ERROR: Password is required" >&2
        return 1
    fi

    local success_count=0
    local fail_count=0
    for source_file in "${source_files[@]}"; do
        local key_name=$(basename "$source_file")
        local output_file="$ENCRYPTED_DIR/$key_name.js"
        echo "[SECRET_ENCRYPT_ALL] Encrypting: $key_name -> $key_name.js" >&2
        local content=$(cat "$source_file" 2>&1)
        if [ $? -ne 0 ]; then
            echo "[SECRET_ENCRYPT_ALL]   FAILED: Cannot read $key_name" >&2
            ((fail_count++))
            continue
        fi
        local result
        result=$(node "$disguise_js" "$key_name" "$password" "$content" "$ENCRYPTED_DIR" 2>&1)
        local exit_code=$?
        if [ $exit_code -eq 0 ] && [ -f "$output_file" ]; then
            echo "[SECRET_ENCRYPT_ALL]   SUCCESS: $key_name.js" >&2
            ((success_count++))
        else
            echo "[SECRET_ENCRYPT_ALL]   FAILED: $key_name" >&2
            echo "[SECRET_ENCRYPT_ALL]   Error: $result" >&2
            ((fail_count++))
        fi
    done

    echo "" >&2
    echo "[SECRET_ENCRYPT_ALL] ========================================" >&2
    echo "[SECRET_ENCRYPT_ALL] Encryption Summary:" >&2
    echo "[SECRET_ENCRYPT_ALL]   Total files: ${#source_files[@]}" >&2
    echo "[SECRET_ENCRYPT_ALL]   Successful:  $success_count" >&2
    echo "[SECRET_ENCRYPT_ALL]   Failed:      $fail_count" >&2
    echo "[SECRET_ENCRYPT_ALL]   Output dir:  $ENCRYPTED_DIR" >&2
    echo "[SECRET_ENCRYPT_ALL] ========================================" >&2

    password=""
    password_confirm=""
    if [ $fail_count -gt 0 ]; then
        return 1
    fi
    return 0
}

#=============================================================================
# Function 3: Get single secret key value (with server-aware logic)
#=============================================================================
secret_get_key() {
    local key_name="$1"
    local password="$2"

    if [ -z "$key_name" ]; then
        echo "[SECRET_GET_KEY] ERROR: key_name parameter is required" >&2
        return 1
    fi

    eval $(_secret_get_directories)
    local raw_file="$RAW_DIR/$key_name"
    local encrypted_file="$ENCRYPTED_DIR/$key_name.js"

    # Check for case-insensitive file extension (.js or .JS)
    if [ ! -f "$encrypted_file" ]; then
        local encrypted_file_upper="$ENCRYPTED_DIR/$key_name.JS"
        if [ -f "$encrypted_file_upper" ]; then
            encrypted_file="$encrypted_file_upper"
            echo "[SECRET_GET_KEY] Found encrypted file with uppercase extension: $encrypted_file" >&2
        else
            echo "[SECRET_GET_KEY] ERROR: Key not found: $key_name" >&2
            echo "[SECRET_GET_KEY] Encrypted file missing: $encrypted_file" >&2
            echo "[SECRET_GET_KEY] Also checked: $encrypted_file_upper" >&2
            return 1
        fi
    fi

    # Server environment: always decrypt on-demand, never cache
    if [ "$IS_PRODUCTION" = true ]; then
        # Remove .secret_ignore directory on servers to prevent caching
        if [ -d "$RAW_DIR" ]; then
            echo "[SECRET_GET_KEY] Server environment detected - clearing .secret_ignore" >&2
            echo "[SECRET_GET_KEY] Reason: Security policy requires on-demand decryption without disk caching" >&2
            rm -rf "$RAW_DIR" 2>/dev/null
        fi

        # Create temporary directory for this single decryption
        local temp_output_dir=$(mktemp -d)
        local temp_raw_file="$temp_output_dir/$key_name"

        # Prompt for password if not provided
        if [ -z "$password" ]; then
            password=$(_secret_read_password "[SECRET_GET_KEY] Enter password for $key_name: " "asterisk")
        fi

        if [ -z "$password" ]; then
            echo "[SECRET_GET_KEY] ERROR: Password is required" >&2
            rm -rf "$temp_output_dir"
            return 1
        fi

        # Display decryption command (hide password)
        echo "[SECRET_GET_KEY] Executing: node \"$encrypted_file\" pwd \"********\" \"$temp_output_dir\"" >&2

        # Check if node is available
        if ! command -v node &>/dev/null; then
            echo "[SECRET_GET_KEY] ERROR: node command not found" >&2
            rm -rf "$temp_output_dir"
            return 1
        fi

        # Decrypt to temporary directory
        local result
        result=$(node "$encrypted_file" pwd "$password" "$temp_output_dir" 2>&1)

        # Don't check exit code - directly look for any decrypted file in temp directory
        local decrypted_files=()
        while IFS= read -r -d '' file; do
            decrypted_files+=("$file")
        done < <(find "$temp_output_dir" -maxdepth 1 -type f -print0 2>/dev/null)

        # Check if any file was created
        if [ ${#decrypted_files[@]} -eq 0 ]; then
            echo "[SECRET_GET_KEY] ERROR: No decrypted file created in: $temp_output_dir" >&2
            echo "[SECRET_GET_KEY] Node output: $result" >&2
            rm -rf "$temp_output_dir"
            return 1
        fi

        # Use the first decrypted file found
        local decrypted_file="${decrypted_files[0]}"
        echo "[SECRET_GET_KEY] Found decrypted file: $(basename "$decrypted_file")" >&2

        # Read decrypted content
        local content=$(cat "$decrypted_file" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        rm -rf "$temp_output_dir"

        if [ -n "$content" ]; then
            echo "$content"
            return 0
        fi

        echo "[SECRET_GET_KEY] ERROR: Decrypted file is empty: $(basename "$decrypted_file")" >&2
        return 1
    fi

    # Desktop/WSL environment: use cached file if available
    if [ -f "$raw_file" ]; then
        local content=$(cat "$raw_file" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        if [ -n "$content" ]; then
            echo "$content"
            return 0
        fi
    fi

    # If .secret_ignore is empty, trigger batch decryption once
    if [ "$BATCH_DECRYPTION_COMPLETED" = false ]; then
        echo "[SECRET_GET_KEY] Raw file not found, triggering batch decryption..." >&2
        if secret_decrypt_all "$RAW_DIR" "$password"; then
            BATCH_DECRYPTION_COMPLETED=true
        else
            echo "[SECRET_GET_KEY] WARNING: Batch decryption failed or incomplete" >&2
        fi
    fi

    # Try to read from decrypted file
    if [ -f "$raw_file" ]; then
        local content=$(cat "$raw_file" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        if [ -n "$content" ]; then
            echo "$content"
            return 0
        fi
    fi

    echo "[SECRET_GET_KEY] ERROR: Failed to retrieve key: $key_name" >&2
    return 1
}

#=============================================================================
# Function 4: Get all secret keys as associative array
#=============================================================================
secret_get_all_keys() {
    local array_name="$1"
    if [ -z "$array_name" ]; then
        echo "[SECRET_GET_ALL_KEYS] ERROR: array_name parameter is required" >&2
        echo "[SECRET_GET_ALL_KEYS] Usage: declare -A secrets; secret_get_all_keys secrets" >&2
        return 1
    fi
    if [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
        echo "[SECRET_GET_ALL_KEYS] ERROR: Bash 4.0+ required for associative arrays" >&2
        return 1
    fi
    eval $(_secret_get_directories)
    if [ ! -d "$RAW_DIR" ]; then
        mkdir -p "$RAW_DIR"
    fi
    local raw_file_count=$(find "$RAW_DIR" -maxdepth 1 -type f 2>/dev/null | wc -l)
    if [ "$raw_file_count" -eq 0 ] && [ "$BATCH_DECRYPTION_COMPLETED" = false ]; then
        echo "[SECRET_GET_ALL_KEYS] No decrypted files found, triggering batch decryption..." >&2
        if secret_decrypt_all "$RAW_DIR"; then
            BATCH_DECRYPTION_COMPLETED=true
        else
            echo "[SECRET_GET_ALL_KEYS] WARNING: Batch decryption failed or incomplete" >&2
        fi
    fi
    local key_count=0
    while IFS= read -r -d '' raw_file; do
        local key_name=$(basename "$raw_file")
        local content=$(cat "$raw_file" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        if [ -n "$content" ]; then
            eval "$array_name['$key_name']='$content'"
            ((key_count++))
        fi
    done < <(find "$RAW_DIR" -maxdepth 1 -type f -print0 2>/dev/null)
    echo "[SECRET_GET_ALL_KEYS] Loaded $key_count secret keys into array: $array_name" >&2
    return 0
}

export -f secret_decrypt_all
export -f secret_encrypt_all
export -f secret_get_key
export -f secret_get_all_keys
export -f _secret_get_directories
export -f _secret_find_disguise_tool
export -f _secret_read_password

echo "[SECRET_MANAGER] Library loaded successfully" >&2

