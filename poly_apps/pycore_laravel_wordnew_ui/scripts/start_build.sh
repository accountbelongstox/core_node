#!/bin/bash

# Capacitor native build entry (Linux/Debian; incl. WSL) for pycore_laravel_wordnew_ui.
# This script IMPLEMENTS NO INSTALLATION: every prerequisite repair is delegated to
# the idempotent installer steps referenced by FULL PATH (dd.sh install_shells menu):
#   17_install_node_toolchain_26.sh - node + bun
#   13_ensure_python.sh          - python
#   92_install_java.sh           - JDK 21 (Temurin -> COMPILE_DIR/java + /etc/environment)
#   187_install_android_sdk.sh   - cmdline-tools + licenses + platform-tools +
#                                  platforms;android-36 + build-tools;36.0.0
# (each step is per-detail idempotent: every component is gated by binary existence)
# Flow control here uses NO exit codes and NO install functions: progress is judged
# purely by BINARY EXISTENCE. Toolchain constants and JDK/SDK detectors are
# CENTRALIZED in scripts/shells/linux/common/android_build_env.sh (shared with the
# dd step; it loads the dd constants from gvar_common.sh). install_* mutators are
# void. The script has ONE exit point. Then it delegates the flavor selection +
# web build + `cap sync` + Gradle APK assembly to scripts/flavor/build_apk.py
# (single build truth). HTTPS_PROXY/HTTP_PROXY -> JAVA_TOOL_OPTIONS passthrough.
#
# Run from repo: ./poly_apps/pycore_laravel_wordnew_ui/scripts/start_build.sh
#   Select + debug:    ./start_build.sh            (menu: build APK / ADB wireless debugging)
#   Non-interactive:   ./start_build.sh --app wordnew --release-apk --non-interactive
#   List sub-apps:     ./start_build.sh --list
#   Device menu:       ./start_build.sh --adb-menu
#   Pair (Android 11+):./start_build.sh --adb-pair <IP:PAIR_PORT> [--adb-pair-code <CODE>]
#   Connect:           ./start_build.sh --adb-connect <IP[:PORT]>
#   LAN auto-scan:     ./start_build.sh --adb-scan   (mDNS + subnet probe, connect + authorize)
#   Build + install:   ./start_build.sh --adb-install (builds an APK first when none exists)
# ADB wireless device debugging follows the official Android adb docs
# (developer.android.com/tools/adb): pair ONCE with `adb pair` (pairing code from
# Wireless debugging -> Pair using pairing code), then `adb connect`; legacy
# devices use USB + `adb tcpip 5555` + `adb connect`. The adb binary itself is
# provisioned idempotently by the dd step 187_install_android_sdk.sh
# (platform-tools binary gate) - this script implements no installation.

