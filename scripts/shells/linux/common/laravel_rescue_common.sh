#!/bin/bash
# Laravel rescue plane, Linux only (config/service_contract.json#laravel_rescue):
# busybox httpd on ports.laravel_rescue_httpd serves one client_key_auth-signed CGI
# that only writes request files; the watcher unit polls them every poll_seconds,
# deletes each at once and runs its Laravel action (start/restart/sys:init/...).
# Every step probes its own state and repairs only what is missing or drifted.
#   bash laravel_rescue_common.sh httpd                    busybox + openssl + dirs + CGI + httpd unit
#   bash laravel_rescue_common.sh watcher                  httpd steps + watcher unit (LR_LARAVEL_* env)
#   bash laravel_rescue_common.sh request <action> [url]   signed client call (url default: loopback)

if [ "${BASH_SOURCE[0]}" != "${0}" ] && [ "${LARAVEL_RESCUE_COMMON_LOADED:-false}" = "true" ]; then
    return 0
fi
LARAVEL_RESCUE_COMMON_LOADED="true"

LR_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LR_SELF="$LR_COMMON_DIR/laravel_rescue_common.sh"
LR_LINUX_DIR="$(dirname "$LR_COMMON_DIR")"
LR_SIGNATURE_LIB="$LR_COMMON_DIR/laravel_rescue_signature.sh"
LR_CGI_SCRIPT="$LR_LINUX_DIR/debian/debian_com/laravel_rescue_cgi.sh"
LR_WATCHER_SCRIPT="$LR_LINUX_DIR/debian/debian_com/laravel_rescue_watcher.sh"
LR_BASH_BIN="/bin/bash"
LR_HTTPD_CPU="10%"
LR_HTTPD_MEM="32M"
LR_LOOPBACK_HOST="127.0.0.1"
LR_FIREWALL_COMMENT="core_node Laravel rescue httpd"
LR_HTTPD_DESC="core_node Laravel rescue httpd (busybox, signed CGI writes request files)"
LR_WATCHER_DESC="core_node Laravel rescue watcher (runs queued Laravel actions)"
LR_LARAVEL_DIR="${LR_LARAVEL_DIR:-}"
LR_LARAVEL_START_SCRIPT="${LR_LARAVEL_START_SCRIPT:-}"
LR_LARAVEL_SERVICE="${LR_LARAVEL_SERVICE:-}"
LR_READY="no"
LR_PORT=""
LR_HTTPD_SERVICE=""
LR_WATCHER_SERVICE=""
LR_ROOT_DIR=""
LR_DOCROOT=""
LR_CGI_DIR=""
LR_CGI_FILE=""
LR_CGI_NAME=""
LR_REQUESTS_DIR=""
LR_NONCES_DIR=""
LR_STATUS_FILE=""
LR_POLL_SECONDS=""
LR_ACTIONS=""
LR_READ_ACTIONS=""
LR_PROTOCOL=""
LR_CANONICAL_VERSION=""
LR_CLIENTS=""
LR_MACHINE_ID_PATTERN=""
LR_NONCE_PATTERN=""
LR_CLOCK_SKEW=""
LR_NONCE_TTL=""
LR_KEY_FILE=""
LR_OWNER=""
LR_GROUP=""
LR_BUSYBOX_BIN=""
LR_HTTPD_APPLET="no"
LR_OPENSSL_BIN=""
LR_SUDO=""

source "$LR_COMMON_DIR/gvar_common.sh"
source "$LR_COMMON_DIR/file_ops_common.sh"
source "$LR_COMMON_DIR/client_key_common.sh"
source "$LR_SIGNATURE_LIB"

lr_info() { echo "[LARAVEL_RESCUE] $*"; }
lr_warn() { echo -e "\033[33m[LARAVEL_RESCUE] $*\033[0m"; }

