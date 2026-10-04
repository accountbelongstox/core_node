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
#   Menu (bare run):   ./start_build.sh            (select the app, then the action menu; item 1 = one-click debug)
#   One-click debug:   ./start_build.sh --one-click [--app wordnew] (find device USB/WiFi -> build debug -> install -> live reload + logs)
#   Non-interactive:   ./start_build.sh --app wordnew --release-apk --non-interactive
#   List sub-apps:     ./start_build.sh --list
#   Device menu:       ./start_build.sh --adb-menu
#   Pair (Android 11+):./start_build.sh --adb-pair-code <CODE> [--adb-pair <IP[:PAIR_PORT]>] (port found by mDNS/port scan; idempotent)
#   Connect:           ./start_build.sh --adb-connect <IP[:PORT]>
#   LAN auto-scan:     ./start_build.sh --adb-scan   (mDNS + subnet probe, connect + authorize)
#   Build + install:   ./start_build.sh --adb-install (builds an APK first when none exists)
#   Live reload:       ./start_build.sh --live-reload [--app wordnew] (same flow as --one-click)
# ADB wireless device debugging follows the official Android adb docs
# (developer.android.com/tools/adb): pair ONCE with `adb pair` (pairing code from
# Wireless debugging -> Pair using pairing code), then `adb connect`; legacy
# devices use USB + `adb tcpip 5555` + `adb connect`. The adb binary itself is
# provisioned idempotently by the dd step 187_install_android_sdk.sh
# (platform-tools binary gate) - this script implements no installation.
# Device discovery (USB / already connected / remembered / mDNS / LAN scan / pairing /
# adb tcpip WiFi switch) is the single shared scripts/flavor/live_debug.py (also used
# by start_build.ps1); the adb_* functions below are thin wrappers around it.

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
LIVE_DEBUG_SCRIPT="${SCRIPT_DIR}/flavor/live_debug.py"
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
IS_INTERACTIVE=""
SHOW_MENU=""
MENU_OUTCOME=""
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
BUILD_FOR_INSTALL=""
ASK_ANSWER=""
ADB_APK_MISSING=""
LIVE_RELOAD=""
ADB_DEFAULT_PORT=5555
ADB_IP_TARGET_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)?$'
MENU_ADB_CHOICE_PATTERN='^([4-9]|1[01])$'

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

# Y/n prompt defaulting to yes: sets ASK_ANSWER=1 for yes, empty for no.
# Non-interactive runs (flag or no TTY) take the default.
ask_default_yes() {
    local reply=""
    ASK_ANSWER=1
    if [ -n "$NON_INTERACTIVE" ] || [ ! -t 0 ]; then return; fi
    read -r -p "$1 [Y/n] " reply
    case "$reply" in [nN]*) ASK_ANSWER="" ;; esac
}

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
    local pair_args=(pair)
    case "$target" in
        *:*) ;;
        *) if [ -z "$code" ]; then err "Pairing needs the 6-digit code from 'Wireless debugging -> Pair device with pairing code' (IP:PAIR_PORT optional)."; return 1; fi ;;
    esac
    if [ -n "$target" ]; then pair_args+=(--target "$target"); fi
    if [ -n "$code" ]; then pair_args+=(--code "$code"); fi
    live_debug "${pair_args[@]}"
}

# Current `adb devices` state for a target (device/unauthorized/offline; empty
# when not connected).
adb_device_state() {
    "$ADB_BIN" devices 2>/dev/null | awk -v t="$1" '$1==t {print $2}'
}

# Connect + authorization polling is live_debug.py connect --target; success is the
# device state ('device') afterwards.
adb_ensure_authorized() {
    local target="$1"
    if [ -z "$target" ]; then err "Connect target required: IP[:PORT] (default port ${ADB_DEFAULT_PORT})."; return 1; fi
    live_debug connect --target "$target"
    case "$target" in *:*) ;; *) target="${target}:${ADB_DEFAULT_PORT}" ;; esac
    [ "$(adb_device_state "$target")" = "device" ]
}

# LAN discovery (mDNS listing + local /24 subnet scan, connect + authorize) is live_debug.py scan.
adb_scan_lan() { live_debug scan; }

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