# --- All variables and file references (declared at top) ---
ORIGINAL_DIR=$(pwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
POLY_APPS_DIR="$(cd "${APP_ROOT}/.." && pwd)"
REPO_ROOT="$(cd "${POLY_APPS_DIR}/.." && pwd)"
BUILD_APK_SCRIPT="${SCRIPT_DIR}/flavor/build_apk.py"
# dd idempotent steps + central library (FULL PATHS from the dd directory layout)
LINUX_SHELLS_DIR="${REPO_ROOT}/scripts/shells/linux"
STEP_NODE="${LINUX_SHELLS_DIR}/debian/install_shells/17_install_node_toolchain_26.sh"
STEP_PYTHON="${LINUX_SHELLS_DIR}/debian/install_shells/13_ensure_python.sh"
STEP_JAVA="${LINUX_SHELLS_DIR}/debian/install_shells/92_install_java.sh"
STEP_ANDROID_SDK="${LINUX_SHELLS_DIR}/debian/install_shells/187_install_android_sdk.sh"
ANDROID_BUILD_ENV="${LINUX_SHELLS_DIR}/common/android_build_env.sh"
GVDIR="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
PACKAGE_JSON="${APP_ROOT}/package.json"
NODE_MODULES="${APP_ROOT}/node_modules"
VITE_BIN="${APP_ROOT}/node_modules/vite/bin/vite.js"
# Args / state
PLATFORM="android"
APK_APP=""
APK_BUILD_TYPE="ask"
LIST_APPS=""
SKIP_ASSETS=""
CLEAN_APK=""
OPEN_OUTPUT=""
NON_INTERACTIVE=""
FORCE_INSTALL=""
ARG=""
BUILD_ARGS=()
SUDO=""
PYTHON_BIN=""
READY=1
BUILD_OK=0
# ADB wireless device debugging mode (variables declared at top)
DEVICE_MODE=""
USER_QUIT=""
MODE_CHOICE=""
ADB_BIN=""
ADB_MENU=""
ADB_PAIR_TARGET=""
ADB_PAIR_CODE=""
ADB_CONNECT_TARGET=""
ADB_DISCONNECT_TARGET=""
ADB_TCPIP_PORT=""
ADB_INSTALL=""
ADB_INSTALL_PATH=""
ADB_LIST=""
ADB_SCAN=""
ADB_SCAN_FOUND=0
BUILD_FOR_INSTALL=""
ADB_DEFAULT_PORT=5555

# Central dd library: constants (CORE_NODE_CACHE_DIR via gvar_common.sh) + detectors
# shellcheck disable=SC1090
source "${ANDROID_BUILD_ENV}"

# Restore initial directory on any exit (normal, error, Ctrl+C)
trap 'cd "$ORIGINAL_DIR" 2>/dev/null || true' EXIT

log()  { printf '[nexus-build] %s\n' "$1"; }
warn() { printf '[nexus-build] %s\n' "$1"; }
err()  { printf '[nexus-build] %s\n' "$1" >&2; }

# ---------- Project-scoped binary-existence gates ----------

test_python_ready() { command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; }

test_bun_ready() { command -v bun >/dev/null 2>&1; }

test_vite_ready() { [ -f "$VITE_BIN" ]; }

# ---------- Delegation: void invocations of the dd idempotent steps ----------

invoke_step() {
    local step_path="$1"
    if [ ! -f "$step_path" ]; then
        err "Installer step not found: $step_path"
        return
    fi
    log "Invoking dd idempotent step: $step_path"
    bash "$step_path" || warn "Step reported an issue (binary existence gates decide the flow)."
}

# ---------- Project dependencies (project deps, not an environment install) ----------

install_deps() {
    if [ ! -f "$PACKAGE_JSON" ]; then err "package.json not found at: $PACKAGE_JSON"; return; fi
    cd "$APP_ROOT" || return
    # One-time cutover from a pnpm-created node_modules (symlinked .pnpm layout):
    # rebuild the tree once so no stale pnpm symlinks survive.
    if [ -e "${NODE_MODULES}/.pnpm" ]; then
        log "pnpm node_modules layout detected -> rebuilding it with bun..."
        rm -rf "$NODE_MODULES"
    fi
    if [ -n "$FORCE_INSTALL" ] || [ ! -d "$NODE_MODULES" ] || [ -z "$(ls -A "$NODE_MODULES" 2>/dev/null)" ] || [ ! -f "$VITE_BIN" ]; then
        log "Installing/repairing dependencies (node_modules/vite missing or --force-install)..."
        bun install --force || warn "bun install did not complete cleanly."
    else
        log "node_modules present -> updating dependencies (bun install)..."
        bun install || warn "Kept existing node_modules (bun update did not complete cleanly)."
    fi
    if [ ! -f "$VITE_BIN" ]; then
        log "vite still missing -> reinstalling dependencies from scratch..."
        bun install --force || warn "bun reinstall did not complete cleanly."
    fi
    cd "$ORIGINAL_DIR" || true
}

# ---------- ADB wireless device debugging (official Android wireless debugging) ----------
# Official flow (developer.android.com/tools/adb): Android 11+ pairs ONCE with
# `adb pair IP:PAIR_PORT` (pairing code shown on the device under Wireless
# debugging -> Pair using pairing code), then connects with `adb connect IP:PORT`
# (port shown on the Wireless debugging page); legacy devices: USB ->
# `adb tcpip 5555` -> `adb connect IP:5555`.

adb_binary_ready() { [ -n "$ADB_BIN" ] && [ -x "$ADB_BIN" ]; }

# Resolve adb by BINARY EXISTENCE: central SDK root (android_build_env.sh) -> PATH.
resolve_adb_bin() {
    ADB_BIN=""
    android_build_resolve_sdk_root
    if [ -x "${ANDROID_BUILD_SDK_ROOT}/platform-tools/adb" ]; then
        ADB_BIN="${ANDROID_BUILD_SDK_ROOT}/platform-tools/adb"
        return
    fi
    ADB_BIN="$(command -v adb 2>/dev/null)"
}

# Idempotent adb provisioning via dd steps: JDK gate (92_install_java.sh) ->
# SDK step (187_install_android_sdk.sh downloads official cmdline-tools +
# platform-tools/adb, each component gated by binary existence).
ensure_adb_bin() {
    resolve_adb_bin
    if adb_binary_ready; then return; fi
    android_build_resolve_java_home
    if ! android_build_java_ready; then
        invoke_step "$STEP_JAVA"
        android_build_resolve_java_home
    fi
    if android_build_java_ready; then
        export JAVA_HOME="$ANDROID_BUILD_JAVA_HOME"
        export PATH="${JAVA_HOME}/bin:${PATH}"
    fi
    log "adb not found. Invoking dd idempotent step (installs cmdline-tools + platform-tools/adb): $STEP_ANDROID_SDK"
    invoke_step "$STEP_ANDROID_SDK"
    hash -r 2>/dev/null || true
    resolve_adb_bin
}

adb_list_devices() { "$ADB_BIN" devices -l; }

adb_pair_device() {
    local target="$1" code="$2"
    if [ -z "$target" ]; then err "Pair target required: IP:PAIR_PORT from 'Wireless debugging -> Pair using pairing code'."; return 1; fi
    case "$target" in *:*) ;; *) err "Pair target must include the pairing port (IP:PAIR_PORT)."; return 1 ;; esac
    log "Pairing with ${target} (Android 11+ wireless debugging)..."
    if [ -n "$code" ]; then
        "$ADB_BIN" pair "$target" "$code"
    else
        "$ADB_BIN" pair "$target"
    fi
}

