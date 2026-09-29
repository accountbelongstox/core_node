#!/bin/bash
# Shared client key (config/service_contract.json#client_key_auth), used by
# dd.sh, 175_laravel_main_start.sh and pyservice. Idempotent:
#   valid raw key            -> report its key id
#   invalid raw key (decoy)  -> removed; a wrong-password decrypt writes random data
#   encrypted copy, no raw   -> ask for the password and decrypt it (terminal only)
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

# Generates the key only when no raw file, no encrypted copy and no bundle entry exists.
client_key_generate_if_absent() {
    local bundle_file=""
    local tmp_file=""

    client_key_load_contract
    [ -n "$CLIENT_KEY_NAME" ] || return 0
    [ -s "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME" ] && return 0
    [ -e "$CLIENT_KEY_ENCRYPTED_DIR/$CLIENT_KEY_NAME.js" ] && return 0
    [ -e "$CLIENT_KEY_ENCRYPTED_DIR/$CLIENT_KEY_NAME.JS" ] && return 0
    for bundle_file in "$CLIENT_KEY_BATCH_ENCRYPTED_DIR"/*.js; do
        [ -f "$bundle_file" ] || continue
        grep -qF "\"filename\": \"$CLIENT_KEY_NAME\"" "$bundle_file" && return 0
    done

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
    echo -e "\033[33m[CLIENT_KEY] Generated $CLIENT_KEY_NAME ($CLIENT_KEY_RAW_DIR); encrypt it with dd.sh and sync the encrypted copy to every host\033[0m"
}

# Asks for the password and decrypts the encrypted copy; a wrong password is retried.
client_key_decrypt_interactive() {
    local encrypted_file="$CLIENT_KEY_ENCRYPTED_DIR/$CLIENT_KEY_NAME.js"
    local node_bin=""
    local password=""
    local attempt=0

    node_bin="${NODE_BIN:-}"
    [ -n "$node_bin" ] && [ -x "$node_bin" ] || node_bin="$SERVICE_CONTRACT_NODE_BIN"
    if [ -z "$node_bin" ]; then
        echo -e "\033[31m[CLIENT_KEY] Node.js not found; it is required to decrypt $CLIENT_KEY_NAME\033[0m"
        return 0
    fi
    if ! prompt_tty_foreground; then
        echo -e "\033[33m[CLIENT_KEY] $CLIENT_KEY_NAME is encrypted but not decrypted; run dd.sh or this script in a terminal to decrypt it\033[0m"
        return 0
    fi
    mkdir -p -m 700 "$CLIENT_KEY_RAW_DIR" 2>/dev/null
    while [ "$attempt" -lt "$CLIENT_KEY_DECRYPT_ATTEMPTS" ]; do
        attempt=$((attempt + 1))
        secret_prompt_password password "[CLIENT_KEY] $CLIENT_KEY_NAME decrypt ($attempt/$CLIENT_KEY_DECRYPT_ATTEMPTS)"
        [ -n "$password" ] || break
        secret_tool_run "$password" "" "$node_bin" "$encrypted_file" pwd "$SECRET_PASSWORD_ARG" "$CLIENT_KEY_RAW_DIR" "$CLIENT_KEY_FORCE_ARG" >/dev/null 2>&1
        password=""
        client_key_inspect
        if [ "$CLIENT_KEY_STATE" = "valid" ]; then
            touch -r "$encrypted_file" "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME" 2>/dev/null || true
            repair_private_tree "$CLIENT_KEY_SECRET_ROOT_DIR" || true
            echo -e "\033[32m[CLIENT_KEY] Decrypted $CLIENT_KEY_NAME\033[0m"
            return 0
        fi
        rm -f "$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME" 2>/dev/null
        echo -e "\033[31m[CLIENT_KEY] Wrong password for $CLIENT_KEY_NAME\033[0m"
    done
    echo -e "\033[33m[CLIENT_KEY] $CLIENT_KEY_NAME not decrypted; signed machine calls are refused until it is\033[0m"
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
