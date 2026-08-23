#!/bin/bash

# Resolve a stable download directory for this run
resolve_cursor_download_dir() {
    local download_dir="$PRIMARY_DOWNLOAD_DIR"
    if [[ -z "$download_dir" ]] || [[ ! -d "$download_dir" ]]; then
        download_dir=$(find /home -maxdepth 2 -type d -name "Downloads" 2>/dev/null | head -1)
    fi
    if [[ -z "$download_dir" ]] || [[ ! -d "$download_dir" ]]; then
        download_dir="/tmp"
    fi
    echo "$download_dir"
}

# Find newest Cursor installer file in a single directory (no cross-user scanning here)
# Returns full path on stdout, or empty string if not found
find_newest_cursor_installer_in_dir() {
    local dir="$1"
    if [[ -z "$dir" ]] || [[ ! -d "$dir" ]]; then
        echo ""
        return 1
    fi

    # Match dynamic filenames (Cursor-*.AppImage, cursor-*.deb, etc.)
    # Use -iname to be case-insensitive and allow any prefix that contains "cursor".
    local newest=""
    newest=$(find "$dir" -maxdepth 1 -type f \( -iname "*cursor*.AppImage" -o -iname "*cursor*.deb" \) \
        -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)

    if [[ -n "$newest" ]] && [[ -f "$newest" ]]; then
        echo "$newest"
        return 0
    fi

    echo ""
    return 1
}

# Verify installer file by file signals (no exit-code trust)
verify_cursor_installer_file() {
    local file="$1"
    if [[ -z "$file" ]] || [[ ! -f "$file" ]]; then
        return 1
    fi

    # Size threshold to reject partial downloads / HTML pages
    local size_bytes
    size_bytes=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo "0")
    if [[ "$size_bytes" -lt 52428800 ]]; then
        return 1
    fi

    return 0
}

# Extract version from filename (use full filename without extension as version)
# Returns: Version string (e.g., "Cursor-2.1.41-x86_64") or empty string if not found
get_remote_cursor_version() {
    local api_url="$CURSOR_API_URL"
    local user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    local final_url=""

    # Try wget first (bounded so the idempotent version check never hangs)
    if command -v wget >/dev/null 2>&1; then
        final_url=$(wget --spider --server-response \
            --user-agent="$user_agent" \
            --max-redirect=10 --timeout=15 --tries=1 \
            "$api_url" 2>&1 | grep -i "Location:" | tail -1 | awk '{print $2}' | tr -d '\r')
    fi

    # Try curl if wget failed (bounded with connect/total timeouts)
    if [[ -z "$final_url" ]] && command -v curl >/dev/null 2>&1; then
        final_url=$(curl -sIL \
            -A "$user_agent" \
            --max-redirs 10 --connect-timeout 10 --max-time 25 \
            "$api_url" | grep -i "^location:" | tail -1 | awk '{print $2}' | tr -d '\r')
    fi

    if [[ -z "$final_url" ]]; then
        return 1
    fi

    # Extract filename from URL and remove extension
    local filename=$(basename "$final_url")
    filename="${filename%%\?*}"  # Remove query parameters
    local version_string="${filename%.*}"  # Remove extension

    if [[ -n "$version_string" ]]; then
        echo "$version_string"
        return 0
    fi

    return 1
}

# Get installed version
get_installed_version() {
    if [[ -f "$CURSOR_INSTALLED_FLAG" ]]; then
        grep "^VERSION=" "$CURSOR_INSTALLED_FLAG" 2>/dev/null | cut -d= -f2
    fi
}

# Get installed type
get_installed_type() {
    if [[ -f "$CURSOR_INSTALLED_FLAG" ]]; then
        grep "^TYPE=" "$CURSOR_INSTALLED_FLAG" 2>/dev/null | cut -d= -f2
    fi
}

# Save installation info
save_installation_info() {
    local version="$1"
    local package_file="$2"
    local install_type="$3"

    # Create app versions directory if it doesn't exist
    $USE_SUDO mkdir -p "$APP_VERSIONS_DIR"

    # Save version info to GLOBAL_VAR_DIR
    cat <<EOF | $USE_SUDO tee "$CURSOR_INSTALLED_FLAG" > /dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
TYPE=$install_type
PACKAGE=$(basename "$package_file")
PATH=$package_file
EOF
}

# Check if Cursor is already installed and configured
is_cursor_installed() {
    if [[ -f "$CURSOR_INSTALLED_FLAG" ]]; then
        return 0  # Installed
    fi
    return 1  # Not installed
}

