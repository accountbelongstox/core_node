#!/bin/bash

# CodeMart start/deploy (Linux/Debian). Chains ONLY existing idempotent tools; nothing is reimplemented:
#   1. backend  - laravel_main via FrankenPHP: 175_laravel_main_start.sh when not deployed/healthy,
#                 otherwise data init only (sys:init, sys:codemartinit, codemart:admin-password) + workers restart
#   2. UI       - ncore-nexus-dash on ports.nexus_dash_frontend (175 --ui-service) when not listening
#   3. device   - scripts/start_build.sh --adb-* (pair/connect/mDNS + LAN and random-port scan; the scan also
#                 runs with a device online unless --no-scan or --target/--pair-code is given)
#   4. app      - scripts/start_build.sh --app codemart (debug APK build + adb install) when a device is online,
#                 then live_debug.py attach --no-follow (launch + log collection)
#   5. web      - MagicDNS URLs (mesh/tailscale helpers), curl-verified, xdg-open only with a display
# Windows twin: start.ps1 (same flags).
#
# Usage: start.sh [--no-app] [--no-scan] [--target IP[:PORT]] [--pair-code CODE] [--non-interactive] [-h]

# --- All variables and file references (declared at top) ---
ORIGINAL_DIR=$(pwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLAVORS_DIR="$(dirname "$SCRIPT_DIR")"
APP_ROOT="$(dirname "$FLAVORS_DIR")"
POLY_APPS_DIR="$(dirname "$APP_ROOT")"
REPO_ROOT="$(dirname "$POLY_APPS_DIR")"
LARAVEL_DIR="${POLY_APPS_DIR}/laravel_main"
LINUX_SHELLS_DIR="${REPO_ROOT}/scripts/shells/linux"
COMMON_DIR="${LINUX_SHELLS_DIR}/common"
INSTALL_SHELLS_DIR="${LINUX_SHELLS_DIR}/debian/install_shells"
STEP_LARAVEL_MAIN="${INSTALL_SHELLS_DIR}/175_laravel_main_start.sh"
START_BUILD_SCRIPT="${APP_ROOT}/scripts/start_build.sh"
LIVE_DEBUG_SCRIPT="${APP_ROOT}/scripts/flavor/live_debug.py"
SERVICE_CONTRACT_COMMON="${COMMON_DIR}/service_contract_common.sh"
FRANKENPHP_DOMAIN_COMMON="${COMMON_DIR}/frankenphp_domain_common.sh"
TAILSCALE_COMMON="${COMMON_DIR}/tailscale_common.sh"
MESH_COMMON="${COMMON_DIR}/mesh_common.sh"
FLAVOR_ID="codemart"
BACKEND_UNIT="ncore-laravel-frankenphp"
UI_UNIT="ncore-nexus-dash"
UI_ROUTE="/codemart"
API_HOME_PATH="/api/codemart/v1/public/home"
LOOPBACK="127.0.0.1"
READY_TRIES=40
READY_INTERVAL=3

NO_APP=""
NO_SCAN=""
TARGET=""
PAIR_CODE=""
NON_INTERACTIVE=""
HELP_REQUESTED=""
ARG_ERROR=""

BACKEND_PORT=""
UI_PORT=""
SECRET_FILE_REL=""
SECRET_FILE=""
PHP_BIN=""
ADB_BIN=""
PYTHON_BIN=""
ONLINE_SERIAL=""
HARDWARE_SERIALS=""
HARDWARE_SERIAL=""
HOST_DNS=""
WEB_URL=""
API_URL=""
ONLINE_COUNT=0
HTTP_CODE=""
BACKEND_HEALTHY="no"
STATUS_NAMES=(backend init ui device app web)
STATUS_backend="SKIP"
STATUS_init="SKIP"
STATUS_ui="SKIP"
STATUS_device="SKIP"
STATUS_app="SKIP"
STATUS_web="SKIP"
NOTE_backend=""
NOTE_init=""
NOTE_ui=""
NOTE_device=""
NOTE_app=""
NOTE_web=""
FAILED="no"

log() { printf '[codemart] %s\n' "$*"; }
warn() { printf '[codemart] WARN: %s\n' "$*" >&2; }
err() { printf '[codemart] ERROR: %s\n' "$*" >&2; }

# record <step> <OK|WARN|FAIL> <note>
record() {
    printf -v "STATUS_$1" '%s' "$2"
    printf -v "NOTE_$1" '%s' "$3"
    if [ "$2" = "FAIL" ]; then FAILED="yes"; fi
}

print_usage() {
    echo "Usage: bash ${BASH_SOURCE[0]} [options]"
    echo ""
    echo "Options:"
    echo "  --no-app             Skip the APK build/install."
    echo "  --no-scan            Skip the device scan (a given --target/--pair-code still applies)."
    echo "  --target IP[:PORT]   adb target to connect to."
    echo "  --pair-code CODE     Wireless-debugging pairing code (pair before connecting)."
    echo "  --non-interactive    Never prompt."
    echo "  -h, --help           Show this help message and exit."
}

parse_args() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            --no-app) NO_APP=1 ;;
            --no-scan) NO_SCAN=1 ;;
            --non-interactive) NON_INTERACTIVE=1 ;;
            --target)
                shift
                if [ "$#" -eq 0 ]; then ARG_ERROR="--target requires a value (IP[:PORT])."; return; fi
                TARGET="$1"
                ;;
            --target=*) TARGET="${1#*=}" ;;
            --pair-code)
                shift
                if [ "$#" -eq 0 ]; then ARG_ERROR="--pair-code requires a value."; return; fi
                PAIR_CODE="$1"
                ;;
            --pair-code=*) PAIR_CODE="${1#*=}" ;;
            -h|--help) HELP_REQUESTED=1 ;;
            *) ARG_ERROR="Unknown option: $1"; return ;;
        esac
        shift
    done
}

