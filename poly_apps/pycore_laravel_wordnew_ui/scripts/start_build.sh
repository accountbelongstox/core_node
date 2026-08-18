#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Capacitor native build entry (Linux/Debian; incl. WSL) for pycore_laravel_wordnew_ui.
# This script IMPLEMENTS NO INSTALLATION: every prerequisite repair is delegated to
# the idempotent installer steps referenced by FULL PATH (dd.sh install_shells menu):
#   17_install_node_24.sh        - node + pnpm
#   13_ensure_python.sh          - python
#   93_install_java.sh           - JDK 21 (Temurin -> COMPILE_DIR/java + /etc/environment)
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
#   Select + debug:    ./start_build.sh
#   Non-interactive:   ./start_build.sh --app wordnew --release-apk --non-interactive
#   List sub-apps:     ./start_build.sh --list

# --- All variables and file references (declared at top) ---
ORIGINAL_DIR=$(pwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
POLY_APPS_DIR="$(cd "${APP_ROOT}/.." && pwd)"
REPO_ROOT="$(cd "${POLY_APPS_DIR}/.." && pwd)"
BUILD_APK_SCRIPT="${SCRIPT_DIR}/flavor/build_apk.py"
# dd idempotent steps + central library (FULL PATHS from the dd directory layout)
LINUX_SHELLS_DIR="${REPO_ROOT}/scripts/shells/linux"
STEP_NODE="${LINUX_SHELLS_DIR}/debian/install_shells/17_install_node_24.sh"
STEP_PYTHON="${LINUX_SHELLS_DIR}/debian/install_shells/13_ensure_python.sh"
STEP_JAVA="${LINUX_SHELLS_DIR}/debian/install_shells/93_install_java.sh"
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

test_pnpm_ready() { command -v pnpm >/dev/null 2>&1; }

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
    if [ -n "$FORCE_INSTALL" ] || [ ! -d "$NODE_MODULES" ] || [ -z "$(ls -A "$NODE_MODULES" 2>/dev/null)" ] || [ ! -f "$VITE_BIN" ]; then
        log "Installing/repairing dependencies (node_modules/vite missing or --force-install)..."
        pnpm install --config.confirm-modules-purge=false || warn "pnpm install did not complete cleanly."
    else
        log "node_modules present -> updating in place..."
        pnpm install --config.confirm-modules-purge=false || warn "Kept existing node_modules (pnpm update did not complete cleanly)."
    fi
    if [ ! -f "$VITE_BIN" ]; then
        log "vite still missing -> reinstalling dependencies from scratch..."
        pnpm install --config.confirm-modules-purge=false || warn "pnpm reinstall did not complete cleanly."
    fi
    cd "$ORIGINAL_DIR" || true
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

# --- Prerequisite: node + pnpm (binary gate: pnpm on PATH) ---
if [ "$READY" -eq 1 ] && ! test_pnpm_ready; then
    $SUDO mkdir -p "$GVDIR" 2>/dev/null || true
    printf 'true\n' | $SUDO tee "$GVDIR/INSTALL_NODE" >/dev/null 2>&1 || true
    invoke_step "$STEP_NODE"
    hash -r 2>/dev/null || true
    if ! test_pnpm_ready; then
        err "pnpm still missing after 17_install_node_24.sh."
        READY=0
    fi
fi

# --- Prerequisite: python (binary gate: python on PATH) ---
if [ "$READY" -eq 1 ] && ! test_python_ready; then
    invoke_step "$STEP_PYTHON"
    hash -r 2>/dev/null || true
    if ! test_python_ready; then
        err "python still missing after 13_ensure_python.sh."
        READY=0
    fi
fi
if [ "$READY" -eq 1 ]; then
    if command -v python3 >/dev/null 2>&1; then PYTHON_BIN="$(command -v python3)"; else PYTHON_BIN="$(command -v python)"; fi
fi

# --- Project dependencies (binary gate: vite.js) ---
if [ "$READY" -eq 1 ] && [ -z "$LIST_APPS" ] && ! test_vite_ready; then
    install_deps
    if ! test_vite_ready; then
        err "Dependencies incomplete (vite missing) after pnpm install."
        READY=0
    fi
fi

# --- Prerequisite: JDK 21 (central detector: java with major >= 21) ---
if [ "$READY" -eq 1 ] && [ -z "$LIST_APPS" ]; then
    android_build_resolve_java_home
    if ! android_build_java_ready; then
        invoke_step "$STEP_JAVA"
        android_build_resolve_java_home
        if ! android_build_java_ready; then
            err "JDK ${ANDROID_BUILD_REQUIRED_JAVA_MAJOR}+ still missing after 93_install_java.sh."
            READY=0
        fi
    fi
fi

# --- Prerequisite: Android SDK packages (central detector: sdkmanager + adb + platform + build-tools) ---
if [ "$READY" -eq 1 ] && [ -z "$LIST_APPS" ]; then
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
if [ "$READY" -eq 1 ] && [ -z "$LIST_APPS" ]; then
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

if [ "$READY" -eq 1 ]; then
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
else
    err "Prerequisites are not ready; build was not started."
fi

cd "$ORIGINAL_DIR" || true
if [ "$READY" -eq 1 ] && [ "$BUILD_OK" -eq 1 ]; then
    exit 0
fi
exit 1
