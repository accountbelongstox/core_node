#!/bin/bash

# Initialize skip encrypt cache
init_skip_encrypt_cache() {
    if [ ! -d "$SKIP_ENCRYPT_CACHE_DIR" ]; then
        $USE_SUDO mkdir -p "$SKIP_ENCRYPT_CACHE_DIR" 2>/dev/null || true
    fi
    if [ ! -f "$SKIP_ENCRYPT_CACHE_FILE" ]; then
        $USE_SUDO touch "$SKIP_ENCRYPT_CACHE_FILE" 2>/dev/null || true
    fi
}

# Check if file is in skip cache
is_file_in_skip_cache() {
    local file_path="$1"
    local file_mtime=$(stat -c %Y "$file_path" 2>/dev/null || stat -f %m "$file_path" 2>/dev/null)

    if [ ! -f "$SKIP_ENCRYPT_CACHE_FILE" ]; then
        return 1
    fi

    while IFS='|' read -r cached_path cached_mtime; do
        if [ "$cached_path" = "$file_path" ] && [ "$cached_mtime" = "$file_mtime" ]; then
            return 0
        fi
    done < "$SKIP_ENCRYPT_CACHE_FILE"

    return 1
}

# Add file to skip cache
add_file_to_skip_cache() {
    local file_path="$1"
    local file_mtime=$(stat -c %Y "$file_path" 2>/dev/null || stat -f %m "$file_path" 2>/dev/null)

    init_skip_encrypt_cache

    if is_file_in_skip_cache "$file_path"; then
        return 0
    fi

    echo "${file_path}|${file_mtime}" | $USE_SUDO tee -a "$SKIP_ENCRYPT_CACHE_FILE" > /dev/null
}

# Clean up outdated entries from skip cache
cleanup_skip_encrypt_cache() {
    if [ ! -f "$SKIP_ENCRYPT_CACHE_FILE" ]; then
        return
    fi

    local temp_file="${SKIP_ENCRYPT_CACHE_FILE}.tmp"
    $USE_SUDO touch "$temp_file"

    while IFS='|' read -r cached_path cached_mtime; do
        if [ -f "$cached_path" ]; then
            local current_mtime=$(stat -c %Y "$cached_path" 2>/dev/null || stat -f %m "$cached_path" 2>/dev/null)
            if [ "$current_mtime" = "$cached_mtime" ]; then
                echo "${cached_path}|${cached_mtime}" | $USE_SUDO tee -a "$temp_file" > /dev/null
            fi
        fi
    done < "$SKIP_ENCRYPT_CACHE_FILE"

    $USE_SUDO mv "$temp_file" "$SKIP_ENCRYPT_CACHE_FILE"
}

read_masked_password() {
    local prompt="$1"
    local password=""
    local char=""
    local old_stty="$(stty -g 2>/dev/null)"

    printf "%s" "$prompt"

    stty -echo 2>/dev/null
    while IFS= read -r -s -n1 char; do
        if [[ -z "$char" ]]; then
            printf "\n"
            break
        elif [[ $char == $'\n' || $char == $'\r' ]]; then
            printf "\n"
            break
        elif [[ $char == $'\177' || $char == $'\b' ]]; then
            if [ -n "$password" ]; then
                password="${password%?}"
                printf "\b \b"
            fi
        else
            password+="$char"
            printf "*"
        fi
    done

    stty "$old_stty" 2>/dev/null
    printf "%s" "$password"
}

