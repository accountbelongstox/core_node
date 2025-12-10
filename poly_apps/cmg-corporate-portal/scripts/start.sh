#!/bin/bash
# ============================================
# React Native Multi-App Launcher (Bash)
# Minimal wrapper - All logic in Python
# ============================================

set -e

INITIAL_DIR="$(pwd)"

cleanup() {
    cd "$INITIAL_DIR"
}
trap cleanup EXIT

# ============================================
# PATHS
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PYTHON_SCRIPTS_PATH="$SCRIPT_DIR/build_scripts/react_native_py_scripts"
PYTHON_LAUNCHER_PATH="$PYTHON_SCRIPTS_PATH/main_launcher.py"
FILE_VAR_READER_PATH="$PYTHON_SCRIPTS_PATH/sh_adapter/file_var_reader.sh"

# ============================================
# LOAD FILE VAR READER
# ============================================

source "$FILE_VAR_READER_PATH"
initialize_file_var_system "RN_BUILD"

# ============================================
# CALL PYTHON LAUNCHER
# ============================================

echo "============================================"
echo "React Native Multi-App Manager"
echo "============================================"
echo ""

# Python auto-detects project root - no parameters needed
python3 "$PYTHON_LAUNCHER_PATH"

echo ""

# ============================================
# READ SELECTION FROM PYTHON
# ============================================

MENU_SELECTION=$(get_menu_selection)
if [ -z "$MENU_SELECTION" ]; then
    echo "[INFO] No selection made, exiting"
    exit 0
fi

APP_NAMESPACE=$(json_get_nested "$MENU_SELECTION" "SelectedApp" "Name")
APP_DISPLAY_NAME=$(json_get_nested "$MENU_SELECTION" "SelectedApp" "DisplayName")
MODE=$(json_get "$MENU_SELECTION" "Mode")
PLATFORM=$(json_get "$MENU_SELECTION" "Platform")

echo "============================================"
echo "Executing Selection"
echo "============================================"
echo "App: $APP_DISPLAY_NAME ($APP_NAMESPACE)"
echo "Mode: $MODE"
echo "Platform: $PLATFORM"
echo "============================================"
echo ""

# ============================================
# READ PYTHON VARIABLES
# ============================================

FACTORY_ENABLED=$(get_global_file_var "FACTORY_BUILD_ENABLED")
if [ "$FACTORY_ENABLED" = "true" ]; then
    BUILD_DIRECTORY=$(get_global_file_var "FACTORY_BUILD_PATH")
    echo "[Factory] Using factory directory: $BUILD_DIRECTORY"
    echo ""
else
    BUILD_DIRECTORY="$PROJECT_ROOT"
fi

METRO_PORT=$(get_global_file_var "METRO_PORT")
if [ -z "$METRO_PORT" ]; then
    METRO_PORT=8081
fi

# ============================================
# POST-PYTHON SETUP (Shell executes commands)
# ============================================

# 1. Install dependencies (pnpm自己判断是否需要安装)
cd "$BUILD_DIRECTORY"
pnpm install || {
    echo "[ERROR] pnpm install failed"
}
echo ""

# 2. Scan emulator AVDs (emulator -list-avds)
EMULATOR_SCAN_REQUIRED=$(get_global_file_var "EMULATOR_SCAN_REQUIRED")
if [ "$EMULATOR_SCAN_REQUIRED" = "true" ]; then
    EMULATOR_PATH=$(get_global_file_var "EMULATOR_PATH")

    echo "[Emulator] Scanning available AVDs..."

    AVD_LIST=$("$EMULATOR_PATH" -list-avds 2>/dev/null)

    if [ -n "$AVD_LIST" ]; then
        echo "[Emulator] Found AVDs:"
        echo "$AVD_LIST" | while read avd; do
            echo "  - $avd"
        done

        # Write first AVD back to file variables
        FIRST_AVD=$(echo "$AVD_LIST" | head -1)
        set_file_var "EMULATOR_AVD" "$FIRST_AVD"
        set_file_var "EMULATOR_AVAILABLE" "true"

        echo "[Emulator] Selected AVD: $FIRST_AVD"
    else
        echo "[Emulator] No AVDs found"
        set_file_var "EMULATOR_AVAILABLE" "false"
    fi

    echo ""
