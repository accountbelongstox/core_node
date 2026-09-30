#!/bin/bash
SCRIPT_INDEX="187"

# Android SDK build packages for Capacitor/AGP builds (headless, no Android Studio
# required). Linux counterpart of Step62_InstallAndroidSdkPackages.ps1.
# IDEMPOTENT PER DETAIL - every component is gated by BINARY EXISTENCE and repaired
# only when missing. Packages must be SDK-manager-recognized (package.xml present);
# unrecognized ones (e.g. Debian apt `adb`) are replaced through sdkmanager:
#   1. SDK root      : reuse first valid existing root, else create cache root
#   2. cmdline-tools : <root>/cmdline-tools/latest/bin/sdkmanager
#   3. licenses      : <root>/licenses/android-sdk-license (sdkmanager --licenses)
#   4. platform-tools: <root>/platform-tools/{adb,package.xml}
#   5. platform      : <root>/platforms/android-36/{android.jar,package.xml}
#   6. build-tools   : <root>/build-tools/36.0.0/{aapt2,package.xml}
# --check reports every detail and changes nothing (Windows: Step62 -Check).
# Constants and detectors are CENTRALIZED in common/android_build_env.sh
# (shared with start_build.sh). Requires JDK 21 (92_install_java.sh).

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/android_build_env.sh"

# Gates and step-local state (declared at top)
INSTALL_ANDROID_SDK=$(android_build_install_gate "$ANDROID_BUILD_SDK_GATE")
SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}
SUDO=""
SDK_ROOT=""
SDKMANAGER=""
SCRIPT_TEMP_DIR=""
ZIP_PATH=""
EXTRACT_DIR=""
CHECK_ONLY=""
CHECK_MISSING=()
ARG=""
PACKAGE_ID=""
SDK_RUN=""
PLATFORM_TOOLS_DIR=""
PLATFORM_TOOLS_ALT_DIR=""

for ARG in "$@"; do
    case "$ARG" in
        --check) CHECK_ONLY=1 ;;
        *) echo "[187_install_android_sdk] [!] Unknown option ignored: $ARG" ;;
    esac
done

# Report one detail of the --check pass.
check_detail() {
    local detail_id="$1" detail="$2" ready="$3" evidence="$4"
    if [ "$ready" -eq 1 ]; then
        echo "[187_install_android_sdk] [OK] check: ${detail} ready: ${evidence}"
    else
        echo "[187_install_android_sdk] [!] check: ${detail} missing: ${evidence}"
        CHECK_MISSING+=("$detail_id")
    fi
}

# Report-only pass: evaluates the same binary gates as the install pass and
# changes nothing (no download, no sdkmanager, no /etc/environment write).
check_android_sdk_packages() {
    local ready=0
    echo "[187_install_android_sdk] [i] Android SDK build packages check (report only)"
    echo "[187_install_android_sdk] [i] check: gate ${ANDROID_BUILD_SDK_GATE}=${INSTALL_ANDROID_SDK:-unset}"
    android_build_resolve_java_home
    if android_build_java_ready; then
        check_detail jdk "JDK ${ANDROID_BUILD_REQUIRED_JAVA_MAJOR}+" 1 "${ANDROID_BUILD_JAVA_HOME} (major ${ANDROID_BUILD_JAVA_MAJOR})"
    else
        check_detail jdk "JDK ${ANDROID_BUILD_REQUIRED_JAVA_MAJOR}+" 0 "install it with 92_install_java.sh (gate ${ANDROID_BUILD_JAVA_GATE}=$(android_build_install_gate "$ANDROID_BUILD_JAVA_GATE"))"
    fi
    android_build_resolve_sdk_root
    SDK_ROOT="$ANDROID_BUILD_SDK_ROOT"
    echo "[187_install_android_sdk] [i] check: SDK root: ${SDK_ROOT}"
    SDKMANAGER="$(android_build_get_sdk_manager "$SDK_ROOT")"
    ready=0; [ -n "$SDKMANAGER" ] && ready=1
    check_detail cmdline-tools "cmdline-tools" "$ready" "${SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager"
    ready=0; android_build_sdk_licenses_ready && ready=1
    check_detail licenses "licenses" "$ready" "${SDK_ROOT}/${ANDROID_BUILD_LICENSE_FILE}"
    while IFS= read -r PACKAGE_ID; do
        ready=0; android_build_package_managed "$SDK_ROOT" "$PACKAGE_ID" && ready=1
        check_detail "$PACKAGE_ID" "$PACKAGE_ID" "$ready" "$(android_build_package_dir "$SDK_ROOT" "$PACKAGE_ID")/package.xml"
    done < <(android_build_required_packages)
    ready=0; [ "${ANDROID_HOME:-}" = "$SDK_ROOT" ] && ready=1
    check_detail env "ANDROID_HOME" "$ready" "ANDROID_HOME=${ANDROID_HOME:-}"
    if [ "${#CHECK_MISSING[@]}" -eq 0 ]; then
        echo "[187_install_android_sdk] [OK] check: all details ready."
    else
        echo "[187_install_android_sdk] [!] check: missing: $(IFS=','; printf '%s' "${CHECK_MISSING[*]}"). Run without --check to repair them."
    fi
}

