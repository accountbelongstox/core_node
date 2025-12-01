#!/bin/bash
# Antigravity Installation Script (Debian/Ubuntu)
#
# Usage:
#   ./126_install_antigravity.sh              # Install (root mode with pkexec, will prompt)
#   ./126_install_antigravity.sh --force      # Force install even if already present
#   ./126_install_antigravity.sh --cleanup    # Remove package, repo, and desktop entries
#   ./126_install_antigravity.sh --no-root    # Install in normal mode (no pkexec)
#
# This script installs the Antigravity app from the official Google Artifact Registry
# repo and creates desktop entries. By default, it runs with root privileges (pkexec)
# and will prompt for password when launching the app.

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
USE_ROOT_MODE=true  # Default to root mode (pkexec)

# Source shared libraries
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"

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
            --no-root)
                USE_ROOT_MODE=false
                shift
                ;;
            --fix-desktop)
                FIX_DESKTOP_MODE=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--force] [--cleanup] [--no-root] [--fix-desktop]"
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

# Prompt for root mode selection
prompt_root_mode_selection() {
    # Skip prompt if explicitly set via command line
    if [[ "$FORCE_INSTALL" == "true" ]]; then
        return 0
    fi

    echo ""
    echo "=========================================="
    echo "Root Privileges Configuration"
    echo "=========================================="
    echo ""
    echo "Do you want to install $DESKTOP_ENTRY_NAME with root privileges (pkexec)?"
    echo ""
    echo "Root mode features:"
    echo "  - Runs with elevated privileges via pkexec"
    echo "  - Will prompt for password when launching"
    echo "  - Useful for apps needing system access"
    echo ""
    echo "Normal mode:"
    echo "  - Runs with user privileges"
    echo "  - No password prompt"
    echo ""
    echo -n "Use root privileges (pkexec)? [Y/n]: "
    read -r user_input
    user_input=${user_input:-Y}

    if [[ "$user_input" =~ ^[Nn]$ ]]; then
        log "Installing in normal mode (no root)"
        USE_ROOT_MODE=false
    else
        log "Installing in root mode (with pkexec)"
        USE_ROOT_MODE=true
    fi

    return 0
}

# Function: Wait for apt lock to be released (max 60 seconds)
wait_for_apt_lock() {
    local max_wait=60
    local waited=0
    local lock_files=(
        "/var/lib/dpkg/lock"
        "/var/lib/dpkg/lock-frontend"
        "/var/lib/apt/lists/lock"
        "/var/cache/apt/archives/lock"
    )

    while [ $waited -lt $max_wait ]; do
        local locks_held=false

        for lock_file in "${lock_files[@]}"; do
            if $USE_SUDO fuser "$lock_file" >/dev/null 2>&1; then
                locks_held=true
                break
            fi
        done

        if [ "$locks_held" = false ]; then
            if [ $waited -gt 0 ]; then
                log "APT lock released after ${waited}s, continuing..."
            fi
            return 0
        fi

        if [ $waited -eq 0 ]; then
            log "APT is locked by another process, waiting (max ${max_wait}s)..."
        fi

        sleep 1
        waited=$((waited + 1))
    done

    log "ERROR: APT still locked after ${max_wait}s, skipping operation"
    return 1
}

# Function: Add Antigravity repository
add_repository() {
    if [ -f "$REPO_LIST_FILE" ] && [ -f "$REPO_KEY_FILE" ]; then
        log "Repository already configured."
        return 0
    fi

    log "Adding Antigravity repository..."
    log "Repository: https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/"

    # Create keyring directory if not exists
    $USE_SUDO mkdir -p "$(dirname "$REPO_KEY_FILE")"

    # Download and add GPG key
    log "Downloading repository signing key..."
    if curl -fsSL https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg | $USE_SUDO gpg --dearmor -o "$REPO_KEY_FILE"; then
        log "Repository key added successfully"
    else
        log "ERROR: Failed to download repository key"
        return 1
    fi

    # Add repository source
    log "Adding repository source to $REPO_LIST_FILE"
    echo "$REPO_SOURCE_LINE" | $USE_SUDO tee "$REPO_LIST_FILE" >/dev/null

    if [ -f "$REPO_LIST_FILE" ]; then
        log "Repository added successfully"
        return 0
    else
        log "ERROR: Failed to add repository"
        return 1
    fi
}