port_listening() {
    ss -ltn 2>/dev/null | awk -v p=":$1" '$4 ~ p"$" {found=1} END {exit !found}'
}

# Sets HTTP_CODE (000 when unreachable).
http_code() {
    HTTP_CODE="$(curl -sS -o /dev/null -m 15 -w '%{http_code}' "$1" 2>/dev/null)"
    [ -n "$HTTP_CODE" ] || HTTP_CODE="000"
}

# Waits until the URL answers 200; leaves the last code in HTTP_CODE.
wait_http_ok() {
    local url="$1"
    local attempt=0
    while [ "$attempt" -lt "$READY_TRIES" ]; do
        http_code "$url"
        if [ "$HTTP_CODE" = "200" ]; then return; fi
        attempt=$((attempt + 1))
        sleep "$READY_INTERVAL"
    done
}

unit_active() {
    systemctl is-active --quiet "$1" 2>/dev/null
}

load_contract() {
    if [ ! -f "$SERVICE_CONTRACT_COMMON" ]; then
        err "service contract library missing: $SERVICE_CONTRACT_COMMON"
        return
    fi
    # shellcheck source=/dev/null
    source "$SERVICE_CONTRACT_COMMON" >/dev/null 2>&1
    BACKEND_PORT="$(sc_get ports.laravel_api_backend)"
    UI_PORT="$(sc_get ports.nexus_dash_frontend)"
    SECRET_FILE_REL="$(sc_get codemart_admin_password.secret_file)"
}

# --- 1. backend ---
backend_healthy() {
    BACKEND_HEALTHY="no"
    if ! unit_active "$BACKEND_UNIT" || ! port_listening "$BACKEND_PORT"; then return; fi
    http_code "http://${LOOPBACK}:${BACKEND_PORT}${API_HOME_PATH}"
    if [ "$HTTP_CODE" = "200" ]; then BACKEND_HEALTHY="yes"; fi
}