# File validation function for win_common directory
test_win_common_files() {
    write_color_text "=== Validating win_common directory files ===" "Yellow"
    
    # Hardcoded list of files in win_common directory
    local required_files=(
        "ApplicationsList.ps1"
        "CommonFunc.ps1"
        "DesktopIconManager.ps1"
        "GlobalVars.ps1"
        "IconExtractor.ps1"
        "PackageManagerInvokes.ps1"
        "PostInstallCallbackProcessor.ps1"
        "SimpleIconExtractor.ps1"
        "StartupManager.ps1"
        "WindowsPathFunction.ps1"
        "WindowsServiceManager.ps1"
        "CommonFunc.7z.gz.js"
    )
    
    local missing_files=()
    local existing_files=()
    
    for file in "${required_files[@]}"; do
        local file_path="$WIN_COMMON_DIR/$file"
        if [ -f "$file_path" ]; then
            existing_files+=("$file")
            write_color_text "[OK] Found: $file" "Green"
        else
            missing_files+=("$file")
            write_color_text "[MISSING] Missing: $file" "Red"
        fi
    done
    
    echo ""
    write_color_text "Validation Summary:" "Cyan"
    write_color_text "  Existing files: ${#existing_files[@]}" "Green"
    write_color_text "  Missing files: ${#missing_files[@]}" "Red"
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        echo ""
        write_color_text "WARNING: The following files are missing from win_common directory:" "Red"
        for missing_file in "${missing_files[@]}"; do
            write_color_text "  - $missing_file" "Red"
        done
        echo ""
        write_color_text "Continuing with commit process despite missing files..." "Yellow"
    fi
    
    echo ""
    return $([ ${#missing_files[@]} -eq 0 ])
}

# Global variable management function
get_global_var() {
    local key="$1"
    local global_var_dir
    
    # Determine global variable directory (same logic as gvar_common.sh)
    if [ -d "/mnt/c/Users" ]; then
        # WSL environment
        for user_dir in /mnt/c/Users/*; do
            if [ -d "$user_dir/.core_node/global_var" ]; then
                global_var_dir="$user_dir/.core_node/global_var"
                break
            fi
        done
    fi
    
    # Fallback to default directory
    if [ -z "$global_var_dir" ]; then
        global_var_dir="/usr/core_node/global_var"
    fi
    
    local file_path="$global_var_dir/$key"
    if [ -f "$file_path" ]; then
        # Convert file to UTF-8 and remove any null bytes or invalid characters
        local value=$(iconv -f utf-8 -t utf-8 -c "$file_path" 2>/dev/null | tr -d '\0' | head -n 1)
        if [ -n "$value" ]; then
            echo "$value"
        fi
    fi
}

# Function to ensure SSH key permissions are correct
ensure_ssh_permissions() {
    # Get the home directory user from the SSH directory path
    local ssh_dir="$HOME/.ssh"
    local home_user=$(basename "$HOME")
    
    write_color_text "Detected home user: $home_user" "DarkGray" >&2
    
    # Check if SSH directory exists
    if [ ! -d "$ssh_dir" ]; then
        write_color_text "SSH directory does not exist: $ssh_dir" "Yellow" >&2
        return 0
    fi
    
    # Scan for SSH private keys in the directory
    local ssh_keys=()
    while IFS= read -r -d '' key_file; do
        ssh_keys+=("$key_file")
    done < <(find "$ssh_dir" -name "id_*" -type f ! -name "*.pub" -print0 2>/dev/null)
    
    if [ ${#ssh_keys[@]} -eq 0 ]; then
        write_color_text "No SSH private keys found in $ssh_dir" "Yellow" >&2
        return 0
    fi
    
    write_color_text "Found ${#ssh_keys[@]} SSH private key(s)" "DarkGray" >&2
    
    # Process each SSH key
    for ssh_key in "${ssh_keys[@]}"; do
        local key_name=$(basename "$ssh_key")
        write_color_text "Processing SSH key: $key_name" "Cyan" >&2
        
        # Check current ownership and permissions
        local current_owner=$(stat -c '%U' "$ssh_key" 2>/dev/null)
        local current_perms=$(stat -c '%a' "$ssh_key" 2>/dev/null)
        
        write_color_text "  Current owner: $current_owner, permissions: $current_perms" "DarkGray" >&2
        
        # Fix ownership if needed
        if [ "$current_owner" != "$home_user" ]; then
            write_color_text "  Fixing ownership from $current_owner to $home_user..." "Yellow" >&2
            if $USE_SUDO chown "$home_user:$home_user" "$ssh_key" 2>/dev/null; then
                write_color_text "  SSH key ownership fixed" "Green" >&2
            else
                write_color_text "  Failed to fix SSH key ownership" "Red" >&2
            fi
        else
            write_color_text "  Ownership is correct" "Green" >&2
        fi
        
        # Fix permissions if needed (should be 600)
        if [ "$current_perms" != "600" ]; then
            write_color_text "  Fixing permissions from $current_perms to 600..." "Yellow" >&2
            if chmod 600 "$ssh_key" 2>/dev/null; then
                write_color_text "  SSH key permissions fixed to 600" "Green" >&2
            else
                write_color_text "  Failed to fix SSH key permissions" "Red" >&2
            fi
        else
            write_color_text "  Permissions are correct" "Green" >&2
        fi
    done
    
    # Also fix SSH directory permissions (should be 700)
    local ssh_dir_perms=$(stat -c '%a' "$ssh_dir" 2>/dev/null)
    local ssh_dir_owner=$(stat -c '%U' "$ssh_dir" 2>/dev/null)
    
    write_color_text "SSH directory owner: $ssh_dir_owner, permissions: $ssh_dir_perms" "DarkGray" >&2
    
    if [ "$ssh_dir_owner" != "$home_user" ]; then
        write_color_text "Fixing SSH directory ownership..." "Yellow" >&2
        if $USE_SUDO chown "$home_user:$home_user" "$ssh_dir" 2>/dev/null; then
            write_color_text "SSH directory ownership fixed" "Green" >&2
        else
            write_color_text "Failed to fix SSH directory ownership" "Red" >&2
        fi
    fi
    
    if [ "$ssh_dir_perms" != "700" ]; then
        write_color_text "Fixing SSH directory permissions..." "Yellow" >&2
        if chmod 700 "$ssh_dir" 2>/dev/null; then
            write_color_text "SSH directory permissions fixed to 700" "Green" >&2
        else
            write_color_text "Failed to fix SSH directory permissions" "Red" >&2
        fi
    fi
}

# Function to ensure the correct SSH keys are installed for git push
# 1. Ensure openssh-client installed
# 2. If key exists, verify it works (ssh -T git@github.com)
# 3. If no key or key fails auth, decrypt project key from git.ssh.id.ed.js
# 4. Load into ssh-agent, fix permissions
ensure_ssh_keys_installed() {
    # Only run once per session
    if [ "$SSH_KEYS_CHECK_COMPLETED" = true ]; then
        return 0
    fi
    SSH_KEYS_CHECK_COMPLETED=true

    # Step 1: Ensure openssh-client is installed
    if ! command -v ssh >/dev/null 2>&1; then
        write_color_text "[SSH] openssh-client not found, installing..." "Yellow" >&2
        if command -v apt-get >/dev/null 2>&1; then
            $USE_SUDO apt-get update -qq >/dev/null 2>&1
            $USE_SUDO apt-get install -y -qq openssh-client >/dev/null 2>&1
        elif command -v yum >/dev/null 2>&1; then
            $USE_SUDO yum install -y -q openssh-clients >/dev/null 2>&1
        elif command -v apk >/dev/null 2>&1; then
            $USE_SUDO apk add openssh-client >/dev/null 2>&1
        fi
        if ! command -v ssh >/dev/null 2>&1; then
            write_color_text "[SSH] Failed to install openssh-client" "Red" >&2
            return 1
        fi
        write_color_text "[SSH] openssh-client installed" "Green" >&2
    fi

    # Step 2: Check if SSH private key exists and actually works
    local need_decrypt=true
    local found_key_path=""

    found_key_path=$(find "$HOME/.ssh" "/root/.ssh" "/etc/ssh/keys" -maxdepth 1 -name "id_*" -type f ! -name "*.pub" 2>/dev/null | head -n 1)

    if [ -n "$found_key_path" ] && [ -s "$found_key_path" ]; then
        write_color_text "[SSH] Key found: $found_key_path - verifying auth..." "DarkGray" >&2

        # Test if the existing key works against github.com
        local ssh_test_output=""
        ssh_test_output=$(ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no -T git@github.com 2>&1 || true)

        if echo "$ssh_test_output" | grep -qi "successfully authenticated\|Hi "; then
            write_color_text "[SSH] Key verified OK (GitHub auth success)" "Green" >&2
            need_decrypt=false
        elif echo "$ssh_test_output" | grep -qi "permission denied"; then
            write_color_text "[SSH] Key exists but GitHub rejected it - replacing with project key" "Yellow" >&2
            # Backup the old key before overwriting
            local backup_suffix="backup_$(date +%Y%m%d%H%M%S)"
            cp "$found_key_path" "${found_key_path}.${backup_suffix}" 2>/dev/null
            if [ -f "${found_key_path}.pub" ]; then
                cp "${found_key_path}.pub" "${found_key_path}.pub.${backup_suffix}" 2>/dev/null
            fi
            write_color_text "[SSH] Old key backed up as ${found_key_path}.${backup_suffix}" "DarkGray" >&2
        else
            # Network error or timeout - cannot verify, try decrypt anyway
            write_color_text "[SSH] Cannot verify key (network issue), will ensure project key" "Yellow" >&2
        fi
    else
        write_color_text "[SSH] No SSH key found" "Yellow" >&2
    fi

    # Step 3: Decrypt project SSH key if needed
    if [ "$need_decrypt" = true ]; then
        # Check encrypted JS files exist
        if [ ! -f "$LOCAL_SSH_PUB_JS" ] || [ ! -f "$LOCAL_SSH_KEY_JS" ]; then
            write_color_text "[SSH] Encrypted key files not found:" "Red" >&2
            write_color_text "[SSH]   $LOCAL_SSH_PUB_JS" "DarkGray" >&2
            write_color_text "[SSH]   $LOCAL_SSH_KEY_JS" "DarkGray" >&2
            return 1
        fi

        # Find Node.js
        local node_cmd=""
        if command -v node >/dev/null 2>&1; then
            node_cmd="node"
        elif command -v nodejs >/dev/null 2>&1; then
            node_cmd="nodejs"
        else
            write_color_text "[SSH] Node.js not found, cannot decrypt SSH keys" "Red" >&2
            return 1
        fi

        # Create SSH directory
        if [ ! -d "$SSH_DIR" ]; then
            mkdir -p "$SSH_DIR"
            chmod 700 "$SSH_DIR"
        fi

        # Show password hint from JS file
        local hint=""
        hint=$("$node_cmd" "$LOCAL_SSH_KEY_JS" show 2>&1 | grep -oP 'Password hint: \K.*' || true)
        if [ -n "$hint" ]; then
            write_color_text "[SSH] Password hint: $hint" "Cyan" >&2
        fi

        # Decryption password. Prefer an env var so the NON-INTERACTIVE (auto/cron) push
        # flow can decrypt the key too -- previously a no-TTY run just skipped, leaving
        # ~/.ssh empty and the push failing with "Permission denied (publickey)". Falls back
        # to an interactive prompt when a terminal is attached.
        local password="${GIT_SSH_DECRYPT_PASSWORD:-${SSH_KEY_PASSWORD:-${GIT_SSH_KEY_PASSWORD:-}}}"
        if [ -n "$password" ]; then
            write_color_text "[SSH] Using decryption password from environment" "DarkGray" >&2
        elif [ -t 0 ]; then
            printf "\033[36m[SSH] Enter decryption password: \033[0m" >&2
            IFS= read -r password
        else
            write_color_text "[SSH] No password available (set GIT_SSH_DECRYPT_PASSWORD for non-interactive runs); skipping SSH key decrypt" "Yellow" >&2
            return 1
        fi

        if [ -z "$password" ]; then
            write_color_text "[SSH] Empty password, skipping" "Yellow" >&2
            return 1
        fi
        # SECURITY: never log the password itself.

        # Decrypt public key (--force to overwrite existing file)
        local decrypt_output=""
        write_color_text "[SSH] Decrypting public key..." "DarkGray" >&2
        decrypt_output=$("$node_cmd" "$LOCAL_SSH_PUB_JS" pwd "$password" "$SSH_DIR" --force 2>&1)
        local pub_exit=$?
        if [ $pub_exit -ne 0 ] || echo "$decrypt_output" | grep -qi "error\|failed\|wrong\|invalid"; then
            write_color_text "[SSH] [ERROR] Public key decrypt FAILED (wrong password?)" "Red" >&2
            write_color_text "[SSH]   Output: $decrypt_output" "DarkGray" >&2
            password=""
            return 1
        fi
        write_color_text "[SSH] [OK] Public key decrypted" "Green" >&2

        # Decrypt private key (--force to overwrite existing file)
        write_color_text "[SSH] Decrypting private key..." "DarkGray" >&2
        decrypt_output=$("$node_cmd" "$LOCAL_SSH_KEY_JS" pwd "$password" "$SSH_DIR" --force 2>&1)
        local key_exit=$?
        if [ $key_exit -ne 0 ] || echo "$decrypt_output" | grep -qi "error\|failed\|wrong\|invalid"; then
            write_color_text "[SSH] [ERROR] Private key decrypt FAILED" "Red" >&2
            write_color_text "[SSH]   Output: $decrypt_output" "DarkGray" >&2
            password=""
            return 1
        fi
        write_color_text "[SSH] [OK] Private key decrypted" "Green" >&2

        password=""

        # Set permissions
        find "$SSH_DIR" -maxdepth 1 -name "id_*" -type f ! -name "*.pub" ! -name "*.backup_*" -exec chmod 600 {} \; 2>/dev/null
        find "$SSH_DIR" -maxdepth 1 -name "*.pub" -type f ! -name "*.backup_*" -exec chmod 644 {} \; 2>/dev/null

        # Verify key file was produced
        found_key_path=$(find "$SSH_DIR" -maxdepth 1 -name "id_*" -type f ! -name "*.pub" ! -name "*.backup_*" 2>/dev/null | head -n 1)
        if [ -n "$found_key_path" ] && [ -s "$found_key_path" ]; then
            write_color_text "[SSH] Project key installed: $found_key_path" "Green" >&2
            # Show key fingerprint for verification
            local fingerprint=""
            fingerprint=$(ssh-keygen -lf "$found_key_path" 2>/dev/null || true)
            if [ -n "$fingerprint" ]; then
                write_color_text "[SSH] Fingerprint: $fingerprint" "Cyan" >&2
            fi
        else
            write_color_text "[SSH] [ERROR] Decryption produced no key file" "Red" >&2
            return 1
        fi

        # Verify key works against GitHub
        write_color_text "[SSH] Testing key against github.com..." "DarkGray" >&2
        local verify_output=""
        verify_output=$(ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i "$found_key_path" -T git@github.com 2>&1 || true)
        if echo "$verify_output" | grep -qi "successfully authenticated\|Hi "; then
            write_color_text "[SSH] [OK] GitHub authentication SUCCESS" "Green" >&2
        elif echo "$verify_output" | grep -qi "permission denied"; then
            write_color_text "[SSH] [ERROR] GitHub authentication FAILED - key not recognized" "Red" >&2
            write_color_text "[SSH]   Response: $verify_output" "DarkGray" >&2
            write_color_text "[SSH]   The decrypted key may not match the key registered on GitHub" "Yellow" >&2
        else
            write_color_text "[SSH] ? GitHub auth test inconclusive (network issue?)" "Yellow" >&2
            write_color_text "[SSH]   Response: $verify_output" "DarkGray" >&2
        fi
    fi

    # Step 4: ssh-agent
    if [ -n "$found_key_path" ] && [ -s "$found_key_path" ]; then
        if [ -z "${SSH_AUTH_SOCK:-}" ]; then
            eval "$(ssh-agent -s)" >/dev/null 2>&1
            write_color_text "[SSH] ssh-agent started" "DarkGray" >&2
        fi

        # Remove all identities and re-add the correct key
        ssh-add -D >/dev/null 2>&1
        ssh-add "$found_key_path" 2>/dev/null
        if [ $? -eq 0 ]; then
            write_color_text "[SSH] Key loaded into ssh-agent" "DarkGray" >&2
        fi
    fi

    # Step 5: Fix permissions
    if [ -d "$SSH_DIR" ]; then
        chmod 700 "$SSH_DIR" 2>/dev/null
        if [ -f "$SSH_DIR/authorized_keys" ]; then
            chmod 600 "$SSH_DIR/authorized_keys" 2>/dev/null
        fi
        if [ -f "$SSH_DIR/config" ]; then
            chmod 600 "$SSH_DIR/config" 2>/dev/null
        fi
    fi

    # Step 6: If running as root, also install key to all logged-in non-root users
    if [ "$(id -u)" -eq 0 ] && [ -n "$found_key_path" ] && [ -s "$found_key_path" ]; then
        local key_basename=""
        key_basename=$(basename "$found_key_path")
        local pub_file="${found_key_path}.pub"

        # Get unique logged-in non-root users from `w` output (skip header line)
        local user_list=""
        user_list=$(w -h 2>/dev/null | awk '{print $1}' | sort -u)

        for login_user in $user_list; do
            # Skip root (already handled above)
            if [ "$login_user" = "root" ]; then
                continue
            fi

            # Get user home directory from /etc/passwd
            local user_home=""
            user_home=$(getent passwd "$login_user" 2>/dev/null | cut -d: -f6)
            if [ -z "$user_home" ] || [ ! -d "$user_home" ]; then
                continue
            fi

            local user_ssh_dir="$user_home/.ssh"
            local user_key="$user_ssh_dir/$key_basename"
            local user_pub="$user_ssh_dir/${key_basename}.pub"

            # Create .ssh dir if needed
            if [ ! -d "$user_ssh_dir" ]; then
                mkdir -p "$user_ssh_dir"
                chown "$login_user:$login_user" "$user_ssh_dir"
                chmod 700 "$user_ssh_dir"
            fi

            # Copy private key
            cp -f "$found_key_path" "$user_key" 2>/dev/null
            chown "$login_user:$login_user" "$user_key" 2>/dev/null
            chmod 600 "$user_key" 2>/dev/null

            # Copy public key
            if [ -f "$pub_file" ]; then
                cp -f "$pub_file" "$user_pub" 2>/dev/null
                chown "$login_user:$login_user" "$user_pub" 2>/dev/null
                chmod 644 "$user_pub" 2>/dev/null
            fi

            # Fix .ssh dir permissions
            chmod 700 "$user_ssh_dir" 2>/dev/null
            if [ -f "$user_ssh_dir/authorized_keys" ]; then
                chmod 600 "$user_ssh_dir/authorized_keys" 2>/dev/null
            fi
            if [ -f "$user_ssh_dir/config" ]; then
                chmod 600 "$user_ssh_dir/config" 2>/dev/null
            fi

            write_color_text "[SSH] Key installed for user: $login_user ($user_key)" "Green" >&2
        done
    fi

    return 0
}

