#!/bin/bash
# busybox httpd CGI of the Laravel rescue plane (config/service_contract.json#laravel_rescue).
# Verifies the client_key_auth signature, then only writes
# <epoch>-<nonce>.<action>.request into LR_REQUESTS_DIR (the watcher runs it);
# read actions return the watcher status tail or the port/keepalive state. Every LR_* value comes from the
# generated cgi-bin wrapper (laravel_rescue_common.sh lr_ensure_cgi).

LR_STATUS_TAIL_LINES=20
LR_ACTION=""
LR_BODY_SHA256=""
LR_NOW=0
LR_TIMESTAMP=0
LR_NONCE_FILE=""
LR_REQUEST_TMP=""
LR_REQUEST_FILE=""
LR_HDR_PROTOCOL="${HTTP_X_CORE_NODE_PROTOCOL:-}"
LR_HDR_CLIENT="${HTTP_X_CORE_NODE_CLIENT:-}"
LR_HDR_MACHINE_ID="${HTTP_X_CORE_NODE_MACHINE_ID:-}"
LR_HDR_KEY_ID="${HTTP_X_CORE_NODE_KEY_ID:-}"
LR_HDR_TIMESTAMP="${HTTP_X_CORE_NODE_TIMESTAMP:-}"
LR_HDR_NONCE="${HTTP_X_CORE_NODE_NONCE:-}"
LR_HDR_CONTENT_SHA256="${HTTP_X_CORE_NODE_CONTENT_SHA256:-}"
LR_HDR_SIGNATURE="${HTTP_X_CORE_NODE_SIGNATURE:-}"

source "$LR_SIGNATURE_LIB"

# Runs as root: created files go to the real user (LR_OWNER) idempotently.
lr_own() {
    [ "$(id -u)" -eq 0 ] && chown "$LR_OWNER:$LR_GROUP" "$@" 2>/dev/null
    return 0
}

# lr_port_state <port>: up when a TCP listener exists on it.
lr_port_state() {
    ss -ltnH "sport = :$1" 2>/dev/null | grep -q . && echo up || echo down
}

lr_reply_services() {
    printf 'Status: 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\n\r\n'
    printf 'laravel_port=%s\nlaravel_state=%s\n' "$LR_LARAVEL_PORT" "$(lr_port_state "$LR_LARAVEL_PORT")"
    printf 'ui_port=%s\nui_state=%s\nui_unit=%s\n' "$LR_UI_PORT" "$(lr_port_state "$LR_UI_PORT")" \
        "$(systemctl is-active "$LR_UI_SERVICE" 2>/dev/null)"
    printf 'keepalive=%s\n' "$([ -f "$LR_KEEPALIVE_FLAG" ] && echo on || echo off)"
    exit 0
}

# lr_reply <http status> <code> [extra json members]
lr_reply() {
    printf 'Status: %s\r\nContent-Type: application/json\r\nCache-Control: no-store\r\n\r\n' "$1"
    printf '{"ok":%s,"code":"%s"%s}\n' "$([ "${1%% *}" -lt 300 ] && echo true || echo false)" "$2" "${3:-}"
    exit 0
}

lr_word_in() {
    case " $2 " in
        *" $1 "*) return 0 ;;
    esac
    return 1
}

if [ "$REQUEST_METHOD" != "POST" ] && [ "$REQUEST_METHOD" != "GET" ]; then
    lr_reply "405 Method Not Allowed" "laravel_rescue_method_invalid"
fi
if [ -n "${PATH_INFO:-}" ] || ! [[ "${QUERY_STRING:-}" =~ ^action=([a-z][a-z-]{0,31})$ ]]; then
    lr_reply "400 Bad Request" "laravel_rescue_action_invalid"
fi
LR_ACTION="${BASH_REMATCH[1]}"
if ! lr_word_in "$LR_ACTION" "$LR_ACTIONS $LR_READ_ACTIONS"; then
    lr_reply "400 Bad Request" "laravel_rescue_action_invalid"
fi

if [ -z "$LR_HDR_SIGNATURE" ] || [ -z "$LR_HDR_KEY_ID" ]; then
    lr_reply "401 Unauthorized" "client_key_missing"
fi
if [ "$LR_HDR_PROTOCOL" != "$LR_PROTOCOL" ] || ! lr_word_in "$LR_HDR_CLIENT" "$LR_CLIENTS" \
   || ! [[ "$LR_HDR_MACHINE_ID" =~ $LR_MACHINE_ID_PATTERN ]]; then
    lr_reply "401 Unauthorized" "client_key_protocol_invalid"
