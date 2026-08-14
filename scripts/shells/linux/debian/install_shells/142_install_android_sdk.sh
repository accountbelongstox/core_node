#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Android SDK build packages for Capacitor/AGP builds (headless, no Android Studio
# required). Linux counterpart of Step62_InstallAndroidSdkPackages.ps1.
# IDEMPOTENT PER DETAIL - every component is gated by BINARY EXISTENCE and repaired
# only when missing:
#   1. SDK root      : reuse first valid existing root, else create cache root
#   2. cmdline-tools : <root>/cmdline-tools/latest/bin/sdkmanager
#   3. licenses      : accepted via sdkmanager --licenses
#   4. platform-tools: <root>/platform-tools/adb
#   5. platform      : <root>/platforms/android-36/android.jar
#   6. build-tools   : <root>/build-tools/36.0.0
# Constants and detectors are CENTRALIZED in common/android_build_env.sh
# (shared with start_build.sh). Requires JDK 21 (55_install_java.sh).

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/android_build_env.sh"

# Gates and step-local state (declared at top)
INSTALL_ANDROID_SDK=$(get_var "INSTALL_ANDROID_SDK")
SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}
SUDO=""
SDK_ROOT=""
SDKMANAGER=""
SCRIPT_TEMP_DIR=$(create_script_temp_dir "142_install_android_sdk")
ZIP_PATH="$SCRIPT_TEMP_DIR/commandlinetools-linux.zip"
EXTRACT_DIR="$SCRIPT_TEMP_DIR/extract"
CANDIDATE=""

if [ "$INSTALL_ANDROID_SDK" = "false" ]; then
    echo "Skipping Android SDK installation, INSTALL_ANDROID_SDK: $INSTALL_ANDROID_SDK"
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

# --- Resolve JDK 21 (55_install_java.sh owns the install; this step only uses it) ---
android_build_resolve_java_home
android_build_java_ready || {
    echo "[142_install_android_sdk] [!] JDK ${ANDROID_BUILD_REQUIRED_JAVA_MAJOR}+ not found. Run 55_install_java.sh first."
    exit 0
}
export JAVA_HOME="$ANDROID_BUILD_JAVA_HOME"
export PATH="${JAVA_HOME}/bin:${PATH}"
echo "[142_install_android_sdk] [OK] JDK: ${JAVA_HOME} (major ${ANDROID_BUILD_JAVA_MAJOR})"
android_build_set_java_proxy || true

# --- Detail: SDK root (binary gate: sdkmanager or adb inside the root) ---
android_build_resolve_sdk_root
SDK_ROOT="$ANDROID_BUILD_SDK_ROOT"
echo "[142_install_android_sdk] [i] SDK root: ${SDK_ROOT}"

# --- Detail: cmdline-tools (binary gate: sdkmanager) ---
SDKMANAGER="$(android_build_get_sdk_manager "$SDK_ROOT")"
if [ -z "$SDKMANAGER" ]; then
    echo "[142_install_android_sdk] [..] cmdline-tools missing -> downloading official cmdline-tools..."
    command -v curl >/dev/null 2>&1 || $SUDO apt-get install -y curl >/dev/null 2>&1 || true
    command -v unzip >/dev/null 2>&1 || $SUDO apt-get install -y unzip >/dev/null 2>&1 || true
    if command -v curl >/dev/null 2>&1; then
        curl -fL --retry 3 -o "$ZIP_PATH" "$ANDROID_BUILD_CMDLINE_TOOLS_URL" || { echo "[142_install_android_sdk] [!] cmdline-tools download failed."; exit 0; }
    else
        wget -O "$ZIP_PATH" "$ANDROID_BUILD_CMDLINE_TOOLS_URL" || { echo "[142_install_android_sdk] [!] cmdline-tools download failed."; exit 0; }
    fi
    rm -rf "$EXTRACT_DIR"
    mkdir -p "$EXTRACT_DIR"
    unzip -q "$ZIP_PATH" -d "$EXTRACT_DIR" || { echo "[142_install_android_sdk] [!] cmdline-tools extraction failed."; exit 0; }
    mkdir -p "$SDK_ROOT/cmdline-tools" 2>/dev/null || $SUDO mkdir -p "$SDK_ROOT/cmdline-tools"
    rm -rf "$SDK_ROOT/cmdline-tools/latest"
    mv "$EXTRACT_DIR/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest" || { echo "[142_install_android_sdk] [!] cmdline-tools layout not recognized."; exit 0; }
    rm -rf "$EXTRACT_DIR"
    SDKMANAGER="$(android_build_get_sdk_manager "$SDK_ROOT")"
fi
chmod +x "$SDKMANAGER" 2>/dev/null || true
if [ -z "$SDKMANAGER" ]; then
    echo "[142_install_android_sdk] [!] sdkmanager not available under: $SDK_ROOT"
    exit 0
fi
echo "[142_install_android_sdk] [OK] cmdline-tools ready: ${SDKMANAGER}"

# --- Detail: licenses (cheap, always accepted; sdkmanager keeps them recorded) ---
echo "[142_install_android_sdk] [..] Accepting Android SDK licenses..."
yes | "$SDKMANAGER" --sdk_root="$SDK_ROOT" --licenses >/dev/null 2>&1 || true

# --- Detail: platform-tools (binary gate: adb) ---
if [ -x "$SDK_ROOT/platform-tools/adb" ]; then
    echo "[142_install_android_sdk] [OK] platform-tools already present."
else
    echo "[142_install_android_sdk] [..] Installing platform-tools..."
    yes | "$SDKMANAGER" --sdk_root="$SDK_ROOT" platform-tools >/dev/null 2>&1 || echo "[142_install_android_sdk] [!] platform-tools install reported an issue."
fi

# --- Detail: platform android-36 (binary gate: android.jar) ---
if [ -f "$SDK_ROOT/platforms/android-${ANDROID_BUILD_API}/android.jar" ]; then
    echo "[142_install_android_sdk] [OK] platform android-${ANDROID_BUILD_API} already present."
else
    echo "[142_install_android_sdk] [..] Installing platforms;android-${ANDROID_BUILD_API}..."
    yes | "$SDKMANAGER" --sdk_root="$SDK_ROOT" "platforms;android-${ANDROID_BUILD_API}" >/dev/null 2>&1 || echo "[142_install_android_sdk] [!] platform install reported an issue."
fi

# --- Detail: build-tools 36.0.0 (binary gate: build-tools dir) ---
if [ -d "$SDK_ROOT/build-tools/${ANDROID_BUILD_TOOLS}" ]; then
    echo "[142_install_android_sdk] [OK] build-tools ${ANDROID_BUILD_TOOLS} already present."
else
    echo "[142_install_android_sdk] [..] Installing build-tools;${ANDROID_BUILD_TOOLS}..."
    yes | "$SDKMANAGER" --sdk_root="$SDK_ROOT" "build-tools;${ANDROID_BUILD_TOOLS}" >/dev/null 2>&1 || echo "[142_install_android_sdk] [!] build-tools install reported an issue."
fi

# --- Detail: environment variables (idempotent /etc/environment write, like 55_install_java.sh) ---
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
echo "[142_install_android_sdk] [OK] ANDROID_HOME/ANDROID_SDK_ROOT wired to: ${SDK_ROOT}"

echo "[142_install_android_sdk] [OK] Android SDK build packages step completed"
echo "============================================================"
exit 0