adb_connect_device() {
    local target="$1"
    if [ -z "$target" ]; then err "Connect target required: IP[:PORT] (default port ${ADB_DEFAULT_PORT})."; return 1; fi
    case "$target" in *:*) ;; *) target="${target}:${ADB_DEFAULT_PORT}" ;; esac
    log "Connecting to ${target}..."
    "$ADB_BIN" connect "$target"
}

# Current `adb devices` state for a target (device/unauthorized/offline; empty
# when not connected).
adb_device_state() {
    "$ADB_BIN" devices 2>/dev/null | awk -v t="$1" '$1==t {print $2}'
}

# Connect and idempotently drive the phone's ownership authorization: a connect
# against an unauthorized device re-triggers the "Allow USB debugging" dialog on
# the phone; poll until it reports 'device'. Already-authorized devices pass
# straight through, so repeated runs are safe.
adb_ensure_authorized() {
    local target="$1" state="" tries=0
    adb_connect_device "$target" || return 1
    case "$target" in *:*) ;; *) target="${target}:${ADB_DEFAULT_PORT}" ;; esac
    state="$(adb_device_state "$target")"
    if [ "$state" = "device" ]; then
        log "${target} is authorized and online."
        return 0
    fi
    if [ -z "$state" ]; then
        warn "${target} did not connect. Android 11+ devices need pairing first (menu option 2 / --adb-pair)."
        return 1
    fi
    log "${target} state: ${state}. Confirm 'Allow USB debugging' ON THE PHONE (tick 'always allow')..."
    for tries in $(seq 1 30); do
        sleep 2
        state="$(adb_device_state "$target")"
        if [ "$state" = "device" ]; then
            log "${target} authorized -> online."
            return 0
        fi
        "$ADB_BIN" connect "$target" >/dev/null 2>&1
    done
    err "${target} was not authorized within 60s; re-run to retry (idempotent)."
    return 1
}