step_backend() {
    log "=== 1. Backend (laravel_main, FrankenPHP, port ${BACKEND_PORT}) ==="
    backend_healthy
    if [ "$BACKEND_HEALTHY" = "yes" ]; then
        log "Backend already deployed and serving ${API_HOME_PATH}: running data initialization only."
        record backend OK "already running on :${BACKEND_PORT}"
        return
    fi
    log "Backend not healthy (unit/port/API check, last code ${HTTP_CODE}): running ${STEP_LARAVEL_MAIN}"
    CODEMART_INIT=yes AS_SERVICE=yes INCLUDE_UI=no bash "$STEP_LARAVEL_MAIN" --service --no-ui
    wait_http_ok "http://${LOOPBACK}:${BACKEND_PORT}${API_HOME_PATH}"
    if [ "$HTTP_CODE" = "200" ]; then
        record backend OK "deployed by 175, API home 200"
        record init OK "run by 175 (sys:init + sys:codemartinit)"
    else
        record backend FAIL "175 finished but ${API_HOME_PATH} answers ${HTTP_CODE}"
    fi
}

# --- 1b. data initialization (backend already running) ---
resolve_secret_file() {
    SECRET_FILE=""
    if [ -z "$SECRET_FILE_REL" ] || [ ! -x "$PHP_BIN" ]; then return; fi
    SECRET_FILE="$(cd "$LARAVEL_DIR" && CM_ARG_SECRET="$SECRET_FILE_REL" "$PHP_BIN" -r 'require "vendor/autoload.php"; require "bootstrap/app.php"; echo \App\Providers\PathMapper::getLaravelDatabaseDir(getenv("CM_ARG_SECRET"));' 2>/dev/null)"
}

step_init() {
    local init_ok="yes"
    local note=""
    log "=== 1b. CodeMart data initialization ==="
    if [ "$STATUS_init" = "OK" ]; then
        log "Already initialized by 175."
        return
    fi
    if [ "$STATUS_backend" != "OK" ]; then
        record init WARN "skipped: backend is not up"
        return
    fi
    PHP_BIN="$(command -v php 2>/dev/null)"
    if [ -z "$PHP_BIN" ]; then
        record init FAIL "php (FrankenPHP php-cli link) not found"
        return
    fi
    cd "$LARAVEL_DIR" || { record init FAIL "cannot enter ${LARAVEL_DIR}"; return; }
    "$PHP_BIN" artisan sys:init || init_ok="no"
    if [ "$init_ok" = "yes" ]; then
        "$PHP_BIN" artisan sys:codemartinit || init_ok="no"
    fi
    if [ "$init_ok" = "yes" ]; then
        resolve_secret_file
        if [ -n "$SECRET_FILE" ] && [ -f "$SECRET_FILE" ]; then
            "$PHP_BIN" artisan codemart:admin-password --file "$SECRET_FILE" || init_ok="no"
            note="password file ${SECRET_FILE}"
        else
            warn "CodeMart secret password file not found (${SECRET_FILE:-unresolved}); sys:codemartinit creates it."
            note="no password file"
        fi
    fi
    cd "$ORIGINAL_DIR" || true
    if [ "$init_ok" != "yes" ]; then
        record init FAIL "artisan initialization failed"
        return
    fi
    if [ -f "$FRANKENPHP_DOMAIN_COMMON" ]; then
        ( source "$FRANKENPHP_DOMAIN_COMMON" >/dev/null 2>&1; fm_domain_workers_restart )
    fi
    record init OK "${note}; workers restarted"
}