# Function: Remove Antigravity repository
remove_repository() {
    log "Removing Antigravity repository..."

    local repo_removed=false

    # Remove repository list file
    if [ -f "$REPO_LIST_FILE" ]; then
        log "Removing repository source: $REPO_LIST_FILE"
        $USE_SUDO rm -f "$REPO_LIST_FILE"
        repo_removed=true
    fi

    # Remove repository key
    if [ -f "$REPO_KEY_FILE" ]; then
        log "Removing repository key: $REPO_KEY_FILE"
        $USE_SUDO rm -f "$REPO_KEY_FILE"
        repo_removed=true
    fi

    if [ "$repo_removed" = true ]; then
        log "Repository removed successfully"
        # Update apt cache to reflect repository removal
        log "Updating package cache..."
        $USE_SUDO apt update >/dev/null 2>&1 || true
    else
        log "No repository files found to remove"
    fi

    return 0
}

install_antigravity() {
    # Step 1: Add repository
    log "Step 1/4: Adding Antigravity repository..."
    if ! add_repository; then
        log "ERROR: Failed to add repository"
        return 1
    fi

    # Step 2: Update package cache
    log "Step 2/4: Updating package cache..."
    if ! wait_for_apt_lock; then
        remove_repository
        return 1
    fi
    if ! $USE_SUDO apt update; then
        log "ERROR: Failed to update package cache"
        remove_repository
        return 1
    fi

    # Step 3: Install package
    log "Step 3/4: Installing $ANTIGRAVITY_PACKAGE..."
    if ! wait_for_apt_lock; then
        remove_repository
        return 1
    fi
    if DEBIAN_FRONTEND=noninteractive $USE_SUDO apt install -y "$ANTIGRAVITY_PACKAGE"; then
        log "Package installed successfully"
    else
        log "ERROR: Failed to install package"
        remove_repository
        return 1
    fi

    # Step 4: Remove repository immediately after installation
    log "Step 4/4: Removing repository (cleanup after installation)..."
    remove_repository

    log "Installation completed successfully"
    return 0
}

# Function: Update Antigravity (add repo → upgrade → remove repo)
update_antigravity() {
    log "Updating $ANTIGRAVITY_PACKAGE..."

    # Step 1: Add repository
    log "Step 1/4: Adding Antigravity repository..."
    if ! add_repository; then
        log "ERROR: Failed to add repository"
        return 1
    fi

    # Step 2: Update package cache
    log "Step 2/4: Updating package cache..."
    if ! wait_for_apt_lock; then
        remove_repository
        return 1
    fi
    if ! $USE_SUDO apt update; then
        log "ERROR: Failed to update package cache"
        remove_repository
        return 1
    fi

    # Step 3: Upgrade package
    log "Step 3/4: Upgrading $ANTIGRAVITY_PACKAGE..."
    if ! wait_for_apt_lock; then
        remove_repository
        return 1
    fi
    if DEBIAN_FRONTEND=noninteractive $USE_SUDO apt install --only-upgrade -y "$ANTIGRAVITY_PACKAGE"; then
        log "Package upgraded successfully"
    else
        log "WARNING: Package may already be at latest version or upgrade failed"
    fi

    # Step 4: Remove repository immediately after update
    log "Step 4/4: Removing repository (cleanup after update)..."
    remove_repository

    log "Update completed"
    return 0
}

# Function: Prompt user to update if already installed
prompt_update_decision() {
    local default_answer="N"
    local prompt="[y/N]"

    echo ""
    log "$DESKTOP_ENTRY_NAME is already installed."
    read -r -p "Do you want to update it? $prompt " user_input
    user_input=${user_input:-$default_answer}

    if [[ "$user_input" =~ ^[Yy]$ ]]; then
        return 0
    fi

    echo "Update skipped by user choice."
    return 1
}

