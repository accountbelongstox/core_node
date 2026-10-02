#!/bin/bash
# client_key_auth HMAC primitives in pure shell (openssl + coreutils) for the
# Laravel rescue CGI and its shell client. Dependency-free so the per-request
# CGI never loads the gvar/contract stack.

LR_SIG_EMPTY_SHA256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
LR_SIG_KEY_HEX=""
LR_SIG_KEY_ID=""
LR_SIG_VALUE=""

# lr_sig_load_key <key_file> <key_id_length>: sets LR_SIG_KEY_HEX / LR_SIG_KEY_ID
# (both empty when the file is missing, unreadable or not base64url).
lr_sig_load_key() {
    local key_file="$1"
    local id_length="$2"
    local key_text=""

    LR_SIG_KEY_HEX=""
    LR_SIG_KEY_ID=""
    [ -r "$key_file" ] || return 0
    key_text="$(tr -d '[:space:]\000' < "$key_file" 2>/dev/null)"
    [[ "$key_text" =~ ^[A-Za-z0-9_-]+$ ]] || return 0
    [ $(( ${#key_text} % 4 )) -eq 1 ] && return 0
    while [ $(( ${#key_text} % 4 )) -ne 0 ]; do
        key_text+="="
    done
    key_text="$(printf '%s' "$key_text" | tr -- '-_' '+/')"
    LR_SIG_KEY_HEX="$(printf '%s' "$key_text" | base64 -d 2>/dev/null | od -An -v -tx1 | tr -d ' \n')"
    [ -n "$LR_SIG_KEY_HEX" ] || return 0
    LR_SIG_KEY_ID="$(printf '%s' "$key_text" | base64 -d 2>/dev/null | sha256sum | cut -c1-"$id_length")"
}

# lr_sig_sign <field>... : HMAC-SHA256 of the fields joined by "\n" with the
# loaded key, base64url without padding, into LR_SIG_VALUE.
lr_sig_sign() {
    local canonical=""

    LR_SIG_VALUE=""
    [ -n "$LR_SIG_KEY_HEX" ] || return 0
    canonical="$(printf '%s\n' "$@")"
    LR_SIG_VALUE="$(printf '%s' "$canonical" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$LR_SIG_KEY_HEX" -binary | base64 -w 0 | tr '+/' '-_' | tr -d '=')"
}