adb_mdns_scan() { live_debug mdns; }

adb_enable_tcpip() { live_debug tcpip --port "${1:-$ADB_DEFAULT_PORT}"; }

adb_restart_server() {
    log "Restarting adb server..."
    "$ADB_BIN" kill-server
    "$ADB_BIN" start-server
}

# Python resolved by BINARY EXISTENCE; delegated to the dd python step when missing.
ensure_python_bin() {
    if [ -n "$PYTHON_BIN" ]; then return; fi
    if ! test_python_ready; then
        invoke_step "$STEP_PYTHON"
        hash -r 2>/dev/null || true
    fi
    if command -v python3 >/dev/null 2>&1; then PYTHON_BIN="$(command -v python3)"; else PYTHON_BIN="$(command -v python)"; fi
}

# Device-side work (connect/discovery/pairing/WiFi switch, install + verify per physical
# device, live attach, session log collection, WebView DevTools forwarding, AI debug
# info + live log view) is the shared scripts/flavor/live_debug.py (single
# implementation for sh + ps1). Prompts need a console, so non-interactive runs say so.
live_debug() {
    local extra=()
    ensure_python_bin
    if [ -n "$NON_INTERACTIVE" ] || [ ! -t 0 ] || [ ! -t 1 ]; then extra+=(--non-interactive); fi
    if [ -n "$APK_APP" ]; then extra+=(--app "$APK_APP"); fi
    "$PYTHON_BIN" "$LIVE_DEBUG_SCRIPT" "$@" "${extra[@]}" --root "$APP_ROOT" --adb "$ADB_BIN"
}

# Ctrl+C ends only the live log view (python), then this script exits normally.
adb_live_attach() {
    trap ':' INT
    live_debug attach
    trap - INT
}

adb_install_apk() {
    local apk_path="$1"
    ADB_APK_MISSING=""
    [ -n "$apk_path" ] || apk_path="$(live_debug latest-apk)"
    if [ -z "$apk_path" ] || [ ! -f "$apk_path" ]; then ADB_APK_MISSING=1; err "APK not found. Build first or pass --adb-install=PATH."; return 1; fi
    live_debug install --apk "$apk_path"
}

adb_online_count() {
    "$ADB_BIN" devices 2>/dev/null | awk 'NR > 1 && $2 == "device"' | wc -l
}

# One-click device resolution (live_debug.py connect): USB / already-connected device ->
# USB device switched to WiFi (adb tcpip) -> remembered targets -> mDNS -> LAN scan -> pairing.
adb_connect_online() {
    ensure_adb_bin
    adb_binary_ready || { err "adb is unavailable."; return 1; }
    live_debug connect
    adb_list_devices
    [ "$(adb_online_count)" -gt 0 ]
}

# Step 1 of the interactive flow: pick the app (a single app is selected automatically).
select_build_app() {
    local ids=() names=() default_number=1 index=0 id="" name="" mark="" reply="" picked=1
    if [ -n "$APK_APP" ]; then return; fi
    ensure_python_bin
    while IFS=$'\t' read -r id name mark; do
        [ -n "$id" ] || continue
        mark="${mark%$'\r'}"
        ids+=("$id")
        names+=("$name")
        if [ "$mark" = "*" ]; then default_number="${#ids[@]}"; fi
    done < <("$PYTHON_BIN" "$BUILD_APK_SCRIPT" --root "$APP_ROOT" --list-plain)
    if [ "${#ids[@]}" -eq 0 ]; then return; fi
    picked="$default_number"
    if [ "${#ids[@]}" -gt 1 ]; then
        printf '\n'
        log "=== Select the app ==="
        for index in "${!ids[@]}"; do
            printf '  %s) %s - %s\n' "$((index + 1))" "${ids[$index]}" "${names[$index]}"
        done
        printf '  0) Exit\n'
        read -r -p "Select an app [${default_number}]: " reply
        if [ "$reply" = "0" ]; then USER_QUIT=1; return; fi
        case "$reply" in ''|*[!0-9]*) : ;; *) picked="$reply" ;; esac
        if [ "$picked" -lt 1 ] || [ "$picked" -gt "${#ids[@]}" ]; then picked="$default_number"; fi
    fi
    APK_APP="${ids[$((picked - 1))]}"
    log "App: ${APK_APP}"
}

