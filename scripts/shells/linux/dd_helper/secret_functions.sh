#!/bin/bash

# =============================================================================
# Secret Functions for dd.sh and standalone launchers.
# Detection never prompts. Decrypt / re-encrypt are queued through
# prompt_queue_* (stacked into dd.sh's single pre-menu prompt, or flushed at
# once when the caller did not defer the queue). Mode menus and passwords are
# asked only after the user accepted an item.
# =============================================================================

# Repo root: caller may set CORE_NODE_ROOT_DIR before sourcing; otherwise resolve from this file location.
_DD_HELPER_SECRETS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "${CORE_NODE_ROOT_DIR:-}" ]; then
    CORE_NODE_ROOT_DIR="$(cd "$_DD_HELPER_SECRETS_DIR/../../../.." && pwd)"
fi
[ -z "${CORE_NODE_DATA_DIR:-}" ] && source "$_DD_HELPER_SECRETS_DIR/../common/runtime_environment.sh"
source "$_DD_HELPER_SECRETS_DIR/../common/prompt_common.sh"
source "$_DD_HELPER_SECRETS_DIR/../common/arrow_menu.sh"
source "$_DD_HELPER_SECRETS_DIR/../common/secret_tool_common.sh"
source "$_DD_HELPER_SECRETS_DIR/../common/fs_perm_helpers.sh"
source "$_DD_HELPER_SECRETS_DIR/../common/service_contract_common.sh"
source "$_DD_HELPER_SECRETS_DIR/../common/client_key_common.sh"

SECRET_ROOT_DIR="$CORE_NODE_ROOT_DIR/.secret_keys"
SECRET_ENCRYPTED_DIR="$SECRET_ROOT_DIR/already_encrypted"
SECRET_BATCH_ENCRYPTED_DIR="$SECRET_ROOT_DIR/already_batch_encrypted"
SECRET_RAW_DIR="$SECRET_ROOT_DIR/.secret_ignore"
SECRET_ENCRYPTION_TOOLS_DIR="$CORE_NODE_ROOT_DIR/scripts/encryption_tools"
SECRET_CACHE_DIR="$CORE_NODE_SECRET_CACHE_DIR"
# Decryption timestamps expire after 7 days; content-hash baselines never expire.
SECRET_CACHE_TTL=604800
SECRET_BUNDLE_FILE=""
SECRET_BUNDLE_NEEDS_DECRYPT=false
SECRET_NODE_CMD=""
SECRET_USE_BATCH=false
SECRET_PASSWORD=""
SECRET_PENDING_FILES=()
SECRET_CHANGED_FILES=()
SECRET_REENCRYPT_FILES=()
SECRET_MODE_MENU_ITEMS=(
    "Batch mode (Bundle) - Fast, single process"
    "Individual mode (Original) - Multiple processes"
)

# =============================================================================
# Secret caches
# =============================================================================

set_decryption_timestamp_cache() {
    local filename="$1"
    local cache_dir="$SECRET_CACHE_DIR/decryption_timestamps"
    local now=0

    [ -d "$cache_dir" ] || $USE_SUDO mkdir -p "$cache_dir"
    printf -v now '%(%s)T' -1
    echo "$now" | $USE_SUDO tee "$cache_dir/${filename}.decrypt_time" >/dev/null 2>&1
}

# Persistent content-change baseline of an encrypted file.
set_encrypted_content_hash_cache() {
    local filename="$1"
    local encrypted_file="$2"
    local cache_dir="$SECRET_CACHE_DIR/encrypted_content_hash"
    local file_hash=""

    [ -s "$encrypted_file" ] || return 0
    [ -d "$cache_dir" ] || $USE_SUDO mkdir -p "$cache_dir"
    file_hash="$(sha256sum "$encrypted_file" 2>/dev/null | cut -d' ' -f1)"
    if [ -n "$file_hash" ]; then
        echo "$file_hash" | $USE_SUDO tee "$cache_dir/${filename}.enc_hash" >/dev/null 2>&1
    fi
}

