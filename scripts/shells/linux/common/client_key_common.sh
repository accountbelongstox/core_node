#!/bin/bash
# Shared client key (config/service_contract.json#client_key_auth), used by
# dd.sh, 175_laravel_main_start.sh and pyservice. Idempotent:
#   valid raw key            -> report its key id
#   invalid raw key (decoy)  -> removed; a wrong-password decrypt writes random data
#   encrypted copy, no raw   -> ask for the password and decrypt it (terminal only);
#                               a failed decrypt offers to regenerate + encrypt at once
#   no copy anywhere         -> generate it; dd.sh then offers to encrypt it
# The key value is never printed.

# Source-once guard: repeated `source` is a no-op.
if [ "${CLIENT_KEY_COMMON_LOADED:-false}" = "true" ]; then
    return
fi
CLIENT_KEY_COMMON_LOADED="true"

CLIENT_KEY_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_KEY_ROOT_DIR="$(cd "$CLIENT_KEY_COMMON_DIR/../../../.." && pwd)"
CLIENT_KEY_SECRET_ROOT_DIR="$CLIENT_KEY_ROOT_DIR/.secret_keys"
CLIENT_KEY_RAW_DIR="$CLIENT_KEY_SECRET_ROOT_DIR/.secret_ignore"
CLIENT_KEY_ENCRYPTED_DIR="$CLIENT_KEY_SECRET_ROOT_DIR/already_encrypted"
CLIENT_KEY_BATCH_ENCRYPTED_DIR="$CLIENT_KEY_SECRET_ROOT_DIR/already_batch_encrypted"
CLIENT_KEY_CONTRACT_NAME="client_key_auth.secret_key_sign_name"
CLIENT_KEY_CONTRACT_BYTES="client_key_auth.key_min_bytes"
CLIENT_KEY_CONTRACT_ID="client_key_auth.key_id"
CLIENT_KEY_DECRYPT_ATTEMPTS=3
CLIENT_KEY_FORCE_ARG="--force"
CLIENT_KEY_NAME=""
CLIENT_KEY_MIN_BYTES=""
CLIENT_KEY_ID_LENGTH=""
CLIENT_KEY_STATE=""
CLIENT_KEY_ID=""
CLIENT_KEY_NODE_BIN=""

source "$CLIENT_KEY_COMMON_DIR/secret_tool_common.sh"
source "$CLIENT_KEY_COMMON_DIR/service_contract_common.sh"
source "$CLIENT_KEY_COMMON_DIR/fs_perm_helpers.sh"

# Loads CLIENT_KEY_NAME / CLIENT_KEY_MIN_BYTES / CLIENT_KEY_ID_LENGTH; they stay
# empty when the contract is unreadable.
client_key_load_contract() {
    local id_spec=""

    [ -n "$CLIENT_KEY_NAME" ] && return 0
    CLIENT_KEY_NAME="$(sc_get "$CLIENT_KEY_CONTRACT_NAME")"
    CLIENT_KEY_MIN_BYTES="$(sc_get "$CLIENT_KEY_CONTRACT_BYTES")"
    id_spec="$(sc_get "$CLIENT_KEY_CONTRACT_ID")"
    if [[ "$id_spec" =~ first-([0-9]+)-chars ]]; then
        CLIENT_KEY_ID_LENGTH="${BASH_REMATCH[1]}"
    fi
    if [ -z "$CLIENT_KEY_NAME" ] || [ -z "$CLIENT_KEY_MIN_BYTES" ] || [ -z "$CLIENT_KEY_ID_LENGTH" ]; then
        CLIENT_KEY_NAME=""
        echo -e "\033[31m[CLIENT_KEY] Contract unreadable ($SERVICE_CONTRACT_FILE: client_key_auth)\033[0m"
    fi
}