# Discover LAN adb devices: mDNS broadcast (Android 11+) + a parallel probe of
# port ADB_DEFAULT_PORT across every local /24 subnet (bash /dev/tcp, no extra
# dependencies), then connect + ensure authorization for each found host.
adb_scan_lan() {
    local subnet="" host="" hit="" target="" scan_dir=""
    ADB_SCAN_FOUND=0
    scan_dir="$(mktemp -d 2>/dev/null)"
    if [ -z "$scan_dir" ]; then err "Cannot create a temp dir for the LAN scan."; return 1; fi
    adb_mdns_scan
    while read -r subnet; do
        [ -n "$subnet" ] || continue
        log "Scanning ${subnet}.0/24 for open adb port ${ADB_DEFAULT_PORT}..."
        for host in $(seq 1 254); do
            (
                if timeout 1 bash -c "echo > /dev/tcp/${subnet}.${host}/${ADB_DEFAULT_PORT}" 2>/dev/null; then
                    printf '%s\n' "${subnet}.${host}" > "${scan_dir}/${subnet}.${host}"
                fi
            ) &
        done
        wait
    done <<__ADB_SUBNETS__
$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -vE '^127\.' | cut -d. -f1-3 | sort -u)
__ADB_SUBNETS__
    for hit in "${scan_dir}"/*; do
        [ -f "$hit" ] || continue
        target="$(cat "$hit")"
        [ -n "$target" ] || continue
        ADB_SCAN_FOUND=1
        log "Found adb host: ${target}"
        adb_ensure_authorized "$target" || true
    done
    rm -rf "$scan_dir"
    if [ "$ADB_SCAN_FOUND" -eq 0 ]; then
        log "No hosts with port ${ADB_DEFAULT_PORT} open found. Android 11+: enable Wireless debugging and pair first (option 2)."
    fi
}

adb_disconnect_device() {
    local target="$1"
    if [ -z "$target" ] || [ "$target" = "all" ]; then
        log "Disconnecting all devices..."
        "$ADB_BIN" disconnect
    else
        case "$target" in *:*) ;; *) target="${target}:${ADB_DEFAULT_PORT}" ;; esac
        log "Disconnecting ${target}..."
        "$ADB_BIN" disconnect "$target"
    fi
}

adb_mdns_scan() {
    log "mDNS services (devices broadcasting wireless debugging on this network)..."
    "$ADB_BIN" mdns services || warn "mDNS discovery is not supported by this adb build."
}

adb_enable_tcpip() {
    local port="${1:-$ADB_DEFAULT_PORT}"
    log "Switching the USB-connected device to TCP/IP mode on port ${port}..."
    "$ADB_BIN" tcpip "$port"
}

adb_restart_server() {
    log "Restarting adb server..."
    "$ADB_BIN" kill-server
    "$ADB_BIN" start-server
}

adb_install_apk() {
    local apk_path="$1"
    if [ -z "$apk_path" ]; then
        apk_path="$(find "${APP_ROOT}/native" -type f -name '*.apk' -path '*build/outputs/apk/*' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n1 | cut -d' ' -f2-)"
    fi
    if [ -z "$apk_path" ] || [ ! -f "$apk_path" ]; then err "APK not found. Build first or pass --adb-install=PATH."; return 1; fi
    log "Installing ${apk_path} to the connected device..."
    "$ADB_BIN" install -r "$apk_path"
}

# Idempotent one-step online connect: adb prerequisites -> adb server -> connect
# every mDNS-advertised wireless-debugging endpoint -> LAN scan only when no
# device is online yet -> device list. Already-online devices pass straight through.
adb_online_count() {
    "$ADB_BIN" devices 2>/dev/null | awk 'NR > 1 && $2 == "device"' | wc -l
}

adb_connect_online() {
    local endpoint=""
    ensure_adb_bin
    adb_binary_ready || { err "adb is unavailable."; return 1; }
    "$ADB_BIN" start-server >/dev/null 2>&1
    while read -r endpoint; do
        [ -n "$endpoint" ] || continue
        [ "$(adb_device_state "$endpoint")" = "device" ] && continue
        adb_ensure_authorized "$endpoint" || true
    done <<__ADB_MDNS__
$("$ADB_BIN" mdns services 2>/dev/null | awk '$2 ~ /_adb(-tls-connect)?\._tcp/ {print $3}' | sort -u)
__ADB_MDNS__
    if [ "$(adb_online_count)" -eq 0 ]; then
        adb_scan_lan || true
    fi
    adb_list_devices
    [ "$(adb_online_count)" -gt 0 ]
}

# Interactive wireless debugging menu (dynamic connect: mDNS scan + pair/connect).
run_device_menu() {
    local choice="" input="" code=""
    while true; do
        printf '\n'
        log "=== ADB wireless device debugging (adb: ${ADB_BIN}) ==="
        printf '  1) Connect online devices (idempotent: prerequisites + mDNS/LAN discovery + authorize)\n'
        printf '  2) Pair device - Android 11+ (adb pair IP:PAIR_PORT CODE)\n'
        printf '  3) Connect device (adb connect IP[:PORT], default %s)\n' "$ADB_DEFAULT_PORT"
        printf '  4) Discover devices via mDNS (adb mdns services)\n'
        printf '  5) Enable TCP/IP mode on USB device (adb tcpip %s)\n' "$ADB_DEFAULT_PORT"
        printf '  6) Disconnect a device (or all)\n'
        printf '  7) Restart adb server\n'
        printf '  8) Install latest built APK to the connected device (auto-builds when none exists)\n'
        printf '  9) Auto-discover LAN devices (mDNS + subnet scan), connect + authorize\n'
        printf '  0) Exit\n'
        printf '  Tip: type an IP[:PORT] directly to connect + authorize.\n'
        read -r -p "Select an action [1]: " choice
        choice="${choice:-1}"
        case "$choice" in
            1) adb_connect_online || warn "No online device yet. Android 11+: pair first (option 2)." ;;
            2)
                read -r -p "Pair target IP:PAIR_PORT: " input
                read -r -p "Pairing code: " code
                adb_pair_device "$input" "$code" || true
                ;;
            3) read -r -p "Device IP[:PORT]: " input; adb_ensure_authorized "$input" || true ;;
            4) adb_mdns_scan ;;
            5) read -r -p "Port [${ADB_DEFAULT_PORT}]: " input; adb_enable_tcpip "${input:-$ADB_DEFAULT_PORT}" || true ;;
            6) read -r -p "Device IP[:PORT] (empty = all): " input; adb_disconnect_device "$input" || true ;;
            7) adb_restart_server ;;
            8)
                if ! adb_install_apk ""; then
                    read -r -p "No built APK found. Build one now (idempotent prerequisites + build), then install? [Y/n] " input
                    case "$input" in
                        [nN]*) : ;;
                        *) BUILD_FOR_INSTALL=1; break ;;
                    esac
                fi
                ;;
            9) adb_scan_lan ;;
            0) break ;;
            *)
                if printf '%s' "$choice" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)?$'; then
                    adb_ensure_authorized "$choice" || true
                else
                    warn "Unknown option: ${choice}"
                fi
                ;;
        esac
    done
}

# Non-interactive device actions (flag order: tcpip -> scan -> pair -> connect -> disconnect -> install -> list).
run_device_actions() {
    local ok=1
    if [ -n "$ADB_TCPIP_PORT" ]; then adb_enable_tcpip "$ADB_TCPIP_PORT" || ok=0; fi
    if [ -n "$ADB_SCAN" ]; then adb_scan_lan || ok=0; fi
    if [ -n "$ADB_PAIR_TARGET" ]; then adb_pair_device "$ADB_PAIR_TARGET" "$ADB_PAIR_CODE" || ok=0; fi
    if [ -n "$ADB_CONNECT_TARGET" ]; then adb_ensure_authorized "$ADB_CONNECT_TARGET" || ok=0; fi
    if [ -n "$ADB_DISCONNECT_TARGET" ]; then adb_disconnect_device "$ADB_DISCONNECT_TARGET" || ok=0; fi
    if [ -n "$ADB_INSTALL" ]; then
        if ! adb_install_apk "$ADB_INSTALL_PATH"; then
            log "No built APK found; switching to the build workflow, then installing."
            BUILD_FOR_INSTALL=1
        fi
    fi
    adb_list_devices
    [ "$ok" -eq 1 ] || [ -n "$BUILD_FOR_INSTALL" ]
}

# --- Parse arguments ---
while [ "$#" -gt 0 ]; do
    ARG="$1"
    case "$ARG" in
        --app)
            shift
            [ "$#" -gt 0 ] || { err "--app requires a value."; READY=0; break; }
            APK_APP="$1"
            ;;
        --app=*) APK_APP="${ARG#*=}" ;;
        --list) LIST_APPS=1 ;;
        --platform)
            shift
            [ "$#" -gt 0 ] || { err "--platform requires a value."; READY=0; break; }
            PLATFORM="$1"
            ;;
        --platform=*) PLATFORM="${ARG#*=}" ;;
        --debug-apk) APK_BUILD_TYPE="debug" ;;
        --release-apk) APK_BUILD_TYPE="release" ;;
        --build-type)
            shift
            [ "$#" -gt 0 ] || { err "--build-type requires a value."; READY=0; break; }
            APK_BUILD_TYPE="$1"
            ;;
        --build-type=*) APK_BUILD_TYPE="${ARG#*=}" ;;
        --skip-apk-assets) SKIP_ASSETS=1 ;;
        --clean-apk) CLEAN_APK=1 ;;
        --no-open-output) OPEN_OUTPUT=1 ;;
        --non-interactive) NON_INTERACTIVE=1 ;;
        -f|--force-install) FORCE_INSTALL=1 ;;
        --adb-menu) ADB_MENU=1 ;;
        --adb-devices) ADB_LIST=1 ;;
        --adb-pair)
            shift
            [ "$#" -gt 0 ] || { err "--adb-pair requires a value (IP:PAIR_PORT)."; READY=0; break; }
            ADB_PAIR_TARGET="$1"
            ;;
        --adb-pair=*) ADB_PAIR_TARGET="${ARG#*=}" ;;
        --adb-pair-code)
            shift
            [ "$#" -gt 0 ] || { err "--adb-pair-code requires a value."; READY=0; break; }
            ADB_PAIR_CODE="$1"
            ;;
        --adb-pair-code=*) ADB_PAIR_CODE="${ARG#*=}" ;;
        --adb-connect)
            shift
            [ "$#" -gt 0 ] || { err "--adb-connect requires a value (IP[:PORT])."; READY=0; break; }
            ADB_CONNECT_TARGET="$1"
            ;;
        --adb-connect=*) ADB_CONNECT_TARGET="${ARG#*=}" ;;
        --adb-disconnect) ADB_DISCONNECT_TARGET="all" ;;
        --adb-disconnect=*) ADB_DISCONNECT_TARGET="${ARG#*=}" ;;
        --adb-tcpip) ADB_TCPIP_PORT="$ADB_DEFAULT_PORT" ;;
        --adb-tcpip=*) ADB_TCPIP_PORT="${ARG#*=}" ;;
        --adb-install) ADB_INSTALL=1 ;;
        --adb-install=*) ADB_INSTALL=1; ADB_INSTALL_PATH="${ARG#*=}" ;;
        --adb-scan) ADB_SCAN=1 ;;
        *) err "Unknown option: $ARG"; READY=0 ;;
    esac
    shift
done

if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    if [ -n "$NON_INTERACTIVE" ]; then SUDO="sudo -n"; else SUDO="sudo"; fi
fi

log "Original directory: $ORIGINAL_DIR"
log "Working directory:  $APP_ROOT"
log "Constants: CACHE=${CORE_NODE_CACHE_DIR:-} | SDK fallback=${ANDROID_BUILD_SDK_CACHE_ROOT} | CENTRAL_LIB=${ANDROID_BUILD_ENV}"

if [ "$PLATFORM" = "ios" ]; then
    if [ "$(uname -s)" != "Darwin" ]; then
        err "iOS builds require macOS with Xcode 26+ (Capacitor 8). Re-run on a Mac."
        READY=0
    else
        err "iOS packaging is not wired in build_apk.py yet (android only)."
        READY=0
    fi
elif [ "$PLATFORM" != "android" ]; then
    err "Unsupported platform: $PLATFORM (android only)."
    READY=0
fi

# --- Device debugging mode: ADB wireless connect menu/actions (no build) ---
if [ -n "$ADB_MENU" ] || [ -n "$ADB_PAIR_TARGET" ] || [ -n "$ADB_CONNECT_TARGET" ] || \
   [ -n "$ADB_DISCONNECT_TARGET" ] || [ -n "$ADB_TCPIP_PORT" ] || [ -n "$ADB_INSTALL" ] || \
   [ -n "$ADB_SCAN" ] || [ -n "$ADB_LIST" ]; then
    DEVICE_MODE=1
fi

# --- Interactive top-level menu (bare run): build vs ADB wireless debugging ---
if [ "$READY" -eq 1 ] && [ -z "$DEVICE_MODE" ] && [ -z "$NON_INTERACTIVE" ] && \
   [ -z "$LIST_APPS" ] && [ -z "$APK_APP" ] && [ "$APK_BUILD_TYPE" = "ask" ] && [ -t 0 ]; then
    printf '\n'
    log "=== Nexus build menu ==="
    printf '  1) Build APK (Capacitor native build)\n'
    printf '  2) ADB wireless device debugging (pair/connect a phone)\n'
    printf '  0) Exit\n'
    read -r -p "Select a mode [1]: " MODE_CHOICE
    case "$MODE_CHOICE" in
        2) ADB_MENU=1; DEVICE_MODE=1 ;;
        0) USER_QUIT=1; DEVICE_MODE=1 ;;
        *) : ;;
    esac
fi

if [ "$READY" -eq 1 ] && [ -n "$DEVICE_MODE" ]; then
    if [ -n "$USER_QUIT" ]; then
        BUILD_OK=1
    else
        ensure_adb_bin
        if adb_binary_ready; then
            log "adb binary: ${ADB_BIN}"
            if [ -n "$ADB_MENU" ]; then
                run_device_menu
                BUILD_OK=1
            elif run_device_actions; then
                BUILD_OK=1
            fi
        else
            err "adb still missing after ${STEP_ANDROID_SDK} (check network/proxy: HTTPS_PROXY)."
            READY=0
        fi
    fi
    # Auto idempotent build-for-install: the menu/actions requested an APK that
    # does not exist yet -> fall through to the normal build workflow, then install.
    if [ -n "$BUILD_FOR_INSTALL" ] && [ "$READY" -eq 1 ]; then
        DEVICE_MODE=""
        BUILD_OK=0
        log "Switching to the build workflow to produce an APK for installation..."
    fi
fi

# --- Prerequisite: node + bun (binary gate: bun on PATH) ---
if [ "$READY" -eq 1 ] && [ -z "$DEVICE_MODE" ] && ! test_bun_ready; then
    $SUDO mkdir -p "$GVDIR" 2>/dev/null || true
    printf 'true\n' | $SUDO tee "$GVDIR/INSTALL_NODE" >/dev/null 2>&1 || true
    log "bun not found. Invoking dd idempotent step (installs node + bun): $STEP_NODE"
    invoke_step "$STEP_NODE"
    hash -r 2>/dev/null || true
    if ! test_bun_ready; then
        err "bun still missing after 17_install_node_toolchain_26.sh."
        READY=0
    else
        log "Upgraded the frontend runtime to bun: $(command -v bun)"
    fi
fi

# --- Prerequisite: python (binary gate: python on PATH) ---
if [ "$READY" -eq 1 ] && [ -z "$DEVICE_MODE" ] && ! test_python_ready; then
    invoke_step "$STEP_PYTHON"
    hash -r 2>/dev/null || true
    if ! test_python_ready; then
        err "python still missing after 13_ensure_python.sh."
        READY=0
    fi
fi
if [ "$READY" -eq 1 ] && [ -z "$DEVICE_MODE" ]; then
    if command -v python3 >/dev/null 2>&1; then PYTHON_BIN="$(command -v python3)"; else PYTHON_BIN="$(command -v python)"; fi
fi

# --- Project dependencies (binary gate: vite.js) ---
if [ "$READY" -eq 1 ] && [ -z "$DEVICE_MODE" ] && [ -z "$LIST_APPS" ] && ! test_vite_ready; then
    install_deps
    if ! test_vite_ready; then
        err "Dependencies incomplete (vite missing) after bun install."
        READY=0
    fi
fi

# --- Prerequisite: JDK 21 (central detector: java with major >= 21) ---
if [ "$READY" -eq 1 ] && [ -z "$DEVICE_MODE" ] && [ -z "$LIST_APPS" ]; then
    android_build_resolve_java_home
    if ! android_build_java_ready; then
        invoke_step "$STEP_JAVA"
        android_build_resolve_java_home
        if ! android_build_java_ready; then
            err "JDK ${ANDROID_BUILD_REQUIRED_JAVA_MAJOR}+ still missing after 92_install_java.sh."
            READY=0
        fi
    fi
fi

# --- Prerequisite: Android SDK packages (central detector: sdkmanager + adb + platform + build-tools) ---
if [ "$READY" -eq 1 ] && [ -z "$DEVICE_MODE" ] && [ -z "$LIST_APPS" ]; then
    android_build_resolve_sdk_root
    if ! android_build_test_sdk_ready; then
        invoke_step "$STEP_ANDROID_SDK"
        android_build_resolve_sdk_root
        if ! android_build_test_sdk_ready; then
            err "Android SDK packages still missing after 187_install_android_sdk.sh (check network/proxy: HTTPS_PROXY)."
            READY=0
        fi
    fi
fi

# --- Export resolved toolchain env for the build (central state) ---
if [ "$READY" -eq 1 ] && [ -z "$DEVICE_MODE" ] && [ -z "$LIST_APPS" ]; then
    export JAVA_HOME="$ANDROID_BUILD_JAVA_HOME"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    export ANDROID_HOME="$ANDROID_BUILD_SDK_ROOT"
    export ANDROID_SDK_ROOT="$ANDROID_BUILD_SDK_ROOT"
    export PATH="${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/cmdline-tools/latest/bin:${PATH}"
    log "JAVA_HOME = ${JAVA_HOME}"
    log "ANDROID_HOME = ${ANDROID_HOME}"
    if android_build_set_java_proxy; then
        log "Proxy enabled via JAVA_TOOL_OPTIONS for sdkmanager/gradle."
    fi
fi

if [ "$READY" -eq 1 ] && [ -z "$DEVICE_MODE" ]; then
    BUILD_ARGS=("$BUILD_APK_SCRIPT" --root "$APP_ROOT" --build-type "$APK_BUILD_TYPE")
    [ -n "$APK_APP" ] && BUILD_ARGS+=(--app "$APK_APP")
    [ -n "$LIST_APPS" ] && BUILD_ARGS+=(--list)
    [ -n "$SKIP_ASSETS" ] && BUILD_ARGS+=(--assets no)
    [ -n "$CLEAN_APK" ] && BUILD_ARGS+=(--clean yes)
    [ -n "$OPEN_OUTPUT" ] && BUILD_ARGS+=(--open no)
    [ -n "$NON_INTERACTIVE" ] && BUILD_ARGS+=(--non-interactive)

    log "Starting Capacitor native build workflow (platform: ${PLATFORM})."
    "$PYTHON_BIN" "${BUILD_ARGS[@]}" && BUILD_OK=1
    if [ "$BUILD_OK" -eq 1 ]; then
        log "Native build workflow finished."
    else
        err "Native build workflow failed."
    fi
elif [ -z "$DEVICE_MODE" ]; then
    err "Prerequisites are not ready; build was not started."
fi

# --- Post-build install (auto idempotent build-for-install from device mode) ---
if [ -n "$BUILD_FOR_INSTALL" ] && [ "$READY" -eq 1 ]; then
    if [ "$BUILD_OK" -eq 1 ]; then
        ensure_adb_bin
        if adb_binary_ready; then
            if adb_install_apk ""; then
                log "Freshly built APK installed to the connected device."
            else
                err "APK install failed."
                BUILD_OK=0
            fi
        else
            err "adb unavailable; the APK was built but not installed."
            BUILD_OK=0
        fi
    else
        err "Build failed; nothing was installed."
    fi
fi

cd "$ORIGINAL_DIR" || true
if [ "$READY" -eq 1 ] && [ "$BUILD_OK" -eq 1 ]; then
    exit 0
fi
exit 1