# Expire decryption timestamps. encrypted_content_hash/*.enc_hash are NOT
# expired: they are content-change baselines, and a missing baseline would make
# every file look changed.
cleanup_secret_cache() {
    local decrypt_cache_dir="$SECRET_CACHE_DIR/decryption_timestamps"
    local cache_file=""
    local file_mtime=0
    local now=0
    local cleaned_files=0

    [ -d "$decrypt_cache_dir" ] || return 0
    printf -v now '%(%s)T' -1
    for cache_file in "$decrypt_cache_dir"/*.decrypt_time; do
        [ -s "$cache_file" ] || continue
        file_mtime="$(stat -c %Y "$cache_file" 2>/dev/null)"
        [ -n "$file_mtime" ] || file_mtime=0
        if [ $((now - file_mtime)) -gt "$SECRET_CACHE_TTL" ]; then
            $USE_SUDO rm -f "$cache_file" 2>/dev/null
            cleaned_files=$((cleaned_files + 1))
        fi
    done
    if [ "$cleaned_files" -gt 0 ]; then
        echo -e "\033[33m[SECRET CACHE CLEANUP] Removed $cleaned_files expired secret cache entries\033[0m"
    fi
}

# =============================================================================
# Helpers
# =============================================================================

secret_resolve_node() {
    secret_ensure_node
    SECRET_NODE_CMD="$SECRET_NODE_BIN"
    if [ -z "$SECRET_NODE_CMD" ]; then
        echo -e "\033[31m[SECRETS] Node.js is still missing after $SECRET_NODE_INSTALL_SCRIPT; it is required for secret files.\033[0m"
        return 1
    fi
    echo -e "\033[36m[SECRETS] Using Node.js: $SECRET_NODE_CMD\033[0m"
}

secret_find_bundle() {
    SECRET_BUNDLE_FILE=""
    if [ -d "$SECRET_BATCH_ENCRYPTED_DIR" ]; then
        SECRET_BUNDLE_FILE="$(find "$SECRET_BATCH_ENCRYPTED_DIR" -type f -name '*.js' 2>/dev/null | head -n 1)"
    fi
}

# Batch vs individual mode (arrow menu); only offered when a bundle exists.
secret_select_mode() {
    local title="$1"

    SECRET_USE_BATCH=false
    [ -n "$SECRET_BUNDLE_FILE" ] || return 0
    arrow_menu_select "$title" SECRET_MODE_MENU_ITEMS 0 -1
    if [ "$ARROW_MENU_SELECTED_INDEX" = "0" ]; then
        SECRET_USE_BATCH=true
    fi
}

# =============================================================================
# Detection (no prompts)
# =============================================================================

# SECRET_PENDING_FILES: encrypted files without a decrypted copy.
# SECRET_CHANGED_FILES: decrypted names whose encrypted content changed since
#   the stored baseline (a missing baseline is seeded, never reported).
# SECRET_BUNDLE_NEEDS_DECRYPT: the bundle holds more files than the raw dir.
secret_scan_decrypt_state() {
    local enc_file=""
    local base_name=""
    local current_hash=""
    local cached_hash=""
    local cache_file=""
    local bundle_count=0
    local raw_count=0
    local index=0
    local -a hashed_files=()
    local -a hashed_names=()
    local -A current_hashes=()

    SECRET_PENDING_FILES=()
    SECRET_CHANGED_FILES=()
    SECRET_BUNDLE_NEEDS_DECRYPT=false

    while IFS= read -r -d '' enc_file; do
        base_name="${enc_file##*/}"
        base_name="${base_name%.js}"
        base_name="${base_name%.JS}"
        if [ ! -s "$SECRET_RAW_DIR/$base_name" ]; then
            SECRET_PENDING_FILES+=("$enc_file")
            continue
        fi
        if [ ! -s "$SECRET_CACHE_DIR/encrypted_content_hash/${base_name}.enc_hash" ]; then
            set_encrypted_content_hash_cache "$base_name" "$enc_file"
            continue
        fi
        hashed_files+=("$enc_file")
        hashed_names+=("$base_name")
    done < <(find "$SECRET_ENCRYPTED_DIR" -type f \( -name '*.js' -o -name '*.JS' \) -print0 2>/dev/null)

    if [ "${#hashed_files[@]}" -gt 0 ]; then
        while read -r current_hash enc_file; do
            current_hashes["$enc_file"]="$current_hash"
        done < <(sha256sum -- "${hashed_files[@]}" 2>/dev/null)
    fi
    for index in "${!hashed_files[@]}"; do
        cache_file="$SECRET_CACHE_DIR/encrypted_content_hash/${hashed_names[$index]}.enc_hash"
        cached_hash="$(< "$cache_file")"
        current_hash="${current_hashes[${hashed_files[$index]}]:-}"
        if [ -z "$cached_hash" ] || [ -z "$current_hash" ] || [ "$cached_hash" != "$current_hash" ]; then
            SECRET_CHANGED_FILES+=("${hashed_names[$index]}")
        fi
    done

    secret_find_bundle
    if [ -n "$SECRET_BUNDLE_FILE" ]; then
        bundle_count="$(grep -o 'const TOTAL_COUNT = [0-9]*' "$SECRET_BUNDLE_FILE" 2>/dev/null | head -n 1 | grep -o '[0-9]*$' || true)"
        [ -n "$bundle_count" ] || bundle_count=0
        raw_count="$(find "$SECRET_RAW_DIR" -type f 2>/dev/null | wc -l)"
        if [ "$bundle_count" -gt 0 ] && [ "$raw_count" -lt "$bundle_count" ]; then
            SECRET_BUNDLE_NEEDS_DECRYPT=true
        fi
    fi
}

