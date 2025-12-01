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

    echo ""
    echo -e "\033[36m========================================"
    echo -e "Missing Decrypted Secret Files Detected"
    echo -e "========================================\033[0m"
    echo -e "\033[37mFound ${#pending_files[@]} encrypted files without decrypted copies:\033[0m"
    echo -e "\033[37m  Encrypted dir: $encrypted_dir\033[0m"
    echo -e "\033[37m  Raw dir: $raw_dir\033[0m"
    echo ""
    echo -e "\033[33mMissing files:\033[0m"

    # List encrypted files that need decryption
    for enc_file in "${pending_files[@]}"; do
        local display_name="$(basename "$enc_file")"
        echo -e "\033[31m  - $display_name\033[0m"
    done
    echo ""

    # Ask user if they want to decrypt (like Windows version)
    read -r -p "Would you like to decrypt all secrets now? (yes/no): " decrypt_choice

    if [[ ! "$decrypt_choice" =~ ^[Yy](es)?$ ]]; then
        echo -e "\033[33mSkipping decryption. You can decrypt secrets later via the menu.\033[0m"
        echo ""
        read -p "Press Enter to continue..."
        return 0
    fi

    echo ""
    echo -e "\033[36mStarting batch decryption...\033[0m"
    echo ""

    # First, try to use NODE_BIN from gvar_common (absolute path)
    if [ -n "$NODE_BIN" ] && [ -x "$NODE_BIN" ]; then
        node_cmd="$NODE_BIN"
        echo -e "\033[36m[SECRETS] Using Node.js from: $node_cmd\033[0m"
    else
        # Try to find node in PATH
        if command -v node >/dev/null 2>&1; then
            node_cmd="node"
            echo -e "\033[36m[SECRETS] Using Node.js from PATH: $(command -v node)\033[0m"
        elif command -v nodejs >/dev/null 2>&1; then
            node_cmd="nodejs"
            echo -e "\033[36m[SECRETS] Using Node.js from PATH: $(command -v nodejs)\033[0m"
        else
            # Node.js not found - provide installation instructions
            echo -e "\033[31m[SECRETS] Node.js not found!\033[0m"
            echo -e "\033[33m[SECRETS] Node.js is required to decrypt secret files.\033[0m"
            echo ""
            echo -e "\033[36m[SECRETS] To install Node.js, run:\033[0m"

            # Get the install script path (trust-based)
            local install_script="$CORE_NODE_ROOT_DIR/scripts/shells/linux/debian/install_shells/14_install_node_24.sh"
            echo -e "\033[32m  bash $install_script\033[0m"

            echo ""
            echo -e "\033[36m[SECRETS] After installing Node.js, please run this script again.\033[0m"
            echo ""
            read -p "Press Enter to continue..."
            return 1
        fi
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
        echo -e "\033[36m[SECRETS] Decrypting: $file_name\033[0m"

        # Call: node encrypted_file.js pwd PASSWORD OUTPUT_DIR
        "$node_cmd" "$enc_file" pwd "$password" "$raw_dir"

        if [ $? -eq 0 ]; then
            ((success_count++))
            echo -e "\033[32m[SECRETS]   SUCCESS\033[0m"
        else
            echo -e "\033[31m[SECRETS]   FAILED\033[0m"
        fi
    done

    password=""

    echo ""
    echo -e "\033[36m========================================"
    echo -e "Decryption Summary:"
    echo -e "========================================\033[0m"
    echo -e "\033[36m  Total files: ${#pending_files[@]}\033[0m"
    echo -e "\033[32m  Successful:  $success_count\033[0m"
    echo -e "\033[31m  Failed:      $((${#pending_files[@]} - success_count))\033[0m"
    echo -e "\033[36m========================================\033[0m"
    echo ""

    if [ $success_count -eq ${#pending_files[@]} ]; then
        echo -e "\033[32mSecrets decrypted successfully!\033[0m"
    else
        echo -e "\033[33mSome secrets failed to decrypt. You can retry later.\033[0m"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

clear_and_redecrypt_secrets() {
    local secret_root="$CORE_NODE_ROOT_DIR/.secret_keys"
    local encrypted_dir="$secret_root/already_encrypted"
    local raw_dir="$secret_root/.secret_ignore"
    local file_count=0

    echo ""
    echo -e "\033[36m========================================"
    echo -e "Clear and Re-decrypt Secret Keys"
    echo -e "========================================\033[0m"

    if [ ! -d "$encrypted_dir" ]; then
        echo -e "\033[33m[INFO] No encrypted directory found at: $encrypted_dir\033[0m"
        echo ""
        read -p "Press Enter to continue..."
        return 0
    fi

    if [ ! -d "$raw_dir" ]; then
        echo -e "\033[33m[INFO] No decrypted directory found. Nothing to clear.\033[0m"
        echo ""
        read -p "Press Enter to continue..."
        return 0
    fi

    file_count=$(find "$raw_dir" -type f 2>/dev/null | wc -l)

    if [ "$file_count" -eq 0 ]; then
        echo -e "\033[33m[INFO] No decrypted files found in: $raw_dir\033[0m"
        echo -e "\033[36m[INFO] Proceeding to decrypt...\033[0m"
        echo ""
    else
        echo -e "\033[37mDecrypted files location: $raw_dir\033[0m"
        echo -e "\033[37mFound $file_count decrypted file(s)\033[0m"
        echo ""
        echo -e "\033[33m[WARNING] This will permanently delete all decrypted secret files!\033[0m"
        echo -e "\033[33m[WARNING] You will need to re-enter the password to decrypt them again.\033[0m"
        echo ""

        read -r -p "Are you sure you want to clear all decrypted files? (yes/no): " confirm_choice

        if [[ ! "$confirm_choice" =~ ^[Yy](es)?$ ]]; then
            echo -e "\033[32m[CANCELLED] Operation cancelled. No files were deleted.\033[0m"
            echo ""
            read -p "Press Enter to continue..."
            return 0
        fi

        echo ""
        echo -e "\033[36m[CLEARING] Removing all decrypted files...\033[0m"

        if rm -rf "$raw_dir"/* 2>/dev/null; then
            echo -e "\033[32m[SUCCESS] All decrypted files have been cleared\033[0m"
        else
            echo -e "\033[31m[ERROR] Failed to clear some files\033[0m"
            echo ""
            read -p "Press Enter to continue..."
            return 1
        fi
    fi

    echo ""
    echo -e "\033[36m[RE-DECRYPT] Starting re-decryption process...\033[0m"
    echo ""

    ensure_secret_keys_ready

    return $?
}