fi

# ============================================
# EXECUTE COMMANDS
# ============================================

start_metro() {
    echo "[Metro] Starting Metro bundler on port $METRO_PORT..."
    cd "$BUILD_DIRECTORY"
    gnome-terminal -- bash -c "npx react-native start --port $METRO_PORT; exec bash" 2>/dev/null || \
    xterm -e "npx react-native start --port $METRO_PORT" 2>/dev/null || \
    (npx react-native start --port $METRO_PORT &)
    sleep 5
    echo "[Metro] Metro bundler started"
    echo ""
}

start_android_emulator() {
    local emulator_path="$1"
    local avd_name="$2"

    echo "[Android] Starting emulator $avd_name..."

    # Start emulator in background
    "$emulator_path" -avd "$avd_name" &>/dev/null &

    echo "[Android] Waiting for emulator to boot..."

    # Wait for emulator to appear in adb devices (max 120 seconds)
    local timeout=120
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        sleep 5
        elapsed=$((elapsed + 5))

        if adb devices | grep -q "device$"; then
            echo "[Android] Emulator ready"
            return 0
        fi

        echo "[Android] Waiting... ($elapsed/$timeout seconds)"
    done

    echo "[Android] Emulator startup timeout"
    return 1
}

build_android_app() {
    echo "[Android] Building Android app..."
    cd "$BUILD_DIRECTORY/android"
    ./gradlew assembleRelease
    echo "[Android] Build completed"
}

debug_android_app() {
    echo "[Android] Launching Android app..."

    # Check device
    if ! adb devices | grep -q "device$"; then
        echo "[Android] No device found"
        echo "[Android] Attempting to start emulator..."
        echo ""

        # Read emulator info from Python scan
        EMULATOR_AVAILABLE=$(get_global_file_var "EMULATOR_AVAILABLE")
        if [ "$EMULATOR_AVAILABLE" != "true" ]; then
            echo "[Android] No emulator available"
            echo "[Android] Please install Android SDK and create an AVD"
            return
        fi

        EMULATOR_PATH=$(get_global_file_var "EMULATOR_PATH")
        EMULATOR_AVD=$(get_global_file_var "EMULATOR_AVD")

        echo "[Android] Found emulator: $EMULATOR_PATH"
        echo "[Android] AVD: $EMULATOR_AVD"
        echo ""

        # Start emulator
        if ! start_android_emulator "$EMULATOR_PATH" "$EMULATOR_AVD"; then
            echo "[Android] Failed to start emulator"
            return
        fi

        echo ""
    else
        echo "[Android] Device found"
        echo ""
    fi

    # Start Metro
    start_metro

    # Run app
    cd "$BUILD_DIRECTORY"
    npx react-native run-android --port "$METRO_PORT"
    echo "[Android] App launched"
}

build_ios_app() {
    echo "[iOS] Building iOS app..."
    cd "$BUILD_DIRECTORY/ios"
    pod install
    xcodebuild -workspace *.xcworkspace -scheme * -configuration Release
    echo "[iOS] Build completed"
}

debug_ios_app() {
    echo "[iOS] Launching iOS app..."

    # Start Metro
    start_metro

    # Run app
    cd "$BUILD_DIRECTORY"
    npx react-native run-ios --port "$METRO_PORT"
    echo "[iOS] App launched"
}

# ============================================
# DISPATCH
# ============================================

case "${MODE}_${PLATFORM}" in
    build_android)
        build_android_app
        ;;
    debug_android)
        debug_android_app
        ;;
    build_ios)
        build_ios_app
        ;;
    debug_ios)
        debug_ios_app
        ;;
    *)
        echo "[ERROR] Unknown mode: $MODE $PLATFORM"
        ;;
esac

# ============================================
# CLEANUP
# ============================================

echo ""
echo "============================================"
echo "Completed"
echo "============================================"