# DEPRECATED: This function is no longer used
# Use find_file_in_downloads_from_common_functions() instead
# Find Cursor files in all user Downloads directories

# Remove old installer files from Downloads directories
find_and_remove_old_installers() {
    local pattern="$1"
    local search_dirs=()

    # Add global shared download directory first
    if [ -n "$CORE_NODE_SHARED_DOWNLOADS" ] && [ -d "$CORE_NODE_SHARED_DOWNLOADS" ]; then
        search_dirs+=("$CORE_NODE_SHARED_DOWNLOADS")
    fi

    # Add current user's Downloads
    if [[ -d "$HOME/Downloads" ]]; then
        search_dirs+=("$HOME/Downloads")
    fi

    # Add all other users' Downloads directories
    if [[ -d "/home" ]]; then
        for user_home in /home/*; do
            if [[ -d "$user_home/Downloads" ]]; then
                search_dirs+=("$user_home/Downloads")
            fi
        done
    fi

    # Add root's Downloads
    if [ -d "/root/Downloads" ]; then
        search_dirs+=("/root/Downloads")
    fi

    # Find and remove matching files
    local files_removed=0
    for dir in "${search_dirs[@]}"; do
        while IFS= read -r -d '' file; do
            print_info_from_common_functions "  Removing: $(basename "$file")"
            rm -f "$file" 2>/dev/null || true
            files_removed=$((files_removed + 1))
        done < <(find "$dir" -maxdepth 1 -iname "$pattern" -type f -print0 2>/dev/null)
    done

    if [[ $files_removed -gt 0 ]]; then
        print_success_from_common_functions "Removed $files_removed old installer file(s)"
    else
        print_info_from_common_functions "No old installer files found to remove"
    fi

    return 0
}

# Filter out installer-related PIDs when terminating processes
should_skip_pid() {
    local pid="$1"

    if [[ -z "$pid" ]]; then
        return 0
    fi

    if [[ -n "$CURRENT_SCRIPT_PID" ]] && [[ "$pid" == "$CURRENT_SCRIPT_PID" ]]; then
        return 0
    fi

    if [[ -n "$PARENT_SCRIPT_PID" ]] && [[ "$pid" == "$PARENT_SCRIPT_PID" ]]; then
        return 0
    fi

    if [[ -n "$SCRIPT_BASHPID" ]] && [[ "$pid" == "$SCRIPT_BASHPID" ]]; then
        return 0
    fi

    if [[ -n "$BASHPID" ]] && [[ "$pid" == "$BASHPID" ]]; then
        return 0
    fi

    return 1
}

get_filtered_process_pids() {
    local process_name="$1"
    local raw_pids
    local filtered_pids=""

    raw_pids=$(pgrep -f "$process_name" 2>/dev/null)

    for pid in $raw_pids; do
        if should_skip_pid "$pid"; then
            continue
        fi

        if [[ -z "$filtered_pids" ]]; then
            filtered_pids="$pid"
        else
            filtered_pids="$filtered_pids $pid"
        fi
    done

    echo "$filtered_pids"
}

# Safe process kill function
safe_kill_processes() {
    local process_name="$1"
    local use_sudo="${2:-false}"

    local pids=$(get_filtered_process_pids "$process_name")

    if [[ -z "$pids" ]]; then
        print_info_from_common_functions "No $process_name processes found"
        return 0
    fi

    print_info_from_common_functions "Found $process_name processes: $pids"

    # Try graceful termination first (SIGTERM)
    for pid in $pids; do
        if [[ "$use_sudo" == "true" ]]; then
            $USE_SUDO kill -15 "$pid" 2>/dev/null || true
        else
            kill -15 "$pid" 2>/dev/null || true
        fi
    done

    # Wait up to 5 seconds for processes to terminate
    local waited=0
    while [[ $waited -lt 5 ]]; do
        pids=$(get_filtered_process_pids "$process_name")
        if [[ -z "$pids" ]]; then
            print_success_from_common_functions "$process_name processes terminated gracefully"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    # Force kill if still running (SIGKILL)
    pids=$(get_filtered_process_pids "$process_name")
    if [[ -n "$pids" ]]; then
        print_warning_from_common_functions "Force killing remaining $process_name processes: $pids"
        for pid in $pids; do
            if [[ "$use_sudo" == "true" ]]; then
                $USE_SUDO kill -9 "$pid" 2>/dev/null || true
            else
                kill -9 "$pid" 2>/dev/null || true
            fi
        done
        sleep 1
    fi

    # Verify all processes are gone
    pids=$(get_filtered_process_pids "$process_name")
    if [[ -z "$pids" ]]; then
        print_success_from_common_functions "All $process_name processes terminated"
        return 0
    else
        print_error_from_common_functions "Failed to terminate some $process_name processes: $pids"
        return 1
    fi
}

# Helper to open Cursor download page
open_cursor_download_page() {
    local download_url="${1:-$CURSOR_DOWNLOAD_URL}"

    print_info_from_common_functions "Cursor download page: $download_url"

    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$download_url" >/dev/null 2>&1 &
        print_info_from_common_functions "Opened $download_url in default browser"
    else
        print_info_from_common_functions "Please open $download_url manually in your browser"
    fi
}

print_manual_download_instructions() {
    print_info_from_common_functions "Download the latest Cursor .AppImage or .deb installer."
    print_info_from_common_functions "Note: AppImage is preferred over .deb"

    if [[ -n "$PRIMARY_DOWNLOAD_DIR" ]]; then
        print_info_from_common_functions "Save the file to $PRIMARY_DOWNLOAD_DIR (any /home/*/Downloads directory from any user is scanned automatically)."
    else
        print_info_from_common_functions "Save the file to any /home/*/Downloads directory (all users are scanned automatically)."
    fi
}