# Step 2: action menu. Item 1 (default) is one-click debug; then build options; then the
# adb tools. Sets MENU_OUTCOME: oneclick | build | (empty = exit).
run_action_menu() {
    local choice="" input="" code=""
    MENU_OUTCOME=""
    while true; do
        printf '\n'
        log "=== ${APK_APP} : choose an action ==="
        printf '  1) One-click debug (auto: find device USB/WiFi -> build debug -> install -> live reload + logs)\n'
        printf '  2) Build debug APK\n'
        printf '  3) Build release APK\n'
        printf '  4) Install the latest built APK to the connected device (offers a build when none exists)\n'
        printf '  5) Find and connect a device over WiFi (remembered + mDNS + LAN scan, no USB cable)\n'
        printf '  6) Pair device - Android 11+ (pairing code; IP:PAIR_PORT optional)\n'
        printf '  7) Connect device (adb connect IP[:PORT], default %s)\n' "$ADB_DEFAULT_PORT"
        printf '  8) Discover devices via mDNS (adb mdns services)\n'
        printf '  9) Switch the USB device to WiFi (adb tcpip %s + adb connect)\n' "$ADB_DEFAULT_PORT"
        printf ' 10) Disconnect a device (or all)\n'
        printf ' 11) Restart adb server\n'
        printf '  0) Exit\n'
        printf '  Tip: type an IP[:PORT] directly to connect + authorize.\n'
        read -r -p "Select an action [1]: " choice
        choice="${choice:-1}"
        if printf '%s' "$choice" | grep -qE "${MENU_ADB_CHOICE_PATTERN}|${ADB_IP_TARGET_PATTERN}"; then
            ensure_adb_bin
            if ! adb_binary_ready; then
                err "adb is unavailable (check network/proxy: HTTPS_PROXY)."
                continue
            fi
        fi
        case "$choice" in
            1) MENU_OUTCOME="oneclick"; break ;;
            2) APK_BUILD_TYPE="debug"; MENU_OUTCOME="build"; break ;;
            3) APK_BUILD_TYPE="release"; MENU_OUTCOME="build"; break ;;
            4)
                if ! adb_install_apk "" && [ -n "$ADB_APK_MISSING" ]; then
                    read -r -p "No built APK found. Build a debug APK now (idempotent prerequisites + build), then install it? [Y/n] " input
                    case "$input" in
                        [nN]*) : ;;
                        *) BUILD_FOR_INSTALL=1; APK_BUILD_TYPE="debug"; MENU_OUTCOME="build"; break ;;
                    esac
                fi
                ;;
            5) adb_connect_online || true ;;
            6)
                read -r -p "Pairing code (6 digits): " code
                read -r -p "Pair target IP[:PAIR_PORT] (empty = find by mDNS/port scan): " input
                adb_pair_device "$input" "$code" || true
                ;;
            7) read -r -p "Device IP[:PORT]: " input; adb_ensure_authorized "$input" || true ;;
            8) adb_mdns_scan ;;
            9) read -r -p "Port [${ADB_DEFAULT_PORT}]: " input; adb_enable_tcpip "${input:-$ADB_DEFAULT_PORT}" || true ;;
            10) read -r -p "Device IP[:PORT] (empty = all): " input; adb_disconnect_device "$input" || true ;;
            11) adb_restart_server ;;
            0) break ;;
            *)
                if printf '%s' "$choice" | grep -qE "$ADB_IP_TARGET_PATTERN"; then
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
    if [ -n "$LIVE_RELOAD" ]; then
        if adb_connect_online; then BUILD_FOR_INSTALL=1; APK_BUILD_TYPE="debug"; else ok=0; fi
    fi
    if [ -n "$ADB_SCAN" ]; then adb_scan_lan || ok=0; fi
    if [ -n "$ADB_PAIR_TARGET" ] || [ -n "$ADB_PAIR_CODE" ]; then adb_pair_device "$ADB_PAIR_TARGET" "$ADB_PAIR_CODE" || ok=0; fi
    if [ -n "$ADB_CONNECT_TARGET" ]; then adb_ensure_authorized "$ADB_CONNECT_TARGET" || ok=0; fi
    if [ -n "$ADB_DISCONNECT_TARGET" ]; then adb_disconnect_device "$ADB_DISCONNECT_TARGET" || ok=0; fi
    if [ -n "$ADB_INSTALL" ]; then
        if adb_install_apk "$ADB_INSTALL_PATH"; then
            :
        elif [ -n "$ADB_APK_MISSING" ]; then
            log "No built APK found; switching to the build workflow, then installing."
            BUILD_FOR_INSTALL=1
        else
            ok=0
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
        --live-reload|--one-click) LIVE_RELOAD=1 ;;
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
if [ -n "$ADB_MENU" ] || [ -n "$ADB_PAIR_TARGET" ] || [ -n "$ADB_PAIR_CODE" ] || [ -n "$ADB_CONNECT_TARGET" ] || \
   [ -n "$ADB_DISCONNECT_TARGET" ] || [ -n "$ADB_TCPIP_PORT" ] || [ -n "$ADB_INSTALL" ] || \
   [ -n "$ADB_SCAN" ] || [ -n "$ADB_LIST" ] || [ -n "$LIVE_RELOAD" ]; then
    DEVICE_MODE=1