if [ -n "$CHECK_ONLY" ]; then
    check_android_sdk_packages
    exit 0
fi

if [ "$INSTALL_ANDROID_SDK" = "false" ]; then
    echo "Skipping Android SDK installation, ${ANDROID_BUILD_SDK_GATE}: $INSTALL_ANDROID_SDK"
    exit 0
fi

if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
fi

echo "============================================================"
echo " Android SDK build packages (per-detail idempotent)"
echo "============================================================"
echo "COMPILE_DIR: $COMPILE_DIR"
echo "SELECTED_REGION: $SELECTED_REGION"

# --- Resolve JDK 21 (92_install_java.sh owns the install; this step only uses it) ---
android_build_resolve_java_home
android_build_java_ready || {
    echo "[187_install_android_sdk] [!] JDK ${ANDROID_BUILD_REQUIRED_JAVA_MAJOR}+ not found. Run 92_install_java.sh first."
    exit 0
}
export JAVA_HOME="$ANDROID_BUILD_JAVA_HOME"
export PATH="${JAVA_HOME}/bin:${PATH}"
echo "[187_install_android_sdk] [OK] JDK: ${JAVA_HOME} (major ${ANDROID_BUILD_JAVA_MAJOR})"
android_build_set_java_proxy || true

# --- Detail: SDK root (binary gate: sdkmanager or adb inside the root) ---
android_build_resolve_sdk_root
SDK_ROOT="$ANDROID_BUILD_SDK_ROOT"
echo "[187_install_android_sdk] [i] SDK root: ${SDK_ROOT}"

# --- Detail: cmdline-tools (binary gate: sdkmanager) ---
SDKMANAGER="$(android_build_get_sdk_manager "$SDK_ROOT")"
if [ -z "$SDKMANAGER" ]; then
    echo "[187_install_android_sdk] [..] cmdline-tools missing -> downloading official cmdline-tools..."
    SCRIPT_TEMP_DIR=$(create_script_temp_dir "187_install_android_sdk")
    ZIP_PATH="$SCRIPT_TEMP_DIR/commandlinetools-linux.zip"
    EXTRACT_DIR="$SCRIPT_TEMP_DIR/extract"
    command -v curl >/dev/null 2>&1 || $SUDO apt-get install -y curl >/dev/null 2>&1 || true
    command -v unzip >/dev/null 2>&1 || $SUDO apt-get install -y unzip >/dev/null 2>&1 || true
    if command -v curl >/dev/null 2>&1; then
        curl -fL --retry 3 -o "$ZIP_PATH" "$ANDROID_BUILD_CMDLINE_TOOLS_URL" || { echo "[187_install_android_sdk] [!] cmdline-tools download failed."; exit 0; }
    else
        wget -O "$ZIP_PATH" "$ANDROID_BUILD_CMDLINE_TOOLS_URL" || { echo "[187_install_android_sdk] [!] cmdline-tools download failed."; exit 0; }
    fi
    rm -rf "$EXTRACT_DIR"
    mkdir -p "$EXTRACT_DIR"
    unzip -q "$ZIP_PATH" -d "$EXTRACT_DIR" || { echo "[187_install_android_sdk] [!] cmdline-tools extraction failed."; exit 0; }
    mkdir -p "$SDK_ROOT/cmdline-tools" 2>/dev/null || $SUDO mkdir -p "$SDK_ROOT/cmdline-tools"
    rm -rf "$SDK_ROOT/cmdline-tools/latest"
    mv "$EXTRACT_DIR/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest" || { echo "[187_install_android_sdk] [!] cmdline-tools layout not recognized."; exit 0; }
    rm -rf "$EXTRACT_DIR"
    SDKMANAGER="$(android_build_get_sdk_manager "$SDK_ROOT")"
fi
chmod +x "$SDKMANAGER" 2>/dev/null || true
if [ -z "$SDKMANAGER" ]; then
    echo "[187_install_android_sdk] [!] sdkmanager not available under: $SDK_ROOT"
    exit 0
fi
echo "[187_install_android_sdk] [OK] cmdline-tools ready: ${SDKMANAGER}"

# --- Detail: licenses (file gate: licenses/android-sdk-license; package installs below also accept inline) ---
if android_build_sdk_licenses_ready; then
    echo "[187_install_android_sdk] [OK] Android SDK licenses already accepted."