# SECRET_REENCRYPT_FILES: raw files with no encrypted copy or newer than it.
secret_scan_reencrypt_state() {
    local raw_file=""
    local base_name=""
    local enc_file=""

    SECRET_REENCRYPT_FILES=()
    [ -d "$SECRET_RAW_DIR" ] || return 0
    while IFS= read -r -d '' raw_file; do
        base_name="${raw_file##*/}"
        enc_file="$SECRET_ENCRYPTED_DIR/$base_name.js"
        if [ ! -f "$enc_file" ] || [ "$raw_file" -nt "$enc_file" ]; then
            SECRET_REENCRYPT_FILES+=("$base_name")
        fi
    done < <(find "$SECRET_RAW_DIR" -type f -print0 2>/dev/null)
}

# =============================================================================
# Queue handlers
# =============================================================================

secret_decrypt_accept() {
    local file_name=""
    local enc_file=""
    local base_name=""
    local sources=()

    for file_name in "${SECRET_CHANGED_FILES[@]}"; do
        if [ -f "$SECRET_RAW_DIR/$file_name" ]; then
            rm -f "$SECRET_RAW_DIR/$file_name" 2>/dev/null
            echo -e "\033[36m[CACHE INVALIDATED] Removed outdated decrypted file: $file_name\033[0m"
        fi
    done
    secret_scan_decrypt_state
    if [ "${#SECRET_PENDING_FILES[@]}" -eq 0 ] && [ "$SECRET_BUNDLE_NEEDS_DECRYPT" = false ]; then
        echo -e "\033[32m[SECRETS] Nothing to decrypt\033[0m"
        return 0
    fi
    sources=("${SECRET_PENDING_FILES[@]}")
    [ "$SECRET_BUNDLE_NEEDS_DECRYPT" = true ] && [ -n "$SECRET_BUNDLE_FILE" ] && sources+=("$SECRET_BUNDLE_FILE")
    secret_resolve_node || return 1
    secret_prompt_password SECRET_PASSWORD "[SECRETS]"
    [ -n "$SECRET_PASSWORD" ] || return 1

    echo -e "\033[36m[SECRETS] Decrypting ${#sources[@]} file(s) in one batch -> $SECRET_RAW_DIR\033[0m"
    secret_crypto_batch "$SECRET_PASSWORD" "$SECRET_NODE_CMD" decrypt "$SECRET_RAW_DIR" "${sources[@]}"
    for base_name in "${SECRET_CRYPTO_DONE[@]}"; do
        set_decryption_timestamp_cache "$base_name"
        enc_file="$SECRET_ENCRYPTED_DIR/$base_name.js"
        if [ -f "$enc_file" ]; then
            # Raw mtime follows its encrypted counterpart so the re-encrypt
            # check does not flag freshly decrypted files.
            touch -r "$enc_file" "$SECRET_RAW_DIR/$base_name" 2>/dev/null || true
            set_encrypted_content_hash_cache "$base_name" "$enc_file"
        fi
    done
    if [ "$SECRET_BUNDLE_NEEDS_DECRYPT" = true ] && [ -n "$SECRET_BUNDLE_FILE" ]; then
        base_name="${SECRET_BUNDLE_FILE##*/}"
        base_name="${base_name%.js}"
        set_encrypted_content_hash_cache "${base_name%.JS}" "$SECRET_BUNDLE_FILE"
    fi
    for base_name in "${SECRET_CRYPTO_WRONG[@]}"; do
        echo -e "\033[31m[SECRETS]   WRONG PASSWORD: $base_name (nothing written)\033[0m"
    done
    for base_name in "${SECRET_CRYPTO_FAILED[@]}"; do
        echo -e "\033[31m[SECRETS]   FAILED: $base_name\033[0m"
    done
    echo -e "\033[36m[SECRETS] Decryption summary: ${#SECRET_CRYPTO_DONE[@]} decrypted, ${#SECRET_CRYPTO_SKIPPED[@]} already present, ${#SECRET_CRYPTO_WRONG[@]} wrong password, ${#SECRET_CRYPTO_FAILED[@]} failed\033[0m"
    client_key_after_decrypt "$SECRET_PASSWORD"
    SECRET_PASSWORD=""
    repair_private_tree "$SECRET_ROOT_DIR" || true
}