fi

# --- Interactive flow (bare run or --adb-menu): 1) select the app, 2) action menu ---
if [ -z "$NON_INTERACTIVE" ] && [ -t 0 ]; then IS_INTERACTIVE=1; fi
if [ "$READY" -eq 1 ] && [ -n "$IS_INTERACTIVE" ] && [ -z "$LIST_APPS" ]; then
    if [ -n "$ADB_MENU" ] || { [ -z "$DEVICE_MODE" ] && [ "$APK_BUILD_TYPE" = "ask" ]; }; then SHOW_MENU=1; fi
    if { [ -n "$SHOW_MENU" ] || [ -n "$LIVE_RELOAD" ]; } && [ -z "$APK_APP" ]; then select_build_app; fi
fi
if [ "$READY" -eq 1 ] && [ -n "$SHOW_MENU" ] && [ -z "$USER_QUIT" ]; then
    run_action_menu
    case "$MENU_OUTCOME" in
        oneclick) LIVE_RELOAD=1; APK_BUILD_TYPE="debug"; DEVICE_MODE=1 ;;
        build) DEVICE_MODE="" ;;
        *) USER_QUIT=1 ;;
    esac
fi
if [ -n "$USER_QUIT" ]; then DEVICE_MODE=1; fi

# --- Device debugging phase (one-click device resolution + non-interactive device actions) ---
if [ "$READY" -eq 1 ] && [ -n "$DEVICE_MODE" ]; then
    if [ -n "$USER_QUIT" ]; then
        BUILD_OK=1
    else
        ensure_adb_bin
        if adb_binary_ready; then
            log "adb binary: ${ADB_BIN}"
            if run_device_actions; then
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

# --- Online adb devices: offer to install the fresh APK (default yes) ---
if [ "$READY" -eq 1 ] && [ -z "$DEVICE_MODE" ] && [ -z "$LIST_APPS" ] && [ -z "$BUILD_FOR_INSTALL" ]; then
    resolve_adb_bin
    if adb_binary_ready && [ "$(adb_online_count)" -gt 0 ]; then
        log "Online adb device(s) detected:"
        "$ADB_BIN" devices -l | awk 'NR > 1 && $2 == "device"'
        ask_default_yes "Install the built APK to the connected device(s) after the build?"
        [ -n "$ASK_ANSWER" ] && BUILD_FOR_INSTALL=1
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
    [ -n "$LIVE_RELOAD" ] && BUILD_ARGS+=(--live-reload --assets yes --clean no --open yes)

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

# --- Post-build install (device mode, or accepted online-device offer) ---
if [ -n "$BUILD_FOR_INSTALL" ] && [ "$READY" -eq 1 ]; then
    if [ "$BUILD_OK" -eq 1 ]; then
        ensure_adb_bin
        if adb_binary_ready; then
            if adb_install_apk ""; then
                log "Freshly built APK installed to the connected device."
                [ -n "$LIVE_RELOAD" ] && adb_live_attach
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