fi
LR_NOW="$(date +%s)"
if ! [[ "$LR_HDR_TIMESTAMP" =~ ^[0-9]{1,12}$ ]]; then
    lr_reply "401 Unauthorized" "client_key_timestamp_invalid"
fi
LR_TIMESTAMP=$(( 10#$LR_HDR_TIMESTAMP ))
if [ $(( LR_NOW - LR_TIMESTAMP )) -gt "$LR_CLOCK_SKEW" ] || [ $(( LR_TIMESTAMP - LR_NOW )) -gt "$LR_CLOCK_SKEW" ]; then
    lr_reply "401 Unauthorized" "client_key_timestamp_invalid"
fi
if ! [[ "$LR_HDR_NONCE" =~ $LR_NONCE_PATTERN ]]; then
    lr_reply "401 Unauthorized" "client_key_nonce_invalid"
fi

LR_BODY_SHA256="$(head -c "${CONTENT_LENGTH:-0}" | sha256sum | cut -d' ' -f1)"
if [ "$LR_HDR_CONTENT_SHA256" != "$LR_BODY_SHA256" ]; then
    lr_reply "401 Unauthorized" "client_key_body_digest_invalid"
fi

lr_sig_load_key "$LR_KEY_FILE" "$LR_KEY_ID_LENGTH"
if [ -z "$LR_SIG_KEY_ID" ]; then
    lr_reply "503 Service Unavailable" "client_key_missing"
fi
if [ "$LR_HDR_KEY_ID" != "$LR_SIG_KEY_ID" ]; then
    lr_reply "401 Unauthorized" "client_key_unknown"
fi
lr_sig_sign "$LR_CANONICAL_VERSION" "$LR_HDR_PROTOCOL" "$REQUEST_METHOD" "$SCRIPT_NAME" "$QUERY_STRING" \
    "$LR_HDR_CLIENT" "$LR_HDR_MACHINE_ID" "$LR_HDR_KEY_ID" "$LR_HDR_TIMESTAMP" "$LR_HDR_NONCE" "$LR_HDR_CONTENT_SHA256"
if [ -z "$LR_SIG_VALUE" ] || [ "$LR_SIG_VALUE" != "$LR_HDR_SIGNATURE" ]; then
    lr_reply "401 Unauthorized" "client_key_signature_invalid"
fi

find "$LR_NONCES_DIR" -maxdepth 1 -type f -mmin +$(( (LR_NONCE_TTL + 59) / 60 )) -delete 2>/dev/null
LR_NONCE_FILE="$LR_NONCES_DIR/$LR_HDR_KEY_ID.$LR_HDR_NONCE"
if [ -e "$LR_NONCE_FILE" ]; then
    lr_reply "401 Unauthorized" "client_key_nonce_replayed"
fi
if ! ( set -C; : > "$LR_NONCE_FILE" ) 2>/dev/null; then
    [ -e "$LR_NONCE_FILE" ] && lr_reply "401 Unauthorized" "client_key_nonce_replayed"
    lr_reply "500 Internal Server Error" "laravel_rescue_nonce_write_failed"
fi
lr_own "$LR_NONCE_FILE"

if [ "$LR_ACTION" = "services" ]; then
    lr_reply_services
fi
if lr_word_in "$LR_ACTION" "$LR_READ_ACTIONS"; then
    printf 'Status: 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\n\r\n'
    tail -n "$LR_STATUS_TAIL_LINES" "$LR_STATUS_FILE" 2>/dev/null
    exit 0
fi

LR_REQUEST_FILE="$LR_REQUESTS_DIR/$LR_NOW-$LR_HDR_NONCE.$LR_ACTION.request"
LR_REQUEST_TMP="$LR_REQUESTS_DIR/.$LR_NOW-$LR_HDR_NONCE.tmp"
printf 'action=%s\nclient=%s\nmachine_id=%s\nkey_id=%s\nremote_addr=%s\n' \
    "$LR_ACTION" "$LR_HDR_CLIENT" "$LR_HDR_MACHINE_ID" "$LR_HDR_KEY_ID" "${REMOTE_ADDR:-}" > "$LR_REQUEST_TMP" 2>/dev/null \
    && lr_own "$LR_REQUEST_TMP" && mv -f "$LR_REQUEST_TMP" "$LR_REQUEST_FILE" 2>/dev/null
if [ ! -f "$LR_REQUEST_FILE" ]; then
    rm -f "$LR_REQUEST_TMP" 2>/dev/null
    lr_reply "500 Internal Server Error" "laravel_rescue_request_write_failed"
fi
lr_reply "202 Accepted" "laravel_rescue_request_queued" ",\"action\":\"$LR_ACTION\",\"poll_seconds\":$LR_POLL_SECONDS"