# Explicit "no" keeps the old files and refreshes the baselines of changed
# files (no more notifications until they change again); Enter/timeout keeps
# everything so the question returns on the next start.
secret_decrypt_decline() {
    local reason="$2"
    local file_name=""
    local enc_file=""

    if [ "$reason" = "declined" ] && [ "${#SECRET_CHANGED_FILES[@]}" -gt 0 ]; then
        for file_name in "${SECRET_CHANGED_FILES[@]}"; do
            enc_file="$SECRET_ENCRYPTED_DIR/$file_name.js"
            [ -s "$enc_file" ] || enc_file="$SECRET_ENCRYPTED_DIR/$file_name.JS"
            set_encrypted_content_hash_cache "$file_name" "$enc_file"
        done
        echo -e "\033[33m[CACHE UPDATE] Kept existing decrypted files; ${#SECRET_CHANGED_FILES[@]} changed file(s) will not prompt again until their content changes\033[0m"
    else
        echo -e "\033[33m[SECRETS] Decryption skipped; it is offered again on the next start or via Linux System Tools -> Clear and Re-decrypt Secret Keys\033[0m"
    fi
}

secret_reencrypt_accept() {
    local base_name=""
    local raw_file=""
    local enc_file=""
    local success_count=0
    local raw_files=()

    secret_scan_reencrypt_state
    if [ "${#SECRET_REENCRYPT_FILES[@]}" -eq 0 ]; then
        echo -e "\033[32m[RE-ENCRYPT] Nothing to re-encrypt\033[0m"
        return 0
    fi
    mkdir -p "$SECRET_ENCRYPTED_DIR" 2>/dev/null || true
    secret_find_bundle
    secret_select_mode "Secret Encryption Mode"
    if [ "$SECRET_USE_BATCH" != true ] && [ ! -f "$SECRET_CRYPTO_JS" ]; then
        echo -e "\033[31m[RE-ENCRYPT] Error: secret_crypto.js not found at: $SECRET_CRYPTO_JS\033[0m"
        return 1
    fi
    secret_resolve_node || return 1
    secret_prompt_password SECRET_PASSWORD "[RE-ENCRYPT]"
    [ -n "$SECRET_PASSWORD" ] || return 1

    client_key_encrypt_notice "${SECRET_REENCRYPT_FILES[@]}"
    if [ "$SECRET_USE_BATCH" = true ]; then
        for base_name in "${SECRET_REENCRYPT_FILES[@]}"; do
            raw_file="$SECRET_RAW_DIR/$base_name"
            echo -e "\033[36m[BATCH MODE]   Processing: $base_name\033[0m"
            if secret_tool_run "$SECRET_PASSWORD" "" "$SECRET_NODE_CMD" "$SECRET_ENCRYPTION_TOOLS_DIR/bundle_add_file.js" "$SECRET_BUNDLE_FILE" "$raw_file" "$SECRET_PASSWORD_ARG" --replace 2>&1 | grep -q "SUCCESS"; then
                success_count=$((success_count + 1))
                echo -e "\033[32m[BATCH MODE]     SUCCESS\033[0m"
            else
                echo -e "\033[31m[BATCH MODE]     FAILED\033[0m"
            fi
        done
    else
        raw_files=()
        for base_name in "${SECRET_REENCRYPT_FILES[@]}"; do
            raw_files+=("$SECRET_RAW_DIR/$base_name")
        done
        echo -e "\033[36m[INDIVIDUAL MODE] Encrypting ${#raw_files[@]} file(s) in one batch\033[0m"
        secret_crypto_batch "$SECRET_PASSWORD" "$SECRET_NODE_CMD" encrypt "$SECRET_ENCRYPTED_DIR" "${raw_files[@]}"
        for base_name in "${SECRET_CRYPTO_DONE[@]}"; do
            enc_file="$SECRET_ENCRYPTED_DIR/$base_name.js"
            touch -r "$enc_file" "$SECRET_RAW_DIR/$base_name" 2>/dev/null || true
            set_encrypted_content_hash_cache "$base_name" "$enc_file"
            echo -e "\033[32m[INDIVIDUAL MODE]   SUCCESS: $base_name\033[0m"
        done
        for base_name in "${SECRET_CRYPTO_FAILED[@]}"; do
            echo -e "\033[31m[INDIVIDUAL MODE]   FAILED: $base_name\033[0m"
        done
        success_count="${#SECRET_CRYPTO_DONE[@]}"
    fi
    SECRET_PASSWORD=""
    repair_private_tree "$SECRET_ROOT_DIR" || true
    echo -e "\033[36m[RE-ENCRYPT] Summary: ${#SECRET_REENCRYPT_FILES[@]} total, $success_count successful, $((${#SECRET_REENCRYPT_FILES[@]} - success_count)) failed\033[0m"
}