# DEPRECATED: This function is no longer used
# Use prompt_and_wait_for_download_from_common_functions() instead


# Install Cursor from .deb package
install_deb_package() {
    local deb_file="$1"

    print_step_from_common_functions "Installing Cursor from .deb package..."

    ide_deb_integrity_check "$deb_file"
    if [ "$IDE_DEB_INTEGRITY_READY" != "yes" ]; then
        print_error_from_common_functions ".deb file integrity check failed"
        print_step_from_common_functions "Removing corrupted file: $deb_file"
        rm -f "$deb_file"
        return 2
    fi

    # Create directories for tracking
    $USE_SUDO mkdir -p "$CURSOR_PACKAGE_DIR" "$CURSOR_BIN_DIR"

    # Copy deb file to installation directory for backup
    print_step_from_common_functions "Backing up .deb file to $CURSOR_PACKAGE_DIR"
    $USE_SUDO cp "$deb_file" "$CURSOR_PACKAGE_DIR/"

    # Install the .deb package
    print_step_from_common_functions "Installing Cursor via dpkg..."
    if $USE_SUDO dpkg -i "$deb_file"; then
        print_success_from_common_functions "Cursor .deb package installed successfully"
    else
        print_warning_from_common_functions "dpkg installation had issues, attempting to fix dependencies..."
        $USE_SUDO apt-get install -f -y
    fi

    # Verify installation
    if ! dpkg -l | grep -q "^ii.*cursor"; then
        print_error_from_common_functions "Cursor package installation failed"
        print_step_from_common_functions "Removing corrupted backup file..."
        $USE_SUDO rm -f "$CURSOR_PACKAGE_DIR/$(basename "$deb_file")" 2>/dev/null || true
        return 1
    fi

    print_success_from_common_functions "Cursor installed successfully via dpkg"
    return 0
}