cleanup_antigravity() {
    log "Removing $ANTIGRAVITY_PACKAGE and repository..."
    $USE_SUDO apt remove -y "$ANTIGRAVITY_PACKAGE" >/dev/null 2>&1 || true
    remove_repository
    $USE_SUDO apt update >/dev/null 2>&1 || true

    # Remove desktop entries (both old and new styles)
    $USE_SUDO rm -f "$DESKTOP_ENTRY_SYSTEM"

    # Remove user desktop entries
    local target_home="${ACTUAL_DESKTOP_USER_HOME:-$HOME}"
    local user_desktop_entry="$target_home/.local/share/applications/antigravity.desktop"
    rm -f "$user_desktop_entry" 2>/dev/null || true

    # Remove core_node desktop entries (created by desktop_entry_manager)
    local user_core_node_desktop="$target_home/.local/share/applications/core_node_antigravity.desktop"
    rm -f "$user_core_node_desktop" 2>/dev/null || true
    $USE_SUDO rm -f "/usr/share/applications/core_node_antigravity.desktop" 2>/dev/null || true

    # Remove launcher script (created by desktop_entry_manager)
    $USE_SUDO rm -f "/usr/local/super_scripts/antigravity.sh" 2>/dev/null || true

    log "Cleanup completed."
}

