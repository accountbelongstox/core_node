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

# Repo root: caller may set CORE_NODE_ROOT_DIR before sourcing; otherwise resolve from this file location.
_DD_HELPER_SECRETS_DIR=""
if [ -z "${CORE_NODE_ROOT_DIR:-}" ]; then
    _DD_HELPER_SECRETS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    CORE_NODE_ROOT_DIR="$(cd "$_DD_HELPER_SECRETS_DIR/../../../.." && pwd)"
fi

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
    local batch_encrypted_dir="$secret_root/already_batch_encrypted"
    local raw_dir="$secret_root/.secret_ignore"
    local disguise_js="$CORE_NODE_ROOT_DIR/scripts/disguise.js"
    local node_cmd=""
    local password=""
    local password_confirm=""
    local success_count=0
    local -a pending_files=()
    local -a files_need_reencrypt=()
    local base_name=""
    local raw_file=""
    local output=""
    local file_name=""
    local enc_file=""
    local use_batch_mode=""
    local bundle_file=""

    if [ ! -d "$encrypted_dir" ] && [ ! -d "$batch_encrypted_dir" ]; then
        return 0
    fi

    # Clean up expired secret cache entries
    cleanup_secret_cache

    if [ ! -d "$raw_dir" ]; then
        if ! mkdir -p "$raw_dir" 2>/dev/null; then
            echo -e "\033[31m[SECRETS] Failed to create decrypted secrets directory: $raw_dir\033[0m"
            return 1
        fi
    fi

    # Check for encrypted files with content changes (before checking missing files)
    if [ -d "$encrypted_dir" ]; then
        if get_encrypted_files_needing_redecryption "$encrypted_dir" "$raw_dir"; then
            # Some encrypted files were updated and user chose to re-decrypt
            # The function already removed outdated raw files
            echo -e "\033[36m[CACHE UPDATE] Starting re-decryption after content changes...\033[0m"
            # Continue with normal decryption flow to decrypt the removed files
        fi
    fi

    local has_batch_bundle=false
    if [ -d "$batch_encrypted_dir" ]; then
        local bundle_count=$(find "$batch_encrypted_dir" -type f -name '*.js' 2>/dev/null | wc -l)
        if [ "$bundle_count" -gt 0 ]; then
            has_batch_bundle=true
            bundle_file=$(find "$batch_encrypted_dir" -type f -name '*.js' 2>/dev/null | head -n 1)
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

    if [ ${#pending_files[@]} -eq 0 ] && [ "$has_batch_bundle" = false ]; then
        return 0
    fi

    local bundle_needs_decrypt=false
    if [ "$has_batch_bundle" = true ]; then
        if ! "$node_cmd" "$bundle_file" show 2>/dev/null | grep -q "Password hint:"; then
            if command -v node >/dev/null 2>&1; then
                node_cmd="node"
            elif command -v nodejs >/dev/null 2>&1; then
                node_cmd="nodejs"
            fi
        fi

        local bundle_file_count=0
        if [ -n "$node_cmd" ]; then
            bundle_file_count=$(node -e "
                const fs = require('fs');
                const content = fs.readFileSync('$bundle_file', 'utf8');
                const match = content.match(/const TOTAL_COUNT = (\d+);/);
                console.log(match ? match[1] : '0');
            " 2>/dev/null || echo "0")
        fi

        local raw_file_count=$(find "$raw_dir" -type f 2>/dev/null | wc -l)

        if [ "$bundle_file_count" -gt 0 ] && [ "$raw_file_count" -lt "$bundle_file_count" ]; then
            bundle_needs_decrypt=true
        fi
    fi

    if [ ${#pending_files[@]} -eq 0 ] && [ "$bundle_needs_decrypt" = false ]; then
        # No files need decryption, skip to encryption check
        true
    else
        # Files need decryption, proceed with decryption phase

    if [ "$has_batch_bundle" = true ] && [ ${#pending_files[@]} -gt 0 ]; then
        echo ""
        echo -e "\033[36m========================================"
        echo -e "Encryption Mode Selection"
        echo -e "========================================\033[0m"
        echo -e "\033[37mDetected both encryption formats:\033[0m"
        echo -e "\033[32m  [1] Batch mode (Bundle) - Fast, single process (~0.1s)\033[0m"
        echo -e "\033[37m      Bundle file: $(basename "$bundle_file")\033[0m"
        echo -e "\033[33m  [2] Individual mode (Original) - Slower, multiple processes (~2-3s)\033[0m"
        echo -e "\033[37m      Individual files: ${#pending_files[@]} files in already_encrypted/\033[0m"
        echo ""
        read -r -p "Choose decryption mode (1 or 2): " mode_choice
        echo ""

        case "$mode_choice" in
            1)
                use_batch_mode="yes"
                ;;
            2)
                use_batch_mode="no"
                ;;
            *)
                echo -e "\033[33mInvalid choice. Defaulting to batch mode.\033[0m"
                use_batch_mode="yes"
                ;;
        esac
    elif [ "$has_batch_bundle" = true ]; then
        use_batch_mode="yes"
    else
        use_batch_mode="no"
    fi

    echo ""
    echo -e "\033[36m========================================"
    echo -e "Missing Decrypted Secret Files Detected"
    echo -e "========================================\033[0m"

    if [ "$use_batch_mode" = "yes" ]; then
        echo -e "\033[37mDecryption mode: Batch (Bundle) - Fast mode\033[0m"
        echo -e "\033[37m  Bundle file: $(basename "$bundle_file")\033[0m"
        echo -e "\033[37m  Output dir: $raw_dir\033[0m"
    else
        echo -e "\033[37mDecryption mode: Individual (Original) - Compatible mode\033[0m"
        echo -e "\033[37mFound ${#pending_files[@]} encrypted files without decrypted copies:\033[0m"
        echo -e "\033[37m  Encrypted dir: $encrypted_dir\033[0m"
        echo -e "\033[37m  Raw dir: $raw_dir\033[0m"
        echo ""
        echo -e "\033[33mMissing files:\033[0m"

        for enc_file in "${pending_files[@]}"; do
            local display_name="$(basename "$enc_file")"
            echo -e "\033[31m  - $display_name\033[0m"
        done
    fi
    echo ""

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
            local install_script="$CORE_NODE_ROOT_DIR/scripts/shells/linux/debian/install_shells/17_install_node_24.sh"
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

    if [ "$use_batch_mode" = "yes" ]; then
        echo ""
        echo -e "\033[36m[BATCH MODE] Using bundle file for fast decryption...\033[0m"
        echo -e "\033[36m[BATCH MODE] Bundle: $(basename "$bundle_file")\033[0m"
        echo ""

        "$node_cmd" "$bundle_file" pwd "$password" "$raw_dir"

        if [ $? -eq 0 ]; then
            echo ""
            echo -e "\033[32m[BATCH MODE] All secrets decrypted successfully!\033[0m"

            # Set decryption timestamp cache and encrypted content hash cache for all decrypted files
            if [ -d "$raw_dir" ]; then
                while IFS= read -r -d '' raw_file; do
                    local base_name_for_cache="$(basename "$raw_file")"
                    set_decryption_timestamp_cache "$base_name_for_cache"
                    # Keep raw mtime in sync with its per-file encrypted counterpart so the
                    # timestamp-based encryption check does not falsely flag freshly decrypted files.
                    local sync_enc_file="$encrypted_dir/$base_name_for_cache.js"
                    if [ -f "$sync_enc_file" ]; then
                        touch -r "$sync_enc_file" "$raw_file" 2>/dev/null || true
                    fi
                done < <(find "$raw_dir" -type f -print0 2>/dev/null)
            fi

            # Cache bundle file hash
            if [ -s "$bundle_file" ]; then
                local bundle_base_name="$(basename "$bundle_file")"
                bundle_base_name="${bundle_base_name%.js}"
                bundle_base_name="${bundle_base_name%.JS}"
                set_encrypted_content_hash_cache "$bundle_base_name" "$bundle_file"
            fi

            echo ""
            read -p "Press Enter to continue..."
            return 0
        else
            echo ""
            echo -e "\033[31m[BATCH MODE] Batch decryption failed!\033[0m"
            echo -e "\033[33m[BATCH MODE] Possible reasons:\033[0m"
            echo -e "\033[33m  - Wrong password\033[0m"
            echo -e "\033[33m  - Bundle file corrupted\033[0m"
            echo ""
            read -p "Press Enter to continue..."
            return 1
        fi
    fi

    echo ""
    echo -e "\033[36m[INDIVIDUAL MODE] Decrypting files one by one...\033[0m"
    echo ""

    for enc_file in "${pending_files[@]}"; do
        file_name="$(basename "$enc_file")"
        echo -e "\033[36m[SECRETS] Decrypting: $file_name\033[0m"

        "$node_cmd" "$enc_file" pwd "$password" "$raw_dir"

        if [ $? -eq 0 ]; then
            ((success_count++))
            echo -e "\033[32m[SECRETS]   SUCCESS\033[0m"
            # Set decryption timestamp cache and encrypted content hash cache
            local base_name_for_cache="$(basename "$enc_file")"
            base_name_for_cache="${base_name_for_cache%.js}"
            base_name_for_cache="${base_name_for_cache%.JS}"
            set_decryption_timestamp_cache "$base_name_for_cache"
            set_encrypted_content_hash_cache "$base_name_for_cache" "$enc_file"
            # Keep raw mtime in sync with its encrypted counterpart so the
            # timestamp-based encryption check does not falsely flag it.
            touch -r "$enc_file" "$raw_dir/$base_name_for_cache" 2>/dev/null || true
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
    fi  # End of decryption phase

    # =========================================================================
    # Step 2: Check for files that need re-encryption (timestamp comparison)
    # =========================================================================

    if [ ! -d "$raw_dir" ] || [ ! "$(ls -A "$raw_dir" 2>/dev/null)" ]; then
        return 0
    fi

    if [ ! -d "$encrypted_dir" ]; then
        mkdir -p "$encrypted_dir" 2>/dev/null || true
    fi

    # Check which files need (re-)encryption using a deterministic timestamp rule:
    # a raw file needs encryption when it has no encrypted counterpart, or when it
    # is newer than that counterpart. This does not depend on the secret cache.
    files_need_reencrypt=()
    while IFS= read -r -d '' raw_file; do
        base_name="$(basename "$raw_file")"
        enc_file="$encrypted_dir/$base_name.js"

        if [ ! -f "$enc_file" ]; then
            # No encrypted file exists - needs encryption
            files_need_reencrypt+=("$base_name")
        elif [ "$raw_file" -nt "$enc_file" ]; then
            # Raw file is newer than its encrypted counterpart - needs re-encryption
            files_need_reencrypt+=("$base_name")
        fi
    done < <(find "$raw_dir" -type f -print0 2>/dev/null)

    if [ ${#files_need_reencrypt[@]} -eq 0 ]; then
        return 0
    fi

    echo ""
    echo -e "\033[36m========================================"
    echo -e "Files Need Re-encryption Detected"
    echo -e "========================================\033[0m"
    echo -e "\033[37mFound ${#files_need_reencrypt[@]} file(s) that need re-encryption:\033[0m"
    echo ""

    for base_name in "${files_need_reencrypt[@]}"; do
        echo -e "\033[33m  - $base_name\033[0m"
    done
    echo ""

    # Check if batch bundle exists
    has_batch_bundle=false
    if [ -d "$batch_encrypted_dir" ]; then
        bundle_file=$(find "$batch_encrypted_dir" -type f -name '*.js' 2>/dev/null | head -n 1)
        if [ -n "$bundle_file" ]; then
            has_batch_bundle=true
        fi
    fi

    if [ "$has_batch_bundle" = true ]; then
        echo -e "\033[37mEncryption mode options:\033[0m"
        echo -e "\033[32m  [1] Batch mode (Bundle) - Update/add to bundle\033[0m"
        echo -e "\033[37m      Bundle file: $(basename "$bundle_file")\033[0m"
        echo -e "\033[33m  [2] Individual mode (Original) - Update individual files\033[0m"
        echo -e "\033[37m      Output dir: $encrypted_dir\033[0m"
        echo ""
        read -r -p "Choose encryption mode (1 or 2): " mode_choice
        echo ""

        case "$mode_choice" in
            1) use_batch_mode="yes" ;;
            2) use_batch_mode="no" ;;
            *)
                echo -e "\033[33mInvalid choice. Defaulting to individual mode.\033[0m"
                use_batch_mode="no"
                ;;
        esac
    else
        use_batch_mode="no"
    fi

    read -r -p "Would you like to re-encrypt these files now? (yes/no): " encrypt_choice

    if [[ ! "$encrypt_choice" =~ ^[Yy](es)?$ ]]; then
        echo -e "\033[33mSkipping re-encryption. Files remain out of sync.\033[0m"
        echo ""
        read -p "Press Enter to continue..."
        return 0
    fi

    if command -v node >/dev/null 2>&1; then
        node_cmd="node"
    elif command -v nodejs >/dev/null 2>&1; then
        node_cmd="nodejs"
    else
        echo -e "\033[31m[RE-ENCRYPT] Node.js not found!\033[0m"
        return 1
    fi

    echo -e "\033[36m[RE-ENCRYPT] Password input is hidden and shows * for each character.\033[0m"
    password="$(read_secret_input "Please enter encryption password: ")"
    if [ $? -ne 0 ] || [ -z "$password" ]; then
        echo -e "\033[33m[RE-ENCRYPT] Unable to capture password. Skipping re-encryption.\033[0m"
        return 1
    fi

    password_confirm="$(read_secret_input "Please confirm password: ")"
    if [ $? -ne 0 ] || [ -z "$password_confirm" ] || [ "$password" != "$password_confirm" ]; then
        echo -e "\033[31m[RE-ENCRYPT] Passwords do not match. Skipping re-encryption.\033[0m"
        return 1
    fi

    echo ""
    echo -e "\033[36m[RE-ENCRYPT] Starting re-encryption...\033[0m"
    echo ""

    local encryption_tools="$CORE_NODE_ROOT_DIR/scripts/encryption_tools"
    success_count=0

    if [ "$use_batch_mode" = "yes" ]; then
        echo -e "\033[36m[BATCH MODE] Updating files in bundle...\033[0m"

        for base_name in "${files_need_reencrypt[@]}"; do
            raw_file="$raw_dir/$base_name"
            echo -e "\033[36m[BATCH MODE]   Processing: $base_name\033[0m"

            if "$node_cmd" "$encryption_tools/bundle_add_file.js" "$bundle_file" "$raw_file" "$password" --replace 2>&1 | grep -q "SUCCESS"; then
                ((success_count++))
                echo -e "\033[32m[BATCH MODE]     SUCCESS\033[0m"
            else
                echo -e "\033[31m[BATCH MODE]     FAILED\033[0m"
            fi
        done
    else
        echo -e "\033[36m[INDIVIDUAL MODE] Updating individual encrypted files...\033[0m"

        if [ ! -f "$disguise_js" ]; then
            echo -e "\033[31m[RE-ENCRYPT] Error: disguise.js not found at: $disguise_js\033[0m"
            return 1
        fi

        for base_name in "${files_need_reencrypt[@]}"; do
            raw_file="$raw_dir/$base_name"
            echo -e "\033[36m[INDIVIDUAL MODE]   Processing: $base_name\033[0m"

            local content=$(cat "$raw_file")
            if "$node_cmd" "$disguise_js" "$base_name" "$password" "$content" "$encrypted_dir" >/dev/null 2>&1; then
                ((success_count++))
                echo -e "\033[32m[INDIVIDUAL MODE]     SUCCESS\033[0m"
            else
                echo -e "\033[31m[INDIVIDUAL MODE]     FAILED\033[0m"
            fi
        done
    fi

    password=""

    echo ""
    echo -e "\033[36m========================================"
    echo -e "Re-encryption Summary:"
    echo -e "========================================\033[0m"
    echo -e "\033[36m  Total files: ${#files_need_reencrypt[@]}\033[0m"
    echo -e "\033[32m  Successful:  $success_count\033[0m"
    echo -e "\033[31m  Failed:      $((${#files_need_reencrypt[@]} - success_count))\033[0m"
    echo -e "\033[36m========================================\033[0m"
    echo ""

    if [ $success_count -eq ${#files_need_reencrypt[@]} ]; then
        echo -e "\033[32mAll files re-encrypted successfully!\033[0m"
    else
        echo -e "\033[33mSome files failed to re-encrypt.\033[0m"
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