secret_reencrypt_decline() {
    echo -e "\033[33m[RE-ENCRYPT] Skipped; files remain out of sync\033[0m"
}

# =============================================================================
# Entry points
# =============================================================================

# Detect secret work and queue it (decrypt first, then re-encrypt).
ensure_secret_keys_ready() {
    local enc_file=""
    local base_name=""

    if [ ! -d "$SECRET_RAW_DIR" ] && [ ! -d "$SECRET_ENCRYPTED_DIR" ] && [ ! -d "$SECRET_BATCH_ENCRYPTED_DIR" ]; then
        return 0
    fi
    cleanup_secret_cache
    if [ ! -d "$SECRET_RAW_DIR" ] && ! mkdir -p -m 700 "$SECRET_RAW_DIR" 2>/dev/null; then
        echo -e "\033[31m[SECRETS] Failed to create decrypted secrets directory: $SECRET_RAW_DIR\033[0m"
        return 1
    fi

    # A decoy client key (wrong-password decrypt) is removed so it counts as missing.
    client_key_discard_invalid
    secret_scan_decrypt_state
    if [ "${#SECRET_PENDING_FILES[@]}" -gt 0 ] || [ "${#SECRET_CHANGED_FILES[@]}" -gt 0 ] || [ "$SECRET_BUNDLE_NEEDS_DECRYPT" = true ]; then
        echo -e "\033[33m[SECRETS] Decryption needed (encrypted: $SECRET_ENCRYPTED_DIR, raw: $SECRET_RAW_DIR)\033[0m"
        for enc_file in "${SECRET_PENDING_FILES[@]}"; do
            echo -e "\033[31m  - missing: ${enc_file##*/}\033[0m"
        done
        for base_name in "${SECRET_CHANGED_FILES[@]}"; do
            echo -e "\033[33m  - changed: $base_name (encrypted content updated)\033[0m"
        done
        if [ "$SECRET_BUNDLE_NEEDS_DECRYPT" = true ]; then
            echo -e "\033[33m  - bundle: ${SECRET_BUNDLE_FILE##*/} holds files missing from the raw dir\033[0m"
        fi
        prompt_queue_add "secret_decrypt" "n" \
            "Decrypt secret files (${#SECRET_PENDING_FILES[@]} missing, ${#SECRET_CHANGED_FILES[@]} changed)" \
            secret_decrypt_accept secret_decrypt_decline
    else
        echo -e "\033[32m[SECRETS] Decrypted secret files are up to date\033[0m"
    fi

    client_key_generate_if_absent
    secret_scan_reencrypt_state
    if [ "${#SECRET_REENCRYPT_FILES[@]}" -gt 0 ]; then
        echo -e "\033[33m[SECRETS] ${#SECRET_REENCRYPT_FILES[@]} file(s) need re-encryption:\033[0m"
        printf '  cd %q\n' "$SECRET_RAW_DIR"
        printf '  cd %q\n' "$SECRET_ENCRYPTED_DIR"
        for base_name in "${SECRET_REENCRYPT_FILES[@]}"; do
            echo -e "\033[33m  - $base_name\033[0m"
        done
        prompt_queue_add "secret_reencrypt" "n" \
            "Re-encrypt ${#SECRET_REENCRYPT_FILES[@]} secret file(s) newer than their encrypted copies" \
            secret_reencrypt_accept secret_reencrypt_decline
    fi
    prompt_queue_commit
}