# Extract AppImage and fix permissions
extract_appimage() {
    local appimage_file="$1"

    print_step_from_common_functions "Extracting Cursor AppImage..."

    # Check file integrity before extraction
    if [[ ! -f "$appimage_file" ]]; then
        print_error_from_common_functions "AppImage file not found: $appimage_file"
        return 2
    fi

    local file_size=$(stat -c%s "$appimage_file" 2>/dev/null || echo "0")
    if [[ "$file_size" -lt 50000000 ]]; then
        print_error_from_common_functions "AppImage file too small ($file_size bytes), expected > 50MB"
        print_error_from_common_functions "File appears to be corrupted"
        return 2
    fi

    # Create directories
    $USE_SUDO mkdir -p "$CURSOR_PACKAGE_DIR" "$CURSOR_EXTRACTED_DIR" "$CURSOR_BIN_DIR"

    # Copy AppImage to installation directory
    print_step_from_common_functions "Copying AppImage to $CURSOR_PACKAGE_DIR"
    if ! $USE_SUDO cp "$appimage_file" "$CURSOR_PACKAGE_DIR/"; then
        print_error_from_common_functions "Failed to copy AppImage file (file may be corrupted)"
        return 2
    fi

    local appimage_name=$(basename "$appimage_file")
    local installed_appimage="$CURSOR_PACKAGE_DIR/$appimage_name"

    # Make AppImage executable
    $USE_SUDO chmod +x "$installed_appimage"

    # Extract AppImage. Output is streamed LIVE (no suppression) so progress/errors
    # are visible; success is decided by the squashfs-root dir below (file signal),
    # NOT by the exit code -- per "no return-value/exit-code-only checks".
    print_step_from_common_functions "Extracting AppImage contents..."
    cd "$CURSOR_EXTRACTED_DIR"
    $USE_SUDO "$installed_appimage" --appimage-extract || true

    if [[ ! -d "$CURSOR_EXTRACTED_DIR/squashfs-root" ]]; then
        print_error_from_common_functions "Failed to extract AppImage (squashfs-root missing; file may be corrupted)"
        return 2
    fi

    # Fix chrome-sandbox permissions (critical for Cursor to work)
    # Find chrome-sandbox in various possible locations
    local chrome_sandbox=""
    local possible_paths=(
        "$CURSOR_EXTRACTED_DIR/squashfs-root/chrome-sandbox"
        "$CURSOR_EXTRACTED_DIR/squashfs-root/usr/share/cursor/chrome-sandbox"
    )

    for path in "${possible_paths[@]}"; do
        if [[ -f "$path" ]]; then
            chrome_sandbox="$path"
            break
        fi
    done

    if [[ -n "$chrome_sandbox" ]]; then
        print_step_from_common_functions "Fixing chrome-sandbox permissions at: $chrome_sandbox"
        # Fix chrome-sandbox permissions (required for security)
        $USE_SUDO chmod 4755 "$chrome_sandbox"
        $USE_SUDO chown root:root "$chrome_sandbox"
    else
        print_warning_from_common_functions "chrome-sandbox not found, Cursor may not work properly"
    fi

    return 0
}

# Note: Launcher scripts are now created by desktop_entry_manager.sh
# Old create_launcher_script_deb() and create_launcher_script_appimage() functions removed