# Prints the decoded key bytes of a base64url-no-padding key file.
client_key_decode_file() {
    local key_file="$1"
    local key_text=""

    key_text="$(tr -d '[:space:]\000' < "$key_file" 2>/dev/null)"
    [[ "$key_text" =~ ^[A-Za-z0-9_-]+$ ]] || return 0
    [ $(( ${#key_text} % 4 )) -eq 1 ] && return 0
    while [ $(( ${#key_text} % 4 )) -ne 0 ]; do
        key_text+="="
    done
    printf '%s' "$key_text" | tr -- '-_' '+/' | base64 -d 2>/dev/null
}

# Sets CLIENT_KEY_STATE to valid | invalid | unreadable | absent and CLIENT_KEY_ID (valid only).
client_key_inspect() {
    local key_file="$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME"
    local decoded_bytes=0

    CLIENT_KEY_STATE="absent"
    CLIENT_KEY_ID=""
    [ -e "$key_file" ] || return 0
    CLIENT_KEY_STATE="unreadable"
    [ -r "$key_file" ] || return 0
    CLIENT_KEY_STATE="invalid"
    decoded_bytes="$(client_key_decode_file "$key_file" | wc -c)"
    [ "$decoded_bytes" -ge "$CLIENT_KEY_MIN_BYTES" ] || return 0
    CLIENT_KEY_STATE="valid"
    CLIENT_KEY_ID="$(client_key_decode_file "$key_file" | sha256sum | cut -c1-"$CLIENT_KEY_ID_LENGTH")"
}

# Removes a raw key that is not a base64url key of the contract size.
client_key_discard_invalid() {
    client_key_load_contract
    [ -n "$CLIENT_KEY_NAME" ] || return 0
    client_key_inspect
    [ "$CLIENT_KEY_STATE" = "invalid" ] || return 0
    rm -f "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME" 2>/dev/null || ${USE_SUDO:-} rm -f "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME"
    echo -e "\033[31m[CLIENT_KEY] $CLIENT_KEY_NAME was not a valid key (wrong decrypt password?); removed so it can be decrypted again\033[0m"
}

# Resolves CLIENT_KEY_NODE_BIN (empty when Node.js is missing).
client_key_resolve_node() {
    secret_ensure_node
    CLIENT_KEY_NODE_BIN="$SECRET_NODE_BIN"
    if [ -z "$CLIENT_KEY_NODE_BIN" ]; then
        echo -e "\033[31m[CLIENT_KEY] Node.js not found; it is required to decrypt or encrypt $CLIENT_KEY_NAME\033[0m"
    fi
}

# Writes a new random key to the raw dir (replaces any existing one).
client_key_write_new() {
    local tmp_file=""

    mkdir -p -m 700 "$CLIENT_KEY_RAW_DIR" 2>/dev/null
    tmp_file="$(mktemp "$CLIENT_KEY_RAW_DIR/.$CLIENT_KEY_NAME.XXXXXX")" || return 0
    head -c "$CLIENT_KEY_MIN_BYTES" /dev/urandom | base64 -w 0 | tr '+/' '-_' | tr -d '=' > "$tmp_file"
    if [ ! -s "$tmp_file" ]; then
        rm -f "$tmp_file"
        echo -e "\033[31m[CLIENT_KEY] Failed to generate $CLIENT_KEY_NAME in $CLIENT_KEY_RAW_DIR\033[0m"
        return 0
    fi
    chmod 600 "$tmp_file"
    mv -f "$tmp_file" "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME"
    repair_private_tree "$CLIENT_KEY_SECRET_ROOT_DIR" || true
}

# Generates the key only when no raw file, no encrypted copy and no bundle entry exists.
client_key_generate_if_absent() {
    local bundle_file=""

    client_key_load_contract
    [ -n "$CLIENT_KEY_NAME" ] || return 0
    [ -s "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME" ] && return 0
    [ -e "$CLIENT_KEY_ENCRYPTED_DIR/$CLIENT_KEY_NAME.js" ] && return 0
    [ -e "$CLIENT_KEY_ENCRYPTED_DIR/$CLIENT_KEY_NAME.JS" ] && return 0
    for bundle_file in "$CLIENT_KEY_BATCH_ENCRYPTED_DIR"/*.js; do
        [ -f "$bundle_file" ] || continue
        grep -qF "\"filename\": \"$CLIENT_KEY_NAME\"" "$bundle_file" && return 0
    done
    client_key_write_new
    [ -s "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME" ] || return 0
    echo -e "\033[33m[CLIENT_KEY] Generated $CLIENT_KEY_NAME ($CLIENT_KEY_RAW_DIR); encrypt it with dd.sh and sync the encrypted copy to every host\033[0m"
}

# client_key_encrypt_notice NAME_OR_PATH...
# Encryption call sites: explains what encrypting the shared client key implies.
client_key_encrypt_notice() {
    local name=""

    client_key_load_contract
    [ -n "$CLIENT_KEY_NAME" ] || return 0
    for name in "$@"; do
        name="${name##*/}"
        [ "${name%.js}" = "$CLIENT_KEY_NAME" ] || continue
        echo -e "\033[33m[CLIENT_KEY] Encrypting the shared client key $CLIENT_KEY_NAME: sync already_encrypted/$CLIENT_KEY_NAME.js to every host, decrypt it there and restart the Laravel workers and pyservice\033[0m"
        return 0
    done
}

# client_key_offer_regenerate [PASSWORD]
# Decryption failed: asks whether to regenerate the key and encrypts the new key
# at once (PASSWORD, or a newly entered one), checked against another secret.
client_key_offer_regenerate() {
    local password="$1"
    local answer=""
    local reference_file=""
    local candidate=""
    local encrypted_file=""

    client_key_load_contract
    [ -n "$CLIENT_KEY_NAME" ] || return 0
    encrypted_file="$CLIENT_KEY_ENCRYPTED_DIR/$CLIENT_KEY_NAME.js"
    client_key_resolve_node
    [ -n "$CLIENT_KEY_NODE_BIN" ] || return 0
    if ! prompt_tty_foreground; then
        echo -e "\033[33m[CLIENT_KEY] $CLIENT_KEY_NAME could not be decrypted; run dd.sh in a terminal to decrypt or regenerate it\033[0m"
        return 0
    fi
    echo -e "\033[31m[CLIENT_KEY] $CLIENT_KEY_NAME cannot be decrypted with this password\033[0m"
    echo -e "\033[33m[CLIENT_KEY] Regenerating replaces the shared key: every other host must sync the new encrypted copy, decrypt it and restart the Laravel workers and pyservice\033[0m"
    prompt_read_default answer "n" 120 "Regenerate $CLIENT_KEY_NAME and encrypt it now? [y/N]: "
    [[ "$answer" =~ ^[Yy] ]] || return 0
    [ -n "$password" ] || secret_prompt_password password "[CLIENT_KEY] $CLIENT_KEY_NAME encryption"
    [ -n "$password" ] || return 0

    for candidate in "$CLIENT_KEY_ENCRYPTED_DIR"/*.js; do
        [ -f "$candidate" ] && [ "$candidate" != "$encrypted_file" ] || continue
        reference_file="$candidate"
        break
    done
    if [ -n "$reference_file" ]; then
        secret_crypto_batch "$password" "$CLIENT_KEY_NODE_BIN" verify "$reference_file"
        if [ "${#SECRET_CRYPTO_DONE[@]}" -eq 0 ]; then
            echo -e "\033[33m[CLIENT_KEY] This password does not decrypt ${reference_file##*/}; the other secrets use a different password\033[0m"
            prompt_read_default answer "n" 120 "Encrypt $CLIENT_KEY_NAME with it anyway? [y/N]: "
            [[ "$answer" =~ ^[Yy] ]] || { password=""; return 0; }
        fi
    fi

    client_key_write_new
    client_key_encrypt_notice "$CLIENT_KEY_NAME"
    secret_crypto_batch "$password" "$CLIENT_KEY_NODE_BIN" encrypt "$CLIENT_KEY_ENCRYPTED_DIR" "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME"
    password=""
    client_key_inspect
    if [ "${#SECRET_CRYPTO_DONE[@]}" -gt 0 ]; then
        touch -r "$encrypted_file" "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME" 2>/dev/null || true
        repair_private_tree "$CLIENT_KEY_SECRET_ROOT_DIR" || true
        echo -e "\033[32m[CLIENT_KEY] Regenerated and encrypted $CLIENT_KEY_NAME (key id $CLIENT_KEY_ID); commit $encrypted_file and sync it to every host\033[0m"
    else
        echo -e "\033[31m[CLIENT_KEY] Regenerated $CLIENT_KEY_NAME but encryption failed; run dd.sh to encrypt it\033[0m"
    fi
}

# client_key_after_decrypt PASSWORD
# Call right after a secret_crypto_batch decrypt: offers regeneration when the
# client key was among the wrong-password files.
client_key_after_decrypt() {
    local password="$1"
    local name=""

    client_key_load_contract
    [ -n "$CLIENT_KEY_NAME" ] || return 0
    for name in "${SECRET_CRYPTO_WRONG[@]}"; do
        [ "$name" = "$CLIENT_KEY_NAME" ] || continue
        client_key_offer_regenerate "$password"
        return 0
    done
}

# Asks for the password and decrypts the encrypted copy; after the last wrong
# password, offers to regenerate.
client_key_decrypt_interactive() {
    local encrypted_file="$CLIENT_KEY_ENCRYPTED_DIR/$CLIENT_KEY_NAME.js"
    local password=""
    local attempt=0

    client_key_resolve_node
    [ -n "$CLIENT_KEY_NODE_BIN" ] || return 0
    if ! prompt_tty_foreground; then
        echo -e "\033[33m[CLIENT_KEY] $CLIENT_KEY_NAME is encrypted but not decrypted; run dd.sh or this script in a terminal to decrypt it\033[0m"
        return 0
    fi
    while [ "$attempt" -lt "$CLIENT_KEY_DECRYPT_ATTEMPTS" ]; do
        attempt=$((attempt + 1))
        secret_prompt_password password "[CLIENT_KEY] $CLIENT_KEY_NAME decrypt ($attempt/$CLIENT_KEY_DECRYPT_ATTEMPTS)"
        [ -n "$password" ] || return 0
        secret_crypto_batch "$password" "$CLIENT_KEY_NODE_BIN" decrypt "$CLIENT_KEY_RAW_DIR" "$CLIENT_KEY_FORCE_ARG" "$encrypted_file"
        client_key_inspect
        if [ "$CLIENT_KEY_STATE" = "valid" ]; then
            password=""
            touch -r "$encrypted_file" "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME" 2>/dev/null || true
            repair_private_tree "$CLIENT_KEY_SECRET_ROOT_DIR" || true
            echo -e "\033[32m[CLIENT_KEY] Decrypted $CLIENT_KEY_NAME\033[0m"
            return 0
        fi
        echo -e "\033[31m[CLIENT_KEY] Wrong password for $CLIENT_KEY_NAME\033[0m"
    done
    client_key_offer_regenerate "$password"
    password=""
}

# Entry point: leaves a valid key in the raw dir whenever possible.
client_key_ensure_ready() {
    client_key_load_contract
    [ -n "$CLIENT_KEY_NAME" ] || return 0
    client_key_discard_invalid
    client_key_inspect
    if [ "$CLIENT_KEY_STATE" = "absent" ] && [ -e "$CLIENT_KEY_ENCRYPTED_DIR/$CLIENT_KEY_NAME.js" ]; then
        client_key_decrypt_interactive
    fi
    client_key_generate_if_absent
    client_key_inspect
    if [ "$CLIENT_KEY_STATE" = "valid" ]; then
        echo -e "\033[32m[CLIENT_KEY] $CLIENT_KEY_NAME ready (key id $CLIENT_KEY_ID)\033[0m"
    elif [ "$CLIENT_KEY_STATE" = "unreadable" ]; then
        echo -e "\033[33m[CLIENT_KEY] $CLIENT_KEY_NAME is not readable by $(id -un); run dd.sh to repair .secret_keys ownership\033[0m"
    elif [ "$CLIENT_KEY_STATE" = "absent" ]; then
        echo -e "\033[33m[CLIENT_KEY] $CLIENT_KEY_NAME missing; run dd.sh to decrypt it\033[0m"
    fi
}
