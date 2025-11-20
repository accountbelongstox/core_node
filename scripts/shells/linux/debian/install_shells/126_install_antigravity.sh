#!/bin/bash
# Antigravity Installation Script (Debian/Ubuntu)
#
# Usage:
#   ./126_install_antigravity.sh           # Install (desktop default Yes, headless/WSL default No)
#   ./126_install_antigravity.sh --force   # Force install even if already present
#   ./126_install_antigravity.sh --cleanup # Remove package, repo, and desktop entries
#
# This script installs the Antigravity app from the official Google Artifact Registry
# repo and creates desktop entries so the icon shows correctly in launchers and docks.

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

# Variable declarations
SCRIPT_INDEX="126"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
ANTIGRAVITY_PACKAGE="antigravity"
REPO_LIST_FILE="/etc/apt/sources.list.d/antigravity.list"
REPO_KEY_FILE="/etc/apt/keyrings/antigravity-repo-key.gpg"
REPO_SOURCE_LINE="deb [signed-by=$REPO_KEY_FILE] https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ antigravity-debian main"
DESKTOP_ENTRY_SYSTEM="/usr/share/applications/antigravity.desktop"
DESKTOP_ENTRY_NAME="Antigravity"
DESKTOP_ENTRY_ICON="antigravity"
FORCE_INSTALL=false
CLEANUP_MODE=false

# Source shared libraries
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/installation_library.sh"

# Initialize globals (detect desktop, sudo, etc.)
init_global_vars

# Helper: log prefix
log() {
    echo "[${SCRIPT_INDEX}] $1"
}

# Parse CLI arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --force)
                FORCE_INSTALL=true
                shift
                ;;
            --cleanup)
                CLEANUP_MODE=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--force] [--cleanup]"
                exit 1
                ;;
        esac
    done
}

ensure_requirements() {
    if ! command -v apt >/dev/null 2>&1; then
        log "This script supports Debian/Ubuntu (apt) only."
        exit 1
    fi

    # Ensure sudo exists
    check_and_install_sudo >/dev/null 2>&1 || true
}

is_antigravity_installed() {
    dpkg -s "$ANTIGRAVITY_PACKAGE" >/dev/null 2>&1
}

prompt_installation_decision() {
    local default_answer
    local prompt

    if [ "$HAS_DESKTOP_ENVIRONMENT" = true ]; then
        default_answer="Y"
        prompt="[Y/n]"
        echo "Desktop environment detected."
    else
        default_answer="N"
        prompt="[y/N]"
        echo "No desktop environment detected (server/WSL)."
    fi

    read -r -p "Install $DESKTOP_ENTRY_NAME now? $prompt " user_input
    user_input=${user_input:-$default_answer}

    if [[ "$user_input" =~ ^[Yy]$ ]]; then
        return 0
    fi

    echo "Installation skipped by user choice."
    return 1
}

add_repository() {
    if [ -f "$REPO_LIST_FILE" ] && [ -f "$REPO_KEY_FILE" ]; then
        log "Repository already configured."
        return 0
    fi

    log "Configuring Antigravity repository..."
    $USE_SUDO mkdir -p "$(dirname "$REPO_KEY_FILE")"
    curl -fsSL https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg | $USE_SUDO gpg --dearmor -o "$REPO_KEY_FILE"
    echo "$REPO_SOURCE_LINE" | $USE_SUDO tee "$REPO_LIST_FILE" >/dev/null
}

remove_repository() {
    if [ -f "$REPO_LIST_FILE" ]; then
        $USE_SUDO rm -f "$REPO_LIST_FILE"
    fi
    if [ -f "$REPO_KEY_FILE" ]; then
        $USE_SUDO rm -f "$REPO_KEY_FILE"
    fi
}

install_antigravity() {
    add_repository

    log "Updating package cache..."
    $USE_SUDO apt update

    log "Installing $ANTIGRAVITY_PACKAGE..."
    DEBIAN_FRONTEND=noninteractive $USE_SUDO apt install -y "$ANTIGRAVITY_PACKAGE"
}

cleanup_antigravity() {
    log "Removing $ANTIGRAVITY_PACKAGE and repository..."
    $USE_SUDO apt remove -y "$ANTIGRAVITY_PACKAGE" >/dev/null 2>&1 || true
    remove_repository
    $USE_SUDO apt update >/dev/null 2>&1 || true

    # Remove desktop entries
    $USE_SUDO rm -f "$DESKTOP_ENTRY_SYSTEM"

    local target_home="${ACTUAL_DESKTOP_USER_HOME:-$HOME}"
    local user_desktop_entry="$target_home/.local/share/applications/antigravity.desktop"
    rm -f "$user_desktop_entry" 2>/dev/null || true

    log "Cleanup completed."
}

create_desktop_entry() {
    local exec_path
    exec_path="$(command -v antigravity || echo "/usr/bin/antigravity")"
    local startup_wm_class="antigravity"

    cat <<EOF | $USE_SUDO tee "$DESKTOP_ENTRY_SYSTEM" >/dev/null
[Desktop Entry]
Name=$DESKTOP_ENTRY_NAME
Comment=Antigravity Client
Exec=$exec_path
Icon=$DESKTOP_ENTRY_ICON
Terminal=false
Type=Application
Categories=Utility;Development;
StartupNotify=true
StartupWMClass=$startup_wm_class
EOF

    # Copy to desktop user's local applications for better integration
    detect_actual_desktop_user
    local target_home="${ACTUAL_DESKTOP_USER_HOME:-$HOME}"
    local user_app_dir="$target_home/.local/share/applications"
    mkdir -p "$user_app_dir"
    cp "$DESKTOP_ENTRY_SYSTEM" "$user_app_dir/antigravity.desktop"
    chown "$(id -u "$ACTUAL_DESKTOP_USER" 2>/dev/null || echo "$(id -u)")":"$(id -g "$ACTUAL_DESKTOP_USER" 2>/dev/null || echo "$(id -g)")" "$user_app_dir/antigravity.desktop" 2>/dev/null || true

    # Refresh desktop database if available
    if command -v update-desktop-database >/dev/null 2>&1; then
        $USE_SUDO update-desktop-database >/dev/null 2>&1 || true
    fi
}

main() {
    parse_arguments "$@"
    ensure_requirements

    if $CLEANUP_MODE; then
        cleanup_antigravity
        exit 0
    fi

    if is_antigravity_installed && ! $FORCE_INSTALL; then
        log "$DESKTOP_ENTRY_NAME is already installed. Use --force to reinstall."
        exit 0
    fi

    if ! $FORCE_INSTALL; then
        prompt_installation_decision || exit 0
    fi

    install_antigravity
    create_desktop_entry
    log "$DESKTOP_ENTRY_NAME installation finished."
}

main "$@"