# Scan and replace all existing Antigravity desktop entries
scan_and_replace_desktop_entries() {
    log "Scanning for existing Antigravity desktop entries..."

    # Find the launcher script created by desktop_entry_manager.sh
    local launcher_script_pattern="/usr/local/super_scripts/antigravity*launcher.sh"
    local launcher_script=""

    # Find existing launcher script (created by desktop_entry_manager)
    for script in $launcher_script_pattern; do
        if [[ -x "$script" ]]; then
            launcher_script="$script"
            break
        fi
    done

    local original_binary="/usr/bin/antigravity"
    local target_exec=""

    # Determine target exec command based on root mode
    if [[ "$USE_ROOT_MODE" == "true" ]]; then
        if [[ -n "$launcher_script" ]]; then
            target_exec="$launcher_script"
            log "Will update desktop entries to use launcher script: $launcher_script"
        else
            log "WARNING: Launcher script not found, keeping original binary"
            target_exec="$original_binary"
        fi
    else
        target_exec="$original_binary"
        log "Will update desktop entries to use original binary (normal mode)"
    fi

    # All possible desktop file locations
    local search_paths=(
        "/usr/share/applications"
        "/usr/local/share/applications"
        "$HOME/.local/share/applications"
    )

    # Add desktop user's path if different
    if [[ -n "${ACTUAL_DESKTOP_USER_HOME:-}" ]] && [[ "$ACTUAL_DESKTOP_USER_HOME" != "$HOME" ]]; then
        search_paths+=("$ACTUAL_DESKTOP_USER_HOME/.local/share/applications")
    fi

    local files_updated=0
    local desktop_files=()

    # Find all antigravity desktop files (EXCLUDE core_node_* files created by desktop_entry_manager)
    for search_path in "${search_paths[@]}"; do
        if [[ -d "$search_path" ]]; then
            while IFS= read -r -d '' desktop_file; do
                # Skip core_node_* files (managed by desktop_entry_manager)
                if [[ "$desktop_file" == *"core_node_"* ]]; then
                    continue
                fi
                desktop_files+=("$desktop_file")
            done < <(find "$search_path" -maxdepth 1 -name "*antigravity*.desktop" -type f -print0 2>/dev/null)
        fi
    done

    if [[ ${#desktop_files[@]} -eq 0 ]]; then
        log "No existing Antigravity desktop entries found (excluding core_node entries)"
        return 0
    fi

    log "Found ${#desktop_files[@]} Antigravity desktop file(s) to update"

    # Update each desktop file
    for desktop_file in "${desktop_files[@]}"; do
        log "Processing: $desktop_file"

        # Check current Exec= line to prevent recursion
        local current_exec=$(grep "^Exec=" "$desktop_file" 2>/dev/null | sed 's/^Exec=//')

        # Skip if already pointing to the target
        if [[ "$current_exec" == "$target_exec"* ]]; then
            log "  ⊘ Already correct, skipping"
            continue
        fi

        # Skip if pointing to any launcher script (prevent recursion)
        if [[ "$current_exec" == *"/super_scripts/"* ]]; then
            log "  ⊘ Already using launcher script, skipping"
            continue
        fi

        # Update the desktop file
        if [[ ! -w "$desktop_file" ]]; then
            # Try with sudo
            if [[ -n "$USE_SUDO" ]]; then
                # Backup original
                $USE_SUDO cp "$desktop_file" "$desktop_file.bak" 2>/dev/null || true

                # Update Exec line (only if pointing to original binary)
                $USE_SUDO sed -i "s|^Exec=/usr/bin/antigravity\(.*\)|Exec=$target_exec\1|g" "$desktop_file"

                # Ensure Icon is correct
                $USE_SUDO sed -i "s|^Icon=.*|Icon=antigravity|g" "$desktop_file"

                # Ensure StartupWMClass is correct
                if ! grep -q "^StartupWMClass=" "$desktop_file"; then
                    echo "StartupWMClass=antigravity" | $USE_SUDO tee -a "$desktop_file" >/dev/null
                fi

                files_updated=$((files_updated + 1))
                log "  ✓ Updated (with sudo)"
            else
                log "  ✗ Skipped (not writable, no sudo)"
            fi
        else
            # Backup original
            cp "$desktop_file" "$desktop_file.bak" 2>/dev/null || true

            # Update Exec line (only if pointing to original binary)
            sed -i "s|^Exec=/usr/bin/antigravity\(.*\)|Exec=$target_exec\1|g" "$desktop_file"

            # Ensure Icon is correct
            sed -i "s|^Icon=.*|Icon=antigravity|g" "$desktop_file"

            # Ensure StartupWMClass is correct
            if ! grep -q "^StartupWMClass=" "$desktop_file"; then
                echo "StartupWMClass=antigravity" >> "$desktop_file"
            fi

            files_updated=$((files_updated + 1))
            log "  ✓ Updated"
        fi
    done

    log "Updated $files_updated desktop file(s)"

    # Refresh desktop database
    refresh_desktop_database

    return 0
}

# Refresh desktop icon cache and database
refresh_desktop_database() {
    log "Refreshing desktop database and icon cache..."

    # Update desktop database
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database ~/.local/share/applications 2>/dev/null || true
        $USE_SUDO update-desktop-database /usr/share/applications 2>/dev/null || true
        $USE_SUDO update-desktop-database /usr/local/share/applications 2>/dev/null || true
        log "  ✓ Desktop database updated"
    fi

    # Update icon cache
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
        gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor 2>/dev/null || true
        $USE_SUDO gtk-update-icon-cache -f -t /usr/share/icons/hicolor 2>/dev/null || true
        log "  ✓ Icon cache updated"
    fi

    # Update MIME database
    if command -v update-mime-database >/dev/null 2>&1; then
        update-mime-database ~/.local/share/mime 2>/dev/null || true
        $USE_SUDO update-mime-database /usr/share/mime 2>/dev/null || true
        log "  ✓ MIME database updated"
    fi

    # Kill and restart any running panel/dock processes to reload icons
    if pgrep -x gnome-shell >/dev/null 2>&1; then
        # GNOME Shell - no need to restart, it will reload automatically
        log "  ℹ GNOME Shell detected (will auto-reload)"
    fi

    log "Desktop refresh completed"
}

create_desktop_entry() {
    local desktop_manager_script="$PARENT_DIR_LEVEL_1/debian_com/desktop_entry_manager.sh"

    if [[ ! -x "$desktop_manager_script" ]]; then
        log "WARNING: desktop_entry_manager.sh not found or not executable"
        log "Falling back to simple desktop entry creation"
        create_desktop_entry_fallback
        return $?
    fi

    log "Creating desktop entry via desktop_entry_manager.sh"

    local exec_path
    exec_path="$(command -v antigravity || echo "/usr/bin/antigravity")"

    # Verify binary exists
    if [[ ! -x "$exec_path" ]]; then
        log "ERROR: Antigravity binary not found at $exec_path"
        return 1
    fi

    # NOTE: Recursion prevention is handled automatically by desktop_entry_manager.sh
    # If $exec_path is already a launcher script, desktop_entry_manager.sh will extract
    # the original binary and create a new launcher pointing to it. This prevents
    # launcher-wrapping-launcher recursion when the script runs repeatedly.

    # Parameters for desktop_entry_manager.sh --create-app:
    # <name> <display_name> <binary> <icon> [category] [description] [wm_class] [userdata_dir] [use_root_mode]
    local app_name="antigravity"
    local app_display_name="Antigravity"
    local app_binary="$exec_path"
    local app_icon="antigravity"
    local app_category="Utility;Development;"
    local app_description="Antigravity Client"
    local app_wm_class="antigravity"
    local app_userdata_dir=""  # No specific userdata dir needed

    if ! "$desktop_manager_script" --create-app \
        "$app_name" \
        "$app_display_name" \
        "$app_binary" \
        "$app_icon" \
        "$app_category" \
        "$app_description" \
        "$app_wm_class" \
        "$app_userdata_dir" \
        "$USE_ROOT_MODE"; then
        log "WARNING: desktop_entry_manager.sh --create-app encountered an error"
        log "Falling back to simple desktop entry creation"
        create_desktop_entry_fallback
        return $?
    fi

    log "Desktop entry created successfully"

    # Scan and replace all existing Antigravity desktop entries
    scan_and_replace_desktop_entries

    if [[ "$USE_ROOT_MODE" == "true" ]]; then
        log "Note: Application will launch with root privileges (pkexec)"
        log "      You will be prompted for password when launching"
    fi

    return 0
}

# Fallback: Simple desktop entry creation (old method)
create_desktop_entry_fallback() {
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
    cp "$DESKTOP_ENTRY_SYSTEM" "$user_app_dir/antigravity.desktop" 2>/dev/null || true
    chown "$(id -u "$ACTUAL_DESKTOP_USER" 2>/dev/null || echo "$(id -u)")":"$(id -g "$ACTUAL_DESKTOP_USER" 2>/dev/null || echo "$(id -g)")" "$user_app_dir/antigravity.desktop" 2>/dev/null || true

    log "Fallback desktop entry created"

    # Scan and replace all existing Antigravity desktop entries
    scan_and_replace_desktop_entries

    return 0
}

main() {
    parse_arguments "$@"
    ensure_requirements

    # Handle cleanup mode
    if $CLEANUP_MODE; then
        cleanup_antigravity
        exit 0
    fi

    # Check if already installed
    if is_antigravity_installed; then
        if $FORCE_INSTALL; then
            log "Forcing reinstallation..."
            install_antigravity
            create_desktop_entry
            log "$DESKTOP_ENTRY_NAME reinstallation finished."
            exit 0
        fi

        # Already installed - prompt for update
        if prompt_update_decision; then
            update_antigravity
            log "$DESKTOP_ENTRY_NAME update finished."
        fi
        exit 0
    fi

    # Not installed - handle installation based on environment
    if [ "$HAS_DESKTOP_ENVIRONMENT" = true ]; then
        # Desktop environment: Install directly but ask for root mode first
        log "Desktop environment detected - installing $DESKTOP_ENTRY_NAME..."
        prompt_root_mode_selection
        install_antigravity
        create_desktop_entry
        log "$DESKTOP_ENTRY_NAME installation finished."
    else
        # Non-desktop environment: Prompt user (default No)
        if prompt_installation_decision; then
            prompt_root_mode_selection
            install_antigravity
            create_desktop_entry
            log "$DESKTOP_ENTRY_NAME installation finished."
        fi
    fi
}

main "$@"