# Detect desktop user for userdata directory
detect_cursor_desktop_user() {
    local detected_user=""
    local detected_home=""

    # Try SUDO_USER first (if running with sudo)
    if [[ -n "${SUDO_USER:-}" ]] && [[ "$SUDO_USER" != "root" ]]; then
        detected_user="$SUDO_USER"
        detected_home="$(getent passwd "$detected_user" 2>/dev/null | cut -d: -f6)"
        if [[ -n "$detected_home" ]] && [[ -d "$detected_home" ]]; then
            echo "$detected_user:$detected_home"
            return 0
        fi
    fi

    # Try finding user with active desktop session
    for user_home in /home/*; do
        if [[ -d "$user_home" ]]; then
            detected_user="$(basename "$user_home")"

            # Check for desktop session indicators
            if [[ -n "$(pgrep -u "$detected_user" 2>/dev/null)" ]] && \
               [[ -d "$user_home/.config" ]]; then
                echo "$detected_user:$user_home"
                return 0
            fi
        fi
    done

    # Fallback: first non-root user in /home with UID >= 1000
    for user_home in /home/*; do
        if [[ -d "$user_home" ]]; then
            detected_user="$(basename "$user_home")"
            local user_uid="$(id -u "$detected_user" 2>/dev/null || echo 0)"
            if [[ $user_uid -ge 1000 ]] && [[ $user_uid -lt 60000 ]]; then
                echo "$detected_user:$user_home"
                return 0
            fi
        fi
    done

    # Last resort: current user
    echo "$USER:$HOME"
}

# Create desktop entry via desktop_entry_manager
create_desktop_entry() {
    print_step_from_common_functions "Creating Cursor launcher + system-wide desktop entry"

    # Detect desktop user
    local desktop_user_info="$(detect_cursor_desktop_user)"
    local desktop_manager_user="${desktop_user_info%%:*}"
    local desktop_manager_home="${desktop_user_info##*:}"

    print_info_from_common_functions "Detected desktop user: $desktop_manager_user ($desktop_manager_home)"

    # Determine binary and icon based on installation type
    # Use global variables so they're accessible in install_cursor()
    CURSOR_BINARY=""
    CURSOR_ICON=""

    if [[ -f "/usr/bin/cursor" ]] && dpkg -l | grep -q "^ii.*cursor"; then
        # .deb installation
        CURSOR_BINARY="/usr/bin/cursor"
        local icon_candidates=(
            "/usr/share/pixmaps/cursor.png"
            "/usr/share/icons/hicolor/128x128/apps/cursor.png"
            "/usr/share/icons/hicolor/256x256/apps/cursor.png"
            "/usr/share/icons/hicolor/512x512/apps/cursor.png"
        )
        CURSOR_ICON="cursor"
        for icon_path in "${icon_candidates[@]}"; do
            if [[ -f "$icon_path" ]]; then
                CURSOR_ICON="$icon_path"
                break
            fi
        done
    else
        # AppImage installation - prioritize co.anysphere.cursor.png
        CURSOR_BINARY="$CURSOR_EXTRACTED_DIR/squashfs-root/AppRun"
        local icon_candidates=(
            "$CURSOR_EXTRACTED_DIR/squashfs-root/co.anysphere.cursor.png"
            "$CURSOR_EXTRACTED_DIR/squashfs-root/cursor.png"
            "$CURSOR_EXTRACTED_DIR/squashfs-root/code.png"
        )
        CURSOR_ICON="cursor"
        for icon_path in "${icon_candidates[@]}"; do
            if [[ -f "$icon_path" ]]; then
                CURSOR_ICON="$icon_path"
                break
            fi
        done
    fi

    if [[ ! -x "$CURSOR_BINARY" ]]; then
        print_error_from_common_functions "Cursor binary not found at: $CURSOR_BINARY"
        print_error_from_common_functions "Installation may have failed"
        return 1
    fi

    print_step_from_common_functions "Using Cursor binary: $CURSOR_BINARY"
    print_step_from_common_functions "Using Cursor icon: $CURSOR_ICON"

    # --- Self-elevating, --no-sandbox launcher (single source of truth) --------------
    # Cursor is an Electron app: started as root the Chromium sandbox refuses to run
    # unless --no-sandbox is passed -- without it Cursor aborts and documents cannot be
    # saved. The wrapper runs Cursor as ROOT (re-execing via pkexec when launched from
    # a normal desktop session, forwarding the X display) so it can also write
    # root-owned project files, then adds --no-sandbox.
    local cursor_real_binary="$CURSOR_BINARY"
    local cursor_wrapper="$CURSOR_BIN_DIR/cursor"
    local cursor_im_pkexec_env
    local cursor_flags_file="$desktop_manager_home/.config/cursor-flags.conf"
    cursor_im_pkexec_env="$(deic_pkexec_env_string)"
    $USE_SUDO mkdir -p "$CURSOR_BIN_DIR"
    $USE_SUDO tee "$cursor_wrapper" >/dev/null <<EOF
#!/bin/bash
# Cursor launcher (generated by 155_install_cursor.sh -- do not edit).
# Runs Cursor as root with --no-sandbox (both REQUIRED to launch Electron as root and
# save files). Re-execs via pkexec, forwarding the X session, for non-root callers.
# IME env vars are forwarded for Wubi/CJK input (see 131 + desktop_electron_ime_compat.sh).
CURSOR_REAL_BINARY="$cursor_real_binary"
if [ "\$(id -u)" -ne 0 ]; then
    if command -v pkexec >/dev/null 2>&1; then
        exec pkexec env DISPLAY="\${DISPLAY:-:0}" XAUTHORITY="\${XAUTHORITY:-\$HOME/.Xauthority}" \
            XDG_RUNTIME_DIR="\${XDG_RUNTIME_DIR}" DBUS_SESSION_BUS_ADDRESS="\${DBUS_SESSION_BUS_ADDRESS}" \
            $cursor_im_pkexec_env "\$0" "\$@"
    else
        exec sudo -E "\$0" "\$@"
    fi
fi
# IME bridge (Electron/Chromium; idempotent with 173_install_chinese_wubi.sh)
$(deic_launcher_env_exports)
# Chromium/Electron flags for Wayland IME (desktop user's cursor-flags.conf).
CURSOR_FLAGS_FILE="$cursor_flags_file"
CURSOR_EXTRA_FLAGS=()
if [ -f "\$CURSOR_FLAGS_FILE" ]; then
    while IFS= read -r _deic_line || [ -n "\$_deic_line" ]; do
        case "\$_deic_line" in
            ''|'#'*) continue ;;
            *) CURSOR_EXTRA_FLAGS+=("\$_deic_line") ;;
        esac
    done < "\$CURSOR_FLAGS_FILE"
fi
# Prefer the resource-limited launcher (cgroup-v2 --system scope; we are root here
# post-elevation). Falls back to a direct launch if the wrapper is missing.
if [ -x /usr/local/bin/cursor-rlimit ]; then
    exec /usr/local/bin/cursor-rlimit --no-sandbox "\${CURSOR_EXTRA_FLAGS[@]}" "\$@"
fi
exec "\$CURSOR_REAL_BINARY" --no-sandbox "\${CURSOR_EXTRA_FLAGS[@]}" "\$@"
EOF
    $USE_SUDO chmod +x "$cursor_wrapper"
    $USE_SUDO ln -sf "$cursor_wrapper" /usr/local/bin/cursor 2>/dev/null || true
    CURSOR_BINARY="$cursor_wrapper"
    print_info_from_common_functions "Launcher (root + --no-sandbox): $cursor_wrapper -> $cursor_real_binary"

    # Resource limit: cap the whole Cursor (Electron) tree in one machine-relative
    # cgroup-v2 --system scope. Cursor self-elevates to root, so --user would not
    # govern it; --root makes the wrapper use a --system scope. The launcher above
    # execs /usr/local/bin/cursor-rlimit (created here). Idempotent; never double-wraps.
    apply_app_resource_limit --id cursor --exec "$cursor_real_binary" --root

    # Build user data directory path for Cursor
    CURSOR_USERDATA_DIR="$desktop_manager_home/.config/Cursor"
    print_info_from_common_functions "Cursor user data directory: $CURSOR_USERDATA_DIR"

    # Create user data directory if it doesn't exist
    if [[ ! -d "$CURSOR_USERDATA_DIR" ]]; then
        mkdir -p "$CURSOR_USERDATA_DIR" 2>/dev/null || true
        # Set ownership to desktop user if running as root
        if [[ "$USER" == "root" ]] && [[ -d "$CURSOR_USERDATA_DIR" ]]; then
            safe_chown_R "$desktop_manager_user:$desktop_manager_user" "$CURSOR_USERDATA_DIR"
        fi
    fi

    # --- System-wide desktop entry (covers ALL desktop environments & ALL users) -----
    # A single /usr/share/applications entry is read by GNOME, KDE, XFCE, Cinnamon,
    # MATE, LXQt, Budgie, etc. The icon goes to /usr/share/pixmaps so every theme can
    # resolve it. Exec points at the self-elevating --no-sandbox wrapper above.
    local sys_icon="/usr/share/pixmaps/cursor.png"
    local desktop_icon="cursor"
    if [[ -f "$CURSOR_ICON" ]]; then
        if $USE_SUDO cp -f "$CURSOR_ICON" "$sys_icon" 2>/dev/null; then
            desktop_icon="$sys_icon"
        fi
    fi

    # Menu entry via the shared library: it writes <id>.desktop to
    # /usr/share/applications (read by every DE, covers all users), runs
    # update-desktop-database, and is idempotent.
    create_desktop_shortcut_from_desktop_shortcut_manager \
        --id cursor \
        --name "Cursor" \
        --generic "Code Editor" \
        --comment "The AI Code Editor" \
        --exec "/usr/local/bin/cursor %F" \
        --icon "$desktop_icon" \
        --categories "Development;IDE;TextEditor;" \
        --keywords "cursor;editor;ide;ai;code;" \
        --mimetype "text/plain;inode/directory;" \
        --startup-wmclass "Cursor" \
        --extra "StartupNotify=true"
    print_success_from_common_functions "System-wide desktop entry created: $DSM_APPLICATIONS_DIR/cursor.desktop"

    # GTK + Wayland IME bridge for Wubi/CJK input (idempotent with 131).
    print_step_from_common_functions "Ensuring Cursor IME compatibility (Wubi/CJK input)..."
    deic_ensure_electron_ime_compat "$desktop_manager_user" "$desktop_manager_home"
    print_success_from_common_functions "Cursor IME config: cursor-flags.conf + GTK im-module for $desktop_manager_user"

    # Refresh icon caches (best-effort; covers all DEs).
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
        for icon_theme in /usr/share/icons/hicolor /usr/share/icons/Yaru; do
            [[ -d "$icon_theme" ]] && $USE_SUDO gtk-update-icon-cache -f -t "$icon_theme" 2>/dev/null || true
        done
    fi

    return 0
}

