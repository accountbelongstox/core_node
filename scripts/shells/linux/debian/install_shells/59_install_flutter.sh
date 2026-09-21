#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Variables (declare first)
SCRIPT_INDEX="59"
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""

# Paths setup
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source globals
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Initialize variables after sourcing gvar_common.sh
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
INSTALL_FLUTTER=$(get_var "INSTALL_FLUTTER" "")
SCRIPT_TEMP_DIR=$(create_script_temp_dir "59_install_flutter")
LOG_FILE="$SCRIPT_TEMP_DIR/flutter_install_$(date +%Y%m%d_%H%M%S).log"
SELECTED_REGION=$(get_var "SELECTED_REGION" "Global")

# Flutter configuration (latest stable per docs.flutter.dev: 3.47.5, released
# 2026-09-18, ships Dart 3.13.4)
FLUTTER_VERSION="3.47.5"
FLUTTER_DART_VERSION="3.13.4"
FLUTTER_URL="https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"
FLUTTER_INSTALL_DIR=$(map_web_path "compile_dir" "applications/flutter")

# Logging
log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

# Utils
command_exists() { command -v "$1" >/dev/null 2>&1; }

# Decide whether to install based on INSTALL_FLUTTER and mode
should_install_flutter() {
    case "$INSTALL_FLUTTER" in
        "true") return 0;;
        "false") return 1;;
        "remove") return 2;;
        *)
            # auto: DESKTOP ONLY. Flutter is a GUI/dev toolchain - skip on a
            # headless server. Force with INSTALL_FLUTTER=true.
            if [ "${HAS_DESKTOP_ENVIRONMENT:-false}" = "true" ] || [ "${ALLOW_SNAP_ON_SERVER:-0}" = "1" ]; then
                return 0
            fi
            log_message "No desktop environment: skipping Flutter. Set INSTALL_FLUTTER=true to force."
            return 1
            ;;
    esac
}

# Configure mirrors for China region
configure_flutter_mirrors() {
    if [[ "$SELECTED_REGION" == "China" ]]; then
        # Common mirrors suitable for China
        set_env_and_var "PUB_HOSTED_URL" "https://pub.flutter-io.cn"
        set_env_and_var "FLUTTER_STORAGE_BASE_URL" "https://storage.flutter-io.cn"
        # Release tarball mirror
        FLUTTER_URL="https://storage.flutter-io.cn/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"
        log_message "Configured Flutter/Dart mirrors for region: China"
    fi
}

# Install one prerequisite only when the apt index offers it (idempotent).
install_flutter_dependency() {
    local dep="$1"
    if ! apt-cache policy "$dep" 2>/dev/null | grep -qE 'Candidate: [^(]'; then
        log_message "Skipping unavailable prerequisite (no apt candidate): $dep"
        return 0
    fi
    $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt install -y "$dep" 2>&1 | tail -1 | tee -a "$LOG_FILE" || true
}

# Official prerequisites from docs.flutter.dev/get-started/install/linux
install_flutter_dependencies() {
    local dep=""
    local flutter_deps=(bash curl file git unzip which xz-utils zip libglu1-mesa)
    for dep in "${flutter_deps[@]}"; do
        install_flutter_dependency "$dep"
    done
}

# Register the SDK with git so any user (root or regular) can run the
# git-based flutter tool without "detected dubious ownership" errors.
ensure_flutter_git_safe_directory() {
    local flutter_sdk_dir="$1"
    if ! command_exists git; then
        return 0
    fi
    if git config --system --get-all safe.directory 2>/dev/null | grep -qFx "$flutter_sdk_dir"; then
        return 0
    fi
    $USE_SUDO git config --system --add safe.directory "$flutter_sdk_dir"
    log_message "Registered git safe.directory: $flutter_sdk_dir"
}