# --- 2. UI ---
step_ui() {
    log "=== 2. UI (nexus-dash, port ${UI_PORT}) ==="
    if port_listening "$UI_PORT" && unit_active "$UI_UNIT"; then
        record ui OK "already listening on :${UI_PORT}"
        return
    fi
    log "UI not listening: converging ${UI_UNIT} via ${STEP_LARAVEL_MAIN} --ui-service"
    bash "$STEP_LARAVEL_MAIN" --ui-service --dev
    wait_http_ok "http://${LOOPBACK}:${UI_PORT}${UI_ROUTE}"
    if [ "$HTTP_CODE" = "200" ]; then
        record ui OK "started ${UI_UNIT}"
    else
        record ui FAIL "${UI_UNIT} up but ${UI_ROUTE} answers ${HTTP_CODE}"
    fi
}

# --- 3. device ---
resolve_adb() {
    ADB_BIN=""
    if [ -x /usr/bin/adb ]; then ADB_BIN=/usr/bin/adb; else ADB_BIN="$(command -v adb 2>/dev/null)"; fi
}

# Counts physical devices: the same phone listed by IP and by mDNS serial is one device (ro.serialno).
count_online() {
    ONLINE_COUNT=0
    HARDWARE_SERIALS=""
    resolve_adb
    if [ -z "$ADB_BIN" ]; then return; fi
    for ONLINE_SERIAL in $("$ADB_BIN" devices 2>/dev/null | awk 'NR > 1 && $2 == "device" {print $1}'); do
        HARDWARE_SERIAL="$("$ADB_BIN" -s "$ONLINE_SERIAL" shell getprop ro.serialno 2>/dev/null | tr -d '\r\n ')"
        [ -n "$HARDWARE_SERIAL" ] || HARDWARE_SERIAL="$ONLINE_SERIAL"
        case " $HARDWARE_SERIALS " in
            *" $HARDWARE_SERIAL "*) ;;
            *) HARDWARE_SERIALS="${HARDWARE_SERIALS:+$HARDWARE_SERIALS }$HARDWARE_SERIAL"; ONLINE_COUNT=$((ONLINE_COUNT + 1)) ;;
        esac
    done
}

start_build_device() {
    local args=("$@")
    [ -n "$NON_INTERACTIVE" ] && args+=(--non-interactive)
    bash "$START_BUILD_SCRIPT" --app "$FLAVOR_ID" "${args[@]}"
}

step_device() {
    local pair_args=()
    log "=== 3. Device ==="
    count_online
    if [ "$ONLINE_COUNT" -eq 0 ] && { [ -n "$TARGET" ] || [ -n "$PAIR_CODE" ]; }; then
        [ -n "$PAIR_CODE" ] && pair_args+=(--adb-pair-code "$PAIR_CODE")
        [ -n "$PAIR_CODE" ] && [ -n "$TARGET" ] && pair_args+=(--adb-pair "$TARGET")
        [ -n "$TARGET" ] && pair_args+=(--adb-connect "$TARGET")
        start_build_device "${pair_args[@]}"
        count_online
    fi
    if [ -z "$NO_SCAN" ] && [ -z "$TARGET" ] && [ -z "$PAIR_CODE" ]; then
        start_build_device --adb-scan
        count_online
    elif [ "$ONLINE_COUNT" -eq 0 ] && [ -z "$NO_SCAN" ]; then
        start_build_device --adb-scan
        count_online
    fi
    if [ "$ONLINE_COUNT" -gt 0 ]; then
        record device OK "${ONLINE_COUNT} adb device(s) online"
    elif [ -n "$NO_SCAN" ] && [ -z "$TARGET" ] && [ -z "$PAIR_CODE" ]; then
        record device WARN "scan skipped (--no-scan); no device online"
    else
        record device WARN "no adb device found"
    fi
}

