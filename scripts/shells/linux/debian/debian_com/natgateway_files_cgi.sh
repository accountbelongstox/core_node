#!/bin/bash
# Signed, time-limited download of the network router device files
# (apps/network_router) through the rescue httpd: GET
# /cgi-bin/network_router?path=<file>&exp=<epoch>&sig=<base64url>, where sig is
# the client_key_auth HMAC (CORE_NODE_CLIENT_KEY_1) of
# NATGW_FILES_CANONICAL, path and exp. `natgateway openwrt` issues the links,
# so a router fetches a file with plain wget and never sees the key.
# Env (from the generated cgi-bin wrapper): LR_SIGNATURE_LIB, NATGW_FILES_ROOT,
# NATGW_FILES_KEY_FILE, NATGW_FILES_KEY_ID_LENGTH, NATGW_FILES_CANONICAL,
# NATGW_FILES_MAX_TTL.

source "$LR_SIGNATURE_LIB"

FILES_PATH=""
FILES_EXP=""
FILES_SIG=""
FILES_TARGET=""
FILES_NOW="$(date +%s)"

files_reply() {
    printf 'Status: %s\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\n\r\n%s\n' "$1" "$2"
    exit 0
}

[ "$REQUEST_METHOD" = "GET" ] || files_reply "405 Method Not Allowed" "GET only"
[[ "${QUERY_STRING:-}" =~ ^path=([A-Za-z0-9_][A-Za-z0-9_./-]{0,200})\&exp=([0-9]{1,12})\&sig=([A-Za-z0-9_-]{20,128})$ ]] \
    || files_reply "400 Bad Request" "expected path=<file>&exp=<epoch>&sig=<signature>"
FILES_PATH="${BASH_REMATCH[1]}"
FILES_EXP="${BASH_REMATCH[2]}"
FILES_SIG="${BASH_REMATCH[3]}"
[[ "$FILES_PATH" != *..* ]] || files_reply "400 Bad Request" "invalid path"
[ "$FILES_EXP" -ge "$FILES_NOW" ] || files_reply "403 Forbidden" "link expired"
[ $((FILES_EXP - FILES_NOW)) -le "$NATGW_FILES_MAX_TTL" ] || files_reply "403 Forbidden" "link lifetime too long"

lr_sig_load_key "$NATGW_FILES_KEY_FILE" "$NATGW_FILES_KEY_ID_LENGTH"
[ -n "$LR_SIG_KEY_HEX" ] || files_reply "503 Service Unavailable" "client key unavailable"
lr_sig_sign "$NATGW_FILES_CANONICAL" "$FILES_PATH" "$FILES_EXP"
[ -n "$LR_SIG_VALUE" ] && [ "$LR_SIG_VALUE" = "$FILES_SIG" ] || files_reply "401 Unauthorized" "bad signature"

FILES_TARGET="$(readlink -f "$NATGW_FILES_ROOT/$FILES_PATH" 2>/dev/null)"
case "$FILES_TARGET" in
    "$(readlink -f "$NATGW_FILES_ROOT")"/*) ;;
    *) files_reply "404 Not Found" "no such file" ;;
esac
[ -f "$FILES_TARGET" ] || files_reply "404 Not Found" "no such file"
printf 'Status: 200 OK\r\nContent-Type: application/octet-stream\r\nCache-Control: no-store\r\n\r\n'
cat "$FILES_TARGET"