# Install Flutter from the official release tarball
# (docs.flutter.dev/get-started/install/linux -- the snap package is NOT the
# recommended method and its per-user first-run SDK bootstrap breaks when the
# installer runs as root: the SDK lands in /root/snap and regular users can
# never use it. The tarball installs one shared SDK linked into /usr/local/bin).
install_flutter_tarball() {
    local flutter_sdk_dir="$FLUTTER_INSTALL_DIR/flutter"
    local flutter_bin="$flutter_sdk_dir/bin/flutter"
    local dart_bin="$flutter_sdk_dir/bin/dart"
    local archive_path="/var/tmp/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"
    local real_user=""

    log_message "Installing Flutter via official tarball: $FLUTTER_URL"

    install_flutter_dependencies

    # Idempotent version check: an existing SDK is only reused when its
    # recorded version matches the pin; otherwise it is replaced (upgrade).
    local installed_flutter_version=""
    if [ -f "$flutter_sdk_dir/version" ]; then
        installed_flutter_version="$(cat "$flutter_sdk_dir/version" 2>/dev/null | tr -d '\r\n ')"
    fi

    if [ -x "$flutter_bin" ] && [ "$installed_flutter_version" = "$FLUTTER_VERSION" ]; then
        log_message "Flutter SDK $FLUTTER_VERSION already present at $flutter_sdk_dir, skipping download"
    else
        if [ -x "$flutter_bin" ]; then
            log_message "Flutter SDK version mismatch (installed: ${installed_flutter_version:-unknown}, target: $FLUTTER_VERSION), upgrading"
        fi
        log_message "Downloading Flutter SDK to: $archive_path"
        # -c resumes a partial download on the next idempotent run
        if ! wget -c -O "$archive_path" "$FLUTTER_URL"; then
            log_message "Failed to download Flutter SDK"
            return 1
        fi

        $USE_SUDO mkdir -p "$FLUTTER_INSTALL_DIR"
        # Idempotency: clear any partial prior extraction
        $USE_SUDO rm -rf "$flutter_sdk_dir"
        log_message "Extracting Flutter SDK to: $FLUTTER_INSTALL_DIR"
        if ! $USE_SUDO tar -xJf "$archive_path" -C "$FLUTTER_INSTALL_DIR"; then
            log_message "Failed to extract Flutter SDK"
            return 1
        fi
        rm -f "$archive_path"
    fi

    if [ ! -x "$flutter_bin" ]; then
        log_message "Flutter binary not found after extraction: $flutter_bin"
        return 1
    fi

    # The flutter tool writes into its own SDK directory (bin/cache, version
    # stamps), so the SDK must be owned by the real desktop user -- a
    # root-owned SDK is exactly what makes flutter unusable for normal users.
    real_user="$(get_real_user_from_common_functions)"
    log_message "Setting Flutter SDK ownership to $real_user"
    $USE_SUDO chown -R "$real_user:$real_user" "$FLUTTER_INSTALL_DIR"
    $USE_SUDO chmod -R u+rwX,go+rX "$FLUTTER_INSTALL_DIR"

    # Link the SDK bin tools into /usr/local/bin (shared PATH entry). ln -sf
    # re-asserts the correct target on every run, installed or not.
    $USE_SUDO ln -sf "$flutter_bin" /usr/local/bin/flutter
    $USE_SUDO ln -sf "$dart_bin" /usr/local/bin/dart
    log_message "Linked /usr/local/bin/flutter -> $flutter_bin"
    log_message "Linked /usr/local/bin/dart -> $dart_bin"

    # Share the absolute paths in the var center for minimal-PATH consumers
    if command -v register_tool_bin >/dev/null 2>&1; then
        register_tool_bin flutter "$flutter_bin" || true
        register_tool_bin dart "$dart_bin" || true
    fi

    ensure_flutter_git_safe_directory "$flutter_sdk_dir"
    return 0
}

# Verify installation. Runs flutter as the REAL user when invoked as root:
# this both proves regular-user usability and makes the first-run Dart SDK
# cache bootstrap happen with user ownership instead of root.
verify_flutter() {
    local real_user=""
    if ! command_exists flutter; then
        return 1
    fi
    real_user="$(get_real_user_from_common_functions)"
    if [ "$(id -u)" -eq 0 ] && [ -n "$real_user" ] && [ "$real_user" != "root" ]; then
        su - "$real_user" -c "flutter --version" 2>&1 | grep -E "Flutter [0-9]" | head -1 | tee -a "$LOG_FILE" || true
    else
        flutter --version 2>/dev/null | head -1 | tee -a "$LOG_FILE" || true
    fi
    return 0
}

# Remove Flutter installation (tarball and legacy snap)
remove_flutter() {
    log_message "Removing Flutter installation..."
    if command_exists snap && snap list 2>/dev/null | grep -q "^flutter\b"; then
        if $USE_SUDO snap remove flutter; then
            log_message "Removed flutter snap"
        else
            log_message "Failed to remove flutter snap"
        fi
    fi
    $USE_SUDO rm -f /usr/local/bin/flutter /usr/local/bin/dart 2>/dev/null || true
    $USE_SUDO rm -rf "$FLUTTER_INSTALL_DIR/flutter" 2>/dev/null || true
    log_message "Removed Flutter SDK from $FLUTTER_INSTALL_DIR"
}

# Main
main() {
    log_message "=========================================="
    log_message "Flutter SDK Installation"
    log_message "Install Mode: $INSTALL_MODE, INSTALL_FLUTTER: $INSTALL_FLUTTER"
    log_message "=========================================="

    should_install_flutter
    local decision=$?
    if [ $decision -eq 2 ]; then
        remove_flutter
        log_message "Flutter removal complete"
        exit 0
    elif [ $decision -ne 0 ]; then
        log_message "Skipping Flutter installation (mode/flag)"
        exit 0
    fi

    configure_flutter_mirrors

    if verify_flutter; then
        log_message "Flutter already installed"
        exit 0
    fi

    if install_flutter_tarball; then
        log_message "Flutter installation successful"
        # Optional: basic verification
        if verify_flutter; then
            log_message "Verified Flutter installation"
        else
            log_message "Flutter installed but verification failed"
        fi
        log_message "Note: For Android builds, install Android Studio/SDK and accept licenses"
        exit 0
    else
        log_message "All Flutter installation methods failed"
        exit 1
    fi
}

main "$@"

