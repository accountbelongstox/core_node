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

# =============================================================================
# Secret Functions for dd.sh
# =============================================================================

read_secret_input() {
    local prompt="$1"
    local password=""
    local char=""
    local old_stty=""
    local tty_device="/dev/tty"
    local stty_failed=false

    if [ ! -t 0 ] || [ ! -w "$tty_device" ]; then
        return 1
    fi

    if ! exec 3<> "$tty_device" 2>/dev/null; then
        return 1
    fi

    if ! old_stty=$(stty -g <&3 2>/dev/null); then
        stty_failed=true
    fi

    printf "%s" "$prompt" >&3

    if ! stty -echo <&3 2>/dev/null; then
        stty_failed=true
    fi
    while IFS= read -r -n1 char <&3; do
        if [ -z "$char" ]; then
            printf "\n" >&3
            break
        fi
        if [[ $char == $'\n' || $char == $'\r' ]]; then
            printf "\n" >&3
            break
        fi
        if [[ $char == $'\x7f' || $char == $'\b' ]]; then
            if [ -n "$password" ]; then
                password="${password%?}"
                printf "\b \b" >&3
            fi
        else
            password+="$char"
            printf "*" >&3
        fi
    done
    if [ "$stty_failed" = false ] && [ -n "$old_stty" ]; then
        stty "$old_stty" <&3 2>/dev/null
    else
        stty echo <&3 2>/dev/null
    fi
    exec 3>&- 3<&-

    echo "$password"
}

ensure_secret_keys_ready() {
    local secret_root="$CORE_NODE_ROOT_DIR/.secret_keys"
    local encrypted_dir="$secret_root/already_encrypted"
    local raw_dir="$secret_root/.secret_ignore"
    local node_cmd=""
    local password=""
    local password_confirm=""
    local success_count=0
    local -a pending_files=()
    local base_name=""
    local raw_file=""
    local output=""
    local file_name=""
    local enc_file=""

    if [ ! -d "$encrypted_dir" ]; then
        return 0
    fi

    if [ ! -d "$raw_dir" ]; then
        if ! mkdir -p "$raw_dir" 2>/dev/null; then
            echo -e "\033[31m[SECRETS] Failed to create decrypted secrets directory: $raw_dir\033[0m"
            return 1
        fi
    fi

    while IFS= read -r -d '' enc_file; do
        base_name="$(basename "$enc_file")"
        base_name="${base_name%.js}"
        base_name="${base_name%.JS}"
        raw_file="$raw_dir/$base_name"
        if [ ! -s "$raw_file" ]; then
            pending_files+=("$enc_file")
        fi
    done < <(find "$encrypted_dir" -type f \( -name '*.js' -o -name '*.JS' \) -print0 2>/dev/null)

    if [ ${#pending_files[@]} -eq 0 ]; then
        return 0
    fi

    echo -e "\033[36m[SECRETS] Detected ${#pending_files[@]} encrypted secret files without decrypted copies\033[0m"

    if command -v node >/dev/null 2>&1; then
        node_cmd="node"
    else
        if command -v nodejs >/dev/null 2>&1; then
            node_cmd="nodejs"
        else
            echo -e "\033[31m[SECRETS] Node.js not found. Install node to decrypt secret files.\033[0m"
            return 1
        fi
    fi

    if [ ! -t 0 ]; then
        echo -e "\033[33m[SECRETS] Skipping decryption (non-interactive session).\033[0m"
        return 1
    fi

    echo -e "\033[36m[SECRETS] Password input is hidden and shows * for each character.\033[0m"
    password="$(read_secret_input "Please enter password: ")"
    if [ $? -ne 0 ] || [ -z "$password" ]; then
        echo -e "\033[33m[SECRETS] Unable to capture password or empty password provided. Skipping decryption.\033[0m"
        return 1
    fi

    password_confirm="$(read_secret_input "Please confirm password: ")"
    if [ $? -ne 0 ] || [ -z "$password_confirm" ] || [ "$password" != "$password_confirm" ]; then
        echo -e "\033[31m[SECRETS] Passwords do not match or unable to capture. Skipping decryption.\033[0m"
        return 1
    fi

    for enc_file in "${pending_files[@]}"; do
        file_name="$(basename "$enc_file")"
        echo -e "\033[36m[SECRETS] Decrypting $file_name...\033[0m"
        output=$("$node_cmd" "$enc_file" pwd "$password" "$raw_dir" 2>&1)
        if [ $? -eq 0 ]; then
            ((success_count++))
            echo -e "\033[32m[SECRETS]   OK\033[0m"
        else
            echo -e "\033[33m[SECRETS]   Failed\033[0m"
            if [ -n "$output" ]; then
                echo -e "\033[33m[SECRETS]   $output\033[0m"
            fi
        fi
    done

    password=""

    if [ $success_count -eq ${#pending_files[@]} ]; then
        echo -e "\033[32m[SECRETS] All secret files decrypted successfully\033[0m"
    else
        echo -e "\033[33m[SECRETS] Decrypted $success_count/${#pending_files[@]} secret files\033[0m"
    fi
}