else
    echo "[187_install_android_sdk] [..] Accepting Android SDK licenses..."
    yes | "$SDKMANAGER" --sdk_root="$SDK_ROOT" --licenses >/dev/null 2>&1 || true
fi

# --- Details: SDK packages (gate: SDK-manager-recognized = package.xml + binary) ---
SDK_RUN=""
[ -w "$SDK_ROOT" ] || SDK_RUN="$SUDO"
PLATFORM_TOOLS_DIR="$SDK_ROOT/platform-tools"
PLATFORM_TOOLS_ALT_DIR="$SDK_ROOT/platform-tools-2"
while IFS= read -r PACKAGE_ID; do
    echo "[187_install_android_sdk] [OK] ${PACKAGE_ID} recognized by the SDK manager."
done < <(android_build_required_packages | grep -vxFf <(android_build_missing_packages "$SDK_ROOT") || true)

# platform-tools: fold an AGP auto-install (platform-tools-2) back, else replace an
# unmanaged copy (Debian apt adb) via sdkmanager. adb keeps the same path; a
# running server is restarted with the managed binary.
if ! android_build_package_managed "$SDK_ROOT" "platform-tools"; then
    echo "[187_install_android_sdk] [..] platform-tools not SDK-managed -> repairing..."
    if [ -f "$PLATFORM_TOOLS_ALT_DIR/package.xml" ] && [ -x "$PLATFORM_TOOLS_ALT_DIR/adb" ]; then
        $SDK_RUN rm -rf "$PLATFORM_TOOLS_DIR"
        $SDK_RUN mv "$PLATFORM_TOOLS_ALT_DIR" "$PLATFORM_TOOLS_DIR"
    else
        $SDK_RUN rm -rf "$PLATFORM_TOOLS_DIR"
        yes | $SDK_RUN "$SDKMANAGER" --sdk_root="$SDK_ROOT" platform-tools >/dev/null 2>&1 || echo "[187_install_android_sdk] [!] platform-tools install reported an issue."
    fi
    if [ -x "$PLATFORM_TOOLS_DIR/adb" ] && pgrep -x adb >/dev/null 2>&1; then
        "$PLATFORM_TOOLS_DIR/adb" kill-server >/dev/null 2>&1 || true
        "$PLATFORM_TOOLS_DIR/adb" start-server >/dev/null 2>&1 || true
    fi
fi
# A managed platform-tools makes any leftover platform-tools-2 (AGP duplicate) stale.
if android_build_package_managed "$SDK_ROOT" "platform-tools" && [ -d "$PLATFORM_TOOLS_ALT_DIR" ]; then
    $SDK_RUN rm -rf "$PLATFORM_TOOLS_ALT_DIR"
fi

# platforms and build-tools: install exactly the unrecognized packages.
while IFS= read -r PACKAGE_ID; do
    [ "$PACKAGE_ID" = "platform-tools" ] && continue
    echo "[187_install_android_sdk] [..] Installing ${PACKAGE_ID}..."
    $SDK_RUN rm -rf "$(android_build_package_dir "$SDK_ROOT" "$PACKAGE_ID")"
    yes | $SDK_RUN "$SDKMANAGER" --sdk_root="$SDK_ROOT" "$PACKAGE_ID" >/dev/null 2>&1 || echo "[187_install_android_sdk] [!] ${PACKAGE_ID} install reported an issue."
done < <(android_build_missing_packages "$SDK_ROOT")

# --- Detail: environment variables (idempotent /etc/environment write, like 92_install_java.sh) ---
if [ "$(id -u)" -eq 0 ]; then
    sed -i '/^ANDROID_HOME=/d; /^ANDROID_SDK_ROOT=/d' /etc/environment 2>/dev/null || true
    printf 'ANDROID_HOME="%s"\nANDROID_SDK_ROOT="%s"\n' "$SDK_ROOT" "$SDK_ROOT" | tee -a /etc/environment >/dev/null
else
    $SUDO sed -i '/^ANDROID_HOME=/d; /^ANDROID_SDK_ROOT=/d' /etc/environment 2>/dev/null || true
    printf 'ANDROID_HOME="%s"\nANDROID_SDK_ROOT="%s"\n' "$SDK_ROOT" "$SDK_ROOT" | $SUDO tee -a /etc/environment >/dev/null
fi
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="${SDK_ROOT}/platform-tools:${SDK_ROOT}/cmdline-tools/latest/bin:${PATH}"
echo "[187_install_android_sdk] [OK] ANDROID_HOME/ANDROID_SDK_ROOT wired to: ${SDK_ROOT}"

echo "[187_install_android_sdk] [OK] Android SDK build packages step completed"
echo "============================================================"
exit 0