lr_systemd_available() {
    [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1
}

# Reads the contract into LR_*; LR_READY=yes only when every value resolved.
lr_load_contract() {
    LR_READY="no"
    client_key_load_contract
    LR_PORT="$(sc_get ports.laravel_rescue_httpd)"
    LR_HTTPD_SERVICE="$(sc_get laravel_rescue.httpd_service)"
    LR_WATCHER_SERVICE="$(sc_get laravel_rescue.watcher_service)"
    LR_ROOT_DIR="$CORE_NODE_DATA_DIR/$(sc_get laravel_rescue.root_subpath)"
    LR_DOCROOT="$CORE_NODE_DATA_DIR/$(sc_get laravel_rescue.docroot_subpath)"
    LR_REQUESTS_DIR="$CORE_NODE_DATA_DIR/$(sc_get laravel_rescue.requests_subpath)"
    LR_NONCES_DIR="$CORE_NODE_DATA_DIR/$(sc_get laravel_rescue.nonces_subpath)"
    LR_STATUS_FILE="$CORE_NODE_DATA_DIR/$(sc_get laravel_rescue.status_file_subpath)"
    LR_CGI_NAME="$(sc_get laravel_rescue.cgi_name)"
    LR_POLL_SECONDS="$(sc_get laravel_rescue.poll_seconds)"
    LR_ACTIONS="$(sc_get laravel_rescue.actions | tr ',' ' ')"
    LR_READ_ACTIONS="$(sc_get laravel_rescue.read_actions | tr ',' ' ')"
    LR_PROTOCOL="$(sc_get client_key_auth.protocol_version)"
    LR_CANONICAL_VERSION="$(sc_get client_key_auth.canonical_version)"
    LR_CLIENTS="$(sc_get client_key_auth.clients | tr ',' ' ')"
    LR_MACHINE_ID_PATTERN="$(sc_get client_key_auth.machine_id_pattern)"
    LR_NONCE_PATTERN="$(sc_get client_key_auth.nonce_pattern)"
    LR_CLOCK_SKEW="$(sc_get client_key_auth.clock_skew_seconds)"
    LR_NONCE_TTL="$(sc_get client_key_auth.nonce_ttl_seconds)"
    LR_CGI_DIR="$LR_DOCROOT/cgi-bin"
    LR_CGI_FILE="$LR_CGI_DIR/$LR_CGI_NAME"
    LR_KEY_FILE="$CLIENT_KEY_RAW_DIR/$CLIENT_KEY_NAME"
    if [ -z "$CORE_NODE_DATA_DIR" ] || [ -z "$LR_PORT" ] || [ -z "$LR_HTTPD_SERVICE" ] || [ -z "$LR_WATCHER_SERVICE" ] \
       || [ -z "$LR_CGI_NAME" ] || [ -z "$LR_POLL_SECONDS" ] || [ -z "$LR_ACTIONS" ] || [ -z "$LR_PROTOCOL" ] \
       || [ -z "$CLIENT_KEY_NAME" ] || [ -z "$CLIENT_KEY_ID_LENGTH" ]; then
        lr_warn "service contract unreadable (laravel_rescue / client_key_auth / CORE_NODE_DATA_DIR)"
        return 0
    fi
    LR_READY="yes"
}

lr_resolve_sudo() {
    LR_SUDO=""
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
        LR_SUDO="sudo"
    fi
}

lr_apt_install() {
    lr_info "installing apt package(s): $*"
    $LR_SUDO apt-get install -y "$@" || { $LR_SUDO apt-get update && $LR_SUDO apt-get install -y "$@"; }
}

lr_probe_busybox() {
    LR_BUSYBOX_BIN="$(command -v busybox 2>/dev/null)"
    [ -z "$LR_BUSYBOX_BIN" ] && [ -x /usr/bin/busybox ] && LR_BUSYBOX_BIN="/usr/bin/busybox"
    LR_HTTPD_APPLET="no"
    if [ -n "$LR_BUSYBOX_BIN" ] && "$LR_BUSYBOX_BIN" --list 2>/dev/null | grep -qx httpd; then
        LR_HTTPD_APPLET="yes"
    fi
}

lr_ensure_busybox() {
    lr_probe_busybox
    if [ "$LR_HTTPD_APPLET" = "yes" ]; then
        lr_info "busybox httpd present: $LR_BUSYBOX_BIN"
        return 0
    fi
    lr_apt_install busybox
    lr_probe_busybox
    if [ "$LR_HTTPD_APPLET" != "yes" ]; then
        lr_apt_install busybox-static
        lr_probe_busybox
    fi
    [ "$LR_HTTPD_APPLET" = "yes" ] && lr_info "busybox httpd installed: $LR_BUSYBOX_BIN" || lr_warn "busybox httpd applet still unavailable"
}

lr_ensure_openssl() {
    LR_OPENSSL_BIN="$(command -v openssl 2>/dev/null)"
    if [ -n "$LR_OPENSSL_BIN" ]; then
        return 0
    fi
    lr_apt_install openssl
    LR_OPENSSL_BIN="$(command -v openssl 2>/dev/null)"
    [ -n "$LR_OPENSSL_BIN" ] || lr_warn "openssl still unavailable; the CGI rejects every signature"
}

# Both units run as root; every rescue file is owned by the real (desktop)
# user so it stays accessible to that user (CGI and watcher re-apply it).
lr_resolve_owner() {
    resolve_active_permission_owner >/dev/null
    LR_OWNER="${ACTIVE_PERMISSION_USER:-root}"
    LR_GROUP="${ACTIVE_PERMISSION_GROUP:-$(id -gn "$LR_OWNER" 2>/dev/null)}"
}

# lr_ensure_dir <dir> <mode>: create, then fix owner and mode only on mismatch.
lr_ensure_dir() {
    local dir="$1"
    local mode="$2"

    [ -d "$dir" ] || $LR_SUDO mkdir -p "$dir"
    [ "$(stat -c '%U:%G' "$dir" 2>/dev/null)" = "$LR_OWNER:$LR_GROUP" ] || $LR_SUDO chown "$LR_OWNER:$LR_GROUP" "$dir"
    [ "$(stat -c '%a' "$dir" 2>/dev/null)" = "$mode" ] || $LR_SUDO chmod "$mode" "$dir"
}

lr_ensure_dirs() {
    lr_ensure_dir "$LR_ROOT_DIR" 755
    lr_ensure_dir "$LR_DOCROOT" 755
    lr_ensure_dir "$LR_CGI_DIR" 755
    lr_ensure_dir "$LR_REQUESTS_DIR" 700
    lr_ensure_dir "$LR_NONCES_DIR" 700
}

# The cgi-bin entry is a generated wrapper carrying the contract values, so a
# request never loads the contract/gvar stack; it is rewritten only on drift.
lr_ensure_cgi() {
    write_file_if_changed "$LR_CGI_FILE" "" 755 "$LR_OWNER" "$LR_GROUP" <<EOF
#!/bin/sh
export LR_SIGNATURE_LIB='$LR_SIGNATURE_LIB'
export LR_KEY_FILE='$LR_KEY_FILE'
export LR_KEY_ID_LENGTH='$CLIENT_KEY_ID_LENGTH'
export LR_CANONICAL_VERSION='$LR_CANONICAL_VERSION'
export LR_PROTOCOL='$LR_PROTOCOL'
export LR_CLIENTS='$LR_CLIENTS'
export LR_MACHINE_ID_PATTERN='$LR_MACHINE_ID_PATTERN'
export LR_NONCE_PATTERN='$LR_NONCE_PATTERN'
export LR_CLOCK_SKEW='$LR_CLOCK_SKEW'
export LR_NONCE_TTL='$LR_NONCE_TTL'
export LR_ACTIONS='$LR_ACTIONS'
export LR_READ_ACTIONS='$LR_READ_ACTIONS'
export LR_REQUESTS_DIR='$LR_REQUESTS_DIR'
export LR_NONCES_DIR='$LR_NONCES_DIR'
export LR_STATUS_FILE='$LR_STATUS_FILE'
export LR_POLL_SECONDS='$LR_POLL_SECONDS'
export LR_OWNER='$LR_OWNER'
export LR_GROUP='$LR_GROUP'
exec $LR_BASH_BIN '$LR_CGI_SCRIPT'
EOF
}

# Root only: converge_systemd_service rewrites/enables/starts/restarts on drift.
lr_converge_unit() {
    (
        source "$LR_COMMON_DIR/systemd_service_manager.sh"
        converge_systemd_service "$@"
    )
}

lr_ensure_httpd_unit() {
    lr_converge_unit "$LR_HTTPD_SERVICE" "$LR_HTTPD_DESC" \
        "$LR_BUSYBOX_BIN httpd -f -p $LR_PORT -h $LR_DOCROOT" "$LR_DOCROOT" root always 5s "$LR_HTTPD_CPU" "$LR_HTTPD_MEM"
}

lr_ensure_watcher_unit() {
    lr_converge_unit "$LR_WATCHER_SERVICE" "$LR_WATCHER_DESC" \
        "LR_ROOT_DIR=$LR_ROOT_DIR LR_OWNER=$LR_OWNER LR_GROUP=$LR_GROUP LR_REQUESTS_DIR=$LR_REQUESTS_DIR LR_STATUS_FILE=$LR_STATUS_FILE LR_POLL_SECONDS=$LR_POLL_SECONDS LR_ACTIONS=${LR_ACTIONS// /,} LR_LARAVEL_DIR=$LR_LARAVEL_DIR LR_LARAVEL_START_SCRIPT=$LR_LARAVEL_START_SCRIPT LR_LARAVEL_SERVICE=${LR_LARAVEL_SERVICE:-none} $LR_BASH_BIN $LR_WATCHER_SCRIPT" \
        "$LR_LARAVEL_DIR" root always 10s "" "" "" "" "" interactive
}

# Shared firewall_manager probe (UFW > firewalld > iptables; never installs one).
lr_ensure_firewall() {
    (
        source "$LR_COMMON_DIR/firewall_manager.sh"
        firewall_allow_port "$LR_PORT" tcp "$LR_FIREWALL_COMMENT"
    ) || lr_warn "firewall rule for port $LR_PORT/tcp not confirmed"
}

lr_report_listening() {
    if ss -ltnH "sport = :$LR_PORT" 2>/dev/null | grep -q .; then
        lr_info "httpd listening on port $LR_PORT ($LR_HTTPD_SERVICE)"
    else
        lr_warn "port $LR_PORT is not listening yet; inspect: journalctl -u $LR_HTTPD_SERVICE -n 50"
    fi
}

# Root part of the httpd/watcher modes (re-entered through sudo when needed).
lr_converge_root() {
    local mode="$1"

    lr_ensure_httpd_unit
    lr_ensure_firewall
    if [ "$mode" = "watcher" ]; then
        lr_ensure_watcher_unit
    fi
    lr_report_listening
}

# lr_ensure <httpd|watcher>
lr_ensure() {
    local mode="$1"

    lr_load_contract
    [ "$LR_READY" = "yes" ] || return 0
    if ! lr_systemd_available; then
        lr_warn "systemd is not the active init; rescue services skipped"
        return 0
    fi
    if [ "$mode" = "watcher" ] && { [ -z "$LR_LARAVEL_DIR" ] || [ -z "$LR_LARAVEL_START_SCRIPT" ]; }; then
        lr_warn "watcher needs LR_LARAVEL_DIR and LR_LARAVEL_START_SCRIPT; installing httpd only"
        mode="httpd"
    fi
    lr_resolve_sudo
    if [ "$(id -u)" -ne 0 ] && [ -z "$LR_SUDO" ]; then
        lr_warn "root or sudo required to register $LR_HTTPD_SERVICE"
        return 0
    fi
    lr_ensure_busybox
    [ "$LR_HTTPD_APPLET" = "yes" ] || return 0
    lr_ensure_openssl
    lr_resolve_owner
    lr_ensure_dirs
    lr_ensure_cgi
    if [ "$(id -u)" -eq 0 ]; then
        lr_converge_root "$mode"
    else
        $LR_SUDO env LR_LARAVEL_DIR="$LR_LARAVEL_DIR" LR_LARAVEL_START_SCRIPT="$LR_LARAVEL_START_SCRIPT" \
            LR_LARAVEL_SERVICE="$LR_LARAVEL_SERVICE" "$LR_BASH_BIN" "$LR_SELF" "$mode"
    fi
}

# lr_request <action> [base_url]: signed call as client "shell"; prints the response.
lr_request() {
    local action="$1"
    local base_url="${2:-}"
    local path=""
    local query="action=$action"
    local machine_id=""
    local timestamp=""
    local nonce=""

    lr_load_contract
    [ "$LR_READY" = "yes" ] || return 0
    lr_sig_load_key "$LR_KEY_FILE" "$CLIENT_KEY_ID_LENGTH"
    if [ -z "$LR_SIG_KEY_ID" ]; then
        lr_warn "$CLIENT_KEY_NAME is not readable in $CLIENT_KEY_RAW_DIR"
        return 0
    fi
    [ -n "$base_url" ] || base_url="http://$LR_LOOPBACK_HOST:$LR_PORT"
    path="/cgi-bin/$LR_CGI_NAME"
    machine_id="$(cat /etc/machine-id 2>/dev/null | sha256sum | cut -c1-16)"
    timestamp="$(date +%s)"
    nonce="$(head -c 24 /dev/urandom | base64 -w 0 | tr '+/' '-_' | tr -d '=')"
    lr_sig_sign "$LR_CANONICAL_VERSION" "$LR_PROTOCOL" POST "$path" "$query" shell "$machine_id" \
        "$LR_SIG_KEY_ID" "$timestamp" "$nonce" "$LR_SIG_EMPTY_SHA256"
    curl -sS -X POST --data-binary '' \
        -H "X-Core-Node-Protocol: $LR_PROTOCOL" -H "X-Core-Node-Client: shell" \
        -H "X-Core-Node-Machine-ID: $machine_id" -H "X-Core-Node-Key-ID: $LR_SIG_KEY_ID" \
        -H "X-Core-Node-Timestamp: $timestamp" -H "X-Core-Node-Nonce: $nonce" \
        -H "X-Core-Node-Content-SHA256: $LR_SIG_EMPTY_SHA256" -H "X-Core-Node-Signature: $LR_SIG_VALUE" \
        "$base_url$path?$query"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    case "${1:-}" in
        httpd|watcher)
            lr_ensure "$1"
            ;;
        request)
            lr_request "${2:-status}" "${3:-}"
            ;;
        *)
            echo "Usage: bash laravel_rescue_common.sh httpd | watcher | request <action> [base_url]"
            ;;
    esac
fi