clear_and_redecrypt_secrets() {
    local file_count=0
    local confirm_choice=""

    echo ""
    echo -e "\033[36m========================================"
    echo -e "Clear and Re-decrypt Secret Keys"
    echo -e "========================================\033[0m"

    if [ ! -d "$SECRET_ENCRYPTED_DIR" ]; then
        echo -e "\033[33m[INFO] No encrypted directory found at: $SECRET_ENCRYPTED_DIR\033[0m"
        echo ""
        read -r -p "Press Enter to continue..."
        return 0
    fi
    [ -d "$SECRET_RAW_DIR" ] && file_count=$(find "$SECRET_RAW_DIR" -type f 2>/dev/null | wc -l)
    if [ "$file_count" -gt 0 ]; then
        echo -e "\033[37mDecrypted files location: $SECRET_RAW_DIR ($file_count file(s))\033[0m"
        echo -e "\033[33m[WARNING] This permanently deletes all decrypted secret files; the password is needed to decrypt them again.\033[0m"
        read -r -p "Are you sure you want to clear all decrypted files? (yes/no): " confirm_choice
        if [[ ! "$confirm_choice" =~ ^[Yy](es)?$ ]]; then
            echo -e "\033[32m[CANCELLED] No files were deleted.\033[0m"
            echo ""
            read -r -p "Press Enter to continue..."
            return 0
        fi
        if rm -rf "$SECRET_RAW_DIR"/* 2>/dev/null; then
            echo -e "\033[32m[SUCCESS] All decrypted files have been cleared\033[0m"
        else
            echo -e "\033[31m[ERROR] Failed to clear some files\033[0m"
        fi
    fi
    ensure_secret_keys_ready
    echo ""
    read -r -p "Press Enter to continue..."
}
