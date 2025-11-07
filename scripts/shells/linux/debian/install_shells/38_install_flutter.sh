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
SCRIPT_INDEX="38"
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
SCRIPT_TEMP_DIR=$(create_script_temp_dir "38_install_flutter")
LOG_FILE="$SCRIPT_TEMP_DIR/flutter_install_$(date +%Y%m%d_%H%M%S).log"
SELECTED_REGION=$(get_var "SELECTED_REGION" "Global")

# Flutter configuration
FLUTTER_VERSION="3.35.0"
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
            # auto: install by default (changed from desktop/full only)
            return 0
            ;;
    esac
}

# Configure mirrors for China region
configure_flutter_mirrors() {
    if [[ "$SELECTED_REGION" == "China" ]]; then
        # Common mirrors suitable for China
        set_env_and_var "PUB_HOSTED_URL" "https://pub.flutter-io.cn"
        set_env_and_var "FLUTTER_STORAGE_BASE_URL" "https://storage.flutter-io.cn"
        log_message "Configured Flutter/Dart mirrors for region: China"
    fi
}

# Ensure /snap/bin is available and flutter is on PATH
ensure_path_and_symlink() {
    $USE_SUDO ln -sf /var/lib/snapd/snap /snap 2>/dev/null || true
    if [ -x "/snap/bin/flutter" ]; then
        $USE_SUDO ln -sf "/snap/bin/flutter" "/usr/local/bin/flutter" 2>/dev/null || true
    fi
}

# Install Flutter using snap
install_flutter_snap() {
    log_message "Installing Flutter via snap..."

    if ! command_exists snap; then
        log_message "snapd not found. Installing snapd..."
        if ! timeout 300 $USE_SUDO apt update; then
            log_message "Warning: apt update failed or timed out"
        fi
        if ! timeout 600 $USE_SUDO apt install -y snapd; then
            log_message "Failed to install snapd"
            return 1
        fi
        $USE_SUDO systemctl enable --now snapd.socket || true
        $USE_SUDO ln -sf /var/lib/snapd/snap /snap 2>/dev/null || true
    fi

    if $USE_SUDO snap install flutter --classic; then
        log_message "Flutter installed via snap"
        ensure_path_and_symlink
        return 0
    else
        log_message "Failed to install Flutter via snap"
        return 1
    fi
}

# Verify installation
verify_flutter() {
    if command_exists flutter; then
        flutter --version 2>/dev/null | head -1 | tee -a "$LOG_FILE" || true
        return 0
    fi
    return 1
}

# Remove Flutter installation (snap-based)
remove_flutter() {
    log_message "Removing Flutter installation..."
    if command_exists snap && snap list 2>/dev/null | grep -q "^flutter\b"; then
        if $USE_SUDO snap remove flutter; then
            log_message "Removed flutter snap"
        else
            log_message "Failed to remove flutter snap"
        fi
    fi
    $USE_SUDO rm -f /usr/local/bin/flutter 2>/dev/null || true
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

    if install_flutter_snap; then
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