# --- 4. app ---
step_app() {
    log "=== 4. App (CodeMart debug APK) ==="
    if [ -n "$NO_APP" ]; then
        record app WARN "skipped (--no-app)"
        return
    fi
    count_online
    if [ "$ONLINE_COUNT" -eq 0 ]; then
        record app WARN "skipped: no device online"
        return
    fi
    if ! start_build_device --debug-apk; then
        record app FAIL "start_build.sh failed"
        return
    fi
    PYTHON_BIN="$(command -v python3 2>/dev/null)"
    if [ -n "$PYTHON_BIN" ] && "$PYTHON_BIN" "$LIVE_DEBUG_SCRIPT" attach --root "$APP_ROOT" --adb "$ADB_BIN" --app "$FLAVOR_ID" --no-follow --non-interactive; then
        record app OK "debug APK installed and launched on ${ONLINE_COUNT} device(s)"
    else
        record app WARN "APK installed on ${ONLINE_COUNT} device(s); launch/attach failed"
    fi
}

# --- 5. web ---
step_web() {
    local web_ok="yes"
    local notes=""
    log "=== 5. Web ==="
    # shellcheck source=/dev/null
    [ -f "$TAILSCALE_COMMON" ] && source "$TAILSCALE_COMMON" >/dev/null 2>&1
    # shellcheck source=/dev/null
    [ -f "$MESH_COMMON" ] && source "$MESH_COMMON" >/dev/null 2>&1
    if declare -F ts_self_dnsname >/dev/null 2>&1; then HOST_DNS="$(ts_self_dnsname)"; fi
    if [ -z "$HOST_DNS" ] && declare -F mesh_domain >/dev/null 2>&1; then
        HOST_DNS="$(hostname -s).$(mesh_domain)"
    fi
    if [ -z "$HOST_DNS" ]; then
        record web WARN "MagicDNS name unresolved (tailscale not connected); using ${LOOPBACK}"
        HOST_DNS="$LOOPBACK"
    fi
    WEB_URL="http://${HOST_DNS}:${UI_PORT}${UI_ROUTE}"
    API_URL="http://${HOST_DNS}:${BACKEND_PORT}${API_HOME_PATH}"
    http_code "$WEB_URL"
    notes="web ${HTTP_CODE}"
    [ "$HTTP_CODE" = "200" ] || web_ok="no"
    http_code "$API_URL"
    notes="${notes}, api ${HTTP_CODE}"
    [ "$HTTP_CODE" = "200" ] || web_ok="no"
    if [ "$web_ok" = "yes" ]; then
        if [ "$HOST_DNS" = "$LOOPBACK" ]; then record web WARN "$notes (loopback only)"; else record web OK "$notes"; fi
    else
        record web FAIL "$notes"
    fi
    log "Web: ${WEB_URL}"
    log "API: ${API_URL}"
    if [ "$web_ok" = "yes" ] && [ -z "$NON_INTERACTIVE" ] && { [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; } && command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$WEB_URL" >/dev/null 2>&1 &
    fi
}

print_summary() {
    local name=""
    local status_ref=""
    local note_ref=""
    log "=== Summary ==="
    for name in "${STATUS_NAMES[@]}"; do
        status_ref="STATUS_${name}"
        note_ref="NOTE_${name}"
        printf '  %-8s %-5s %s\n' "$name" "${!status_ref}" "${!note_ref}"
    done
    log "Web URL: ${WEB_URL:-n/a}"
    log "API URL: ${API_URL:-n/a}"
}

parse_args "$@"
if [ -n "$ARG_ERROR" ]; then
    err "$ARG_ERROR"
    print_usage
    FAILED="yes"
elif [ -n "$HELP_REQUESTED" ]; then
    print_usage
else
    load_contract
    if [ -z "$BACKEND_PORT" ] || [ -z "$UI_PORT" ]; then
        err "service contract unreadable (ports.laravel_api_backend / ports.nexus_dash_frontend empty)."
        FAILED="yes"
    else
        step_backend
        step_init
        step_ui
        step_device
        step_app
        step_web
        print_summary
    fi
fi

cd "$ORIGINAL_DIR" || true
if [ "$FAILED" = "yes" ]; then
    exit 1
fi
exit 0
