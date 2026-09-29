#!/bin/bash
# Cursor IDE backend for install_shells/155_install_ides.sh (sourced; requires
# gvar_common, common_functions, desktop_shortcut_manager, app_resource_limit,
# desktop_browser_bridge, desktop_electron_ime_compat and ide_package_common).
#
# Entry points: cursor_main_install | cursor_refresh | cursor_cleanup.
# Cursor always installs in root mode: the launcher self-elevates via pkexec and
# passes --no-sandbox, which Electron requires to start (and save files) as root.

CURSOR_API_URL="https://api2.cursor.sh/updates/download/golden/linux-x64/cursor/"
CURSOR_DOWNLOAD_URL="https://cursor.com/download"
CURSOR_INSTALL_DIR="$IDE_APPLICATIONS_DIR/cursor"
CURSOR_PACKAGE_DIR="$CURSOR_INSTALL_DIR/packages"
CURSOR_EXTRACTED_DIR="$CURSOR_INSTALL_DIR/extracted"
CURSOR_BIN_DIR="$CURSOR_INSTALL_DIR/bin"
CURSOR_INSTALLED_FLAG="$IDE_APP_VERSIONS_DIR/cursor.version"
CURSOR_MIN_INSTALLER_BYTES=52428800
CURSOR_MAX_ATTEMPTS=3
CURSOR_BINARY=""
CURSOR_ICON=""
CURSOR_USERDATA_DIR=""
CURSOR_REMOTE_VERSION=""

cursor_is_installed() {
    [[ -f "$CURSOR_INSTALLED_FLAG" ]]
}

cursor_installed_version() {
    ide_read_version_field "$CURSOR_INSTALLED_FLAG" VERSION
}

cursor_installed_type() {
    ide_read_version_field "$CURSOR_INSTALLED_FLAG" TYPE
}

# Download directory for this run: invoking user's Downloads, any /home Downloads, /tmp.
cursor_download_dir() {
    local download_dir="$HOME/Downloads"
    [[ -d "$download_dir" ]] || download_dir=$(find /home -maxdepth 2 -type d -name "Downloads" 2>/dev/null | head -1)
    [[ -n "$download_dir" ]] && [[ -d "$download_dir" ]] || download_dir="/tmp"
    echo "$download_dir"
}

# Newest Cursor .AppImage/.deb in one directory (case-insensitive name match).
cursor_newest_installer_in_dir() {
    local dir="$1"
    [[ -n "$dir" ]] && [[ -d "$dir" ]] || return 1
    find "$dir" -maxdepth 1 -type f \( -iname "*cursor*.AppImage" -o -iname "*cursor*.deb" \) \
        -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-
}

# A usable installer is a regular file above the size floor (rejects partial
# downloads / HTML error pages).
cursor_verify_installer() {
    local file="$1" size_bytes
    [[ -n "$file" ]] && [[ -f "$file" ]] || return 1
    size_bytes=$(stat -c%s "$file" 2>/dev/null || echo 0)
    [[ "$size_bytes" -ge "$CURSOR_MIN_INSTALLER_BYTES" ]]
}

cursor_remote_version() {
    [[ -n "$CURSOR_REMOTE_VERSION" ]] || CURSOR_REMOTE_VERSION="$(ide_remote_version_from_redirect "$CURSOR_API_URL" 2>/dev/null)"
    echo "$CURSOR_REMOTE_VERSION"
}

# FUSE-2 is OPTIONAL: the AppImage is extracted, so neither install nor launch needs
# libfuse. Installed best-effort for users who run the raw .AppImage. Debian 13 /
# Kali / Ubuntu 24.04+ publish libfuse2t64, older releases libfuse2.
cursor_install_dependencies() {
    local cand
    dpkg -l 2>/dev/null | grep -qE '^ii[[:space:]]+libfuse2(t64)?[[:space:]]' && return 0
    command -v apt-get >/dev/null 2>&1 || return 0
    for cand in libfuse2t64 libfuse2; do
        if apt-cache policy "$cand" 2>/dev/null | grep -qE 'Candidate: [^(]'; then
            print_step_from_common_functions "Installing optional FUSE-2 runtime ($cand)..."
            $USE_SUDO apt-get install -y "$cand" \
                || print_info_from_common_functions "$cand install failed (non-fatal; Cursor runs from the extracted AppImage)."
            return 0
        fi
    done
    print_info_from_common_functions "No libfuse2/libfuse2t64 candidate; skipping (extraction does not need FUSE)."
}

# Cursor Agent (CLI) is owned by 99_install_ai_tools.sh (key "cursor_agent") and is
# ensured on every run, independent of the IDE install state.
cursor_ensure_agent() {
    bash "$IDE_SHELLS_DIR/99_install_ai_tools.sh" --only cursor_agent \
        || print_warning_from_common_functions "99_install_ai_tools.sh reported errors for cursor_agent."
    hash -r 2>/dev/null || true
    if [[ -x /usr/local/bin/cursor-agent ]] || command -v cursor-agent >/dev/null 2>&1; then
        print_info_from_common_functions "Cursor Agent: $(command -v cursor-agent 2>/dev/null || echo /usr/local/bin/cursor-agent)"
        return 0
    fi
    print_warning_from_common_functions "Cursor Agent installation completed but binary not found"
    return 1
}

cursor_install_deb() {
    local deb_file="$1"
    ide_deb_integrity_check "$deb_file"
    if [[ "$IDE_DEB_INTEGRITY_READY" != "yes" ]]; then
        rm -f "$deb_file"
        return 2
    fi
    $USE_SUDO mkdir -p "$CURSOR_PACKAGE_DIR" "$CURSOR_BIN_DIR"
    $USE_SUDO cp "$deb_file" "$CURSOR_PACKAGE_DIR/"
    $USE_SUDO dpkg -i "$deb_file" || $USE_SUDO apt-get install -f -y
    if ! dpkg -l | grep -q "^ii.*cursor"; then
        print_error_from_common_functions "Cursor package installation failed"
        $USE_SUDO rm -f "$CURSOR_PACKAGE_DIR/$(basename "$deb_file")" 2>/dev/null || true
        return 1
    fi
    print_success_from_common_functions "Cursor installed via dpkg"
}

# Extract the AppImage into CURSOR_EXTRACTED_DIR; success is decided by the
# squashfs-root directory (file signal), not the extractor's exit code.
cursor_extract_appimage() {
    local appimage_file="$1" installed_appimage chrome_sandbox path
    cursor_verify_installer "$appimage_file" || return 2
    $USE_SUDO mkdir -p "$CURSOR_PACKAGE_DIR" "$CURSOR_EXTRACTED_DIR" "$CURSOR_BIN_DIR"
    $USE_SUDO cp "$appimage_file" "$CURSOR_PACKAGE_DIR/" || return 2
    installed_appimage="$CURSOR_PACKAGE_DIR/$(basename "$appimage_file")"
    $USE_SUDO chmod +x "$installed_appimage"
    print_step_from_common_functions "Extracting AppImage contents..."
    (cd "$CURSOR_EXTRACTED_DIR" && $USE_SUDO "$installed_appimage" --appimage-extract) || true
    if [[ ! -d "$CURSOR_EXTRACTED_DIR/squashfs-root" ]]; then
        print_error_from_common_functions "Failed to extract AppImage (squashfs-root missing; file may be corrupted)"
        return 2
    fi
    for path in "$CURSOR_EXTRACTED_DIR/squashfs-root/chrome-sandbox" "$CURSOR_EXTRACTED_DIR/squashfs-root/usr/share/cursor/chrome-sandbox"; do
        [[ -f "$path" ]] && { chrome_sandbox="$path"; break; }
    done
    if [[ -n "$chrome_sandbox" ]]; then
        $USE_SUDO chown root:root "$chrome_sandbox"
        $USE_SUDO chmod 4755 "$chrome_sandbox"
    else
        print_warning_from_common_functions "chrome-sandbox not found, Cursor may not work properly"
    fi
}

# Resolve an installer: cached Downloads file only when it is the latest known
# version and valid (AppImage preferred), else a fresh download.
cursor_obtain_installer() {
    local remote_version="$1" cached file_version download_dir located
    cached=$(find_file_in_downloads_from_common_functions "cursor*.AppImage" "newest")
    [[ -n "$cached" ]] || cached=$(find_file_in_downloads_from_common_functions "cursor*.deb" "newest")
    if [[ -n "$cached" ]]; then
        file_version=$(ide_extract_version_from_filename "$cached")
        if [[ -n "$remote_version" ]] && [[ "$file_version" != "$remote_version" ]]; then
            print_warning_from_common_functions "Cached installer is older ($file_version != latest $remote_version); downloading fresh." >&2
        elif cursor_verify_installer "$cached"; then
            print_success_from_common_functions "Reusing cached installer: $(basename "$cached")" >&2
            echo "$cached"
            return 0
        else
            print_warning_from_common_functions "Cached installer looks corrupt/too small; downloading fresh." >&2
            rm -f "$cached" 2>/dev/null || true
        fi
    fi
    download_dir=$(cursor_download_dir)
    print_step_from_common_functions "Downloading Cursor from $CURSOR_API_URL into $download_dir..." >&2
    # Streamed live to stderr; the result is located by scanning the directory.
    download_with_browser_headers_from_common_functions "$CURSOR_API_URL" "$download_dir" 3 >&2 || true
    located=$(cursor_newest_installer_in_dir "$download_dir")
    cursor_verify_installer "$located" || return 1
    echo "$located"
}

# One fetch + install attempt. Returns 2 when the installer was corrupt (removed,
# so the next attempt re-downloads), 1 on other failures.
cursor_install_attempt() {
    local remote_version="$1" cursor_file install_type rc
    cursor_file=$(cursor_obtain_installer "$remote_version")
    if [[ -z "$cursor_file" ]]; then
        print_error_from_common_functions "No valid Cursor installer; download it manually into ~/Downloads ($CURSOR_DOWNLOAD_URL) and re-run."
        return 1
    fi
    case "$cursor_file" in
        *.AppImage) install_type="appimage" ;;
        *.deb) install_type="deb" ;;
        *) print_error_from_common_functions "Unknown installer type: $cursor_file"; return 1 ;;
    esac
    if [[ -n "$(cursor_installed_type)" ]] && [[ "$(cursor_installed_type)" != "$install_type" ]]; then
        print_warning_from_common_functions "Installation type changes ($(cursor_installed_type) -> $install_type); removing the old install first."
        cursor_cleanup
    fi
    if [[ "$install_type" == "deb" ]]; then
        cursor_install_deb "$cursor_file"
    else
        cursor_extract_appimage "$cursor_file"
    fi
    rc=$?
    if [[ $rc -eq 2 ]]; then
        print_error_from_common_functions "File corruption detected: $cursor_file"
        rm -f "$cursor_file" 2>/dev/null || true
        $USE_SUDO rm -f "$CURSOR_PACKAGE_DIR/$(basename "$cursor_file")" 2>/dev/null || true
        $USE_SUDO rm -rf "$CURSOR_EXTRACTED_DIR/squashfs-root" 2>/dev/null || true
        return 2
    fi
    [[ $rc -eq 0 ]] || return 1
    cursor_create_desktop_entry || return 1
    ide_write_version_flag "$CURSOR_INSTALLED_FLAG" "$(ide_extract_version_from_filename "$cursor_file")" "$cursor_file" "$install_type"
    print_success_from_common_functions "Cursor installed ($install_type): ${CURSOR_BINARY:-unknown}"
}

# Idempotent: an installed Cursor is refreshed (launcher, desktop entry, IME) and is
# reinstalled only when a KNOWN newer version exists AND the user confirms (default N).
cursor_main_install() {
    local installed_version remote_version answer="" attempt=1 rc=1
    print_header_from_common_functions "Cursor IDE"
    cursor_ensure_agent
    if [[ "$HAS_DESKTOP_ENVIRONMENT" != true ]] && [[ "$IS_WSL" != true ]] && [[ "$IS_PRODUCTION" == true ]]; then
        print_info_from_common_functions "Skipping Cursor IDE (production server without desktop); Cursor Agent ensured."
        return 0
    fi
    remote_version=$(cursor_remote_version)
    if cursor_is_installed; then
        installed_version=$(cursor_installed_version)
        print_info_from_common_functions "Cursor installed: ${installed_version:-unknown} (latest: ${remote_version:-unknown}, type: $(cursor_installed_type))"
        cursor_create_desktop_entry || true
        if [[ -z "$remote_version" ]] || [[ "$installed_version" == "$remote_version" ]]; then
            print_success_from_common_functions "Cursor is up to date or the latest version is unknown; refresh only."
            return 0
        fi
        prompt_read_default answer "n" 30 "Newer Cursor available (${installed_version:-unknown} -> $remote_version). Reinstall now? [y/N]: "
        [[ "$answer" =~ ^[yY]([eE][sS])?$ ]] || { print_info_from_common_functions "Keeping existing Cursor install."; return 0; }
        cursor_cleanup
    fi
    cursor_install_dependencies
    while [[ $attempt -le $CURSOR_MAX_ATTEMPTS ]]; do
        cursor_install_attempt "$remote_version"
        rc=$?
        [[ $rc -eq 2 ]] || break
        print_step_from_common_functions "Retrying after corrupt download (attempt $attempt/$CURSOR_MAX_ATTEMPTS)..."
        attempt=$((attempt + 1))
    done
    return $rc
}

# Re-assert launcher + desktop entry + IME bridge without downloading; called by
# 10_install_chinese_wubi.sh after an IME framework switch. No-op when absent.
cursor_refresh() {
    if ! cursor_is_installed; then
        print_info_from_common_functions "Cursor not installed; nothing to refresh."
        return 0
    fi
    cursor_create_desktop_entry
}

cursor_cleanup() {
    local desktop_home
    print_header_from_common_functions "Removing Cursor"
    desktop_home="$(ide_detect_desktop_user)"
    desktop_home="${desktop_home##*:}"
    ide_safe_kill_processes "cursor" || true
    if dpkg -l 2>/dev/null | grep -q "^ii.*cursor"; then
        $USE_SUDO apt-get purge -y cursor 2>/dev/null || true
    fi
    $USE_SUDO rm -rf "$CURSOR_INSTALL_DIR"
    $USE_SUDO rm -f "$CURSOR_INSTALLED_FLAG" "$IDE_LAUNCH_DIR/cursor_launcher.sh" \
        /usr/local/bin/cursor /usr/local/bin/cursor-rlimit /usr/share/pixmaps/cursor.png \
        /usr/share/applications/cursor.desktop /usr/share/applications/cursor.desktop.disabled \
        /usr/share/applications/cursor-url-handler.desktop 2>/dev/null || true
    find "$desktop_home/.local/share/applications" -maxdepth 1 -name "*cursor*.desktop" -type f -delete 2>/dev/null || true
    ide_refresh_desktop_databases
    print_success_from_common_functions "Cursor removed"
}

# Launcher (root + --no-sandbox) + system-wide desktop entry + URL handler + IME.
cursor_create_desktop_entry() {
    print_step_from_common_functions "Creating Cursor launcher + system-wide desktop entry"

    # Detect desktop user
    local desktop_user_info="$(ide_detect_desktop_user)"
    local desktop_manager_user="${desktop_user_info%%:*}"
    local desktop_manager_home="${desktop_user_info##*:}"

    print_info_from_common_functions "Detected desktop user: $desktop_manager_user ($desktop_manager_home)"

    # Determine binary and icon based on installation type
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
    # Browser bridge shim must exist before the launcher prepends it to PATH.
    ensure_desktop_browser_bridge
    $USE_SUDO mkdir -p "$CURSOR_BIN_DIR"
    $USE_SUDO tee "$cursor_wrapper" >/dev/null <<EOF
#!/bin/bash
# Cursor launcher (generated by 155_install_ides.sh -- do not edit).
# Runs Cursor as root with --no-sandbox (both REQUIRED to launch Electron as root and
# save files). Re-execs via pkexec, forwarding the X session, for non-root callers.
# IME env vars are forwarded for Wubi/CJK input (see 10_install_chinese_wubi.sh + desktop_electron_ime_compat.sh).
CURSOR_REAL_BINARY="$cursor_real_binary"
if [ "\$(id -u)" -ne 0 ]; then
    if command -v pkexec >/dev/null 2>&1; then
        exec pkexec env DISPLAY="\${DISPLAY:-:0}" \
            XAUTHORITY="\${XAUTHORITY:-\$HOME/.Xauthority}" \
            XDG_RUNTIME_DIR="\${XDG_RUNTIME_DIR:-/run/user/\$(id -u)}" \
            WAYLAND_DISPLAY="\${WAYLAND_DISPLAY:-}" \
            XDG_SESSION_TYPE="\${XDG_SESSION_TYPE:-}" \
            DBUS_SESSION_BUS_ADDRESS="\${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/\$(id -u)/bus}" \
            IBUS_ADDRESS="\${IBUS_ADDRESS:-}" \
            PATH="/usr/local/lib/core_node/browser-bridge:\${PATH}" \
            $cursor_im_pkexec_env "\$0" "\$@"
    else
        exec sudo -E "\$0" "\$@"
    fi
fi
# Browser bridge FIRST on PATH: running as root, a root-spawned browser aborts
# (Chrome refuses root), which silently kills the "Sign in" button. The bridge
# re-dispatches xdg-open to the desktop user's session.
export PATH="/usr/local/lib/core_node/browser-bridge:\${PATH}"
# Discover desktop user's session bus and Wayland display if running as root without them
if [ -z "\${DBUS_SESSION_BUS_ADDRESS:-}" ] || [ "\${DBUS_SESSION_BUS_ADDRESS:-}" = "unix:path=/run/user/0/bus" ]; then
    for _bus in /run/user/[1-9]*/bus; do
        if [ -S "\$_bus" ]; then
            export DBUS_SESSION_BUS_ADDRESS="unix:path=\$_bus"
            break
        fi
    done
fi
if [ -z "\${WAYLAND_DISPLAY:-}" ]; then
    for _wl in /run/user/[1-9]*/wayland-*; do
        if [ -S "\$_wl" ]; then
            export WAYLAND_DISPLAY="\$(basename "\$_wl")"
            export XDG_RUNTIME_DIR="\$(dirname "\$_wl")"
            break
        fi
    done
fi
# IME bridge (Electron/Chromium; idempotent with 10_install_chinese_wubi.sh)
$(deic_launcher_env_exports)
# Chromium/Electron flags for Wayland IME (desktop user's or root cursor-flags.conf).
CURSOR_FLAGS_FILE="$cursor_flags_file"
CURSOR_EXTRA_FLAGS=()
for _cfg in "\$CURSOR_FLAGS_FILE" /root/.config/cursor-flags.conf; do
    if [ -f "\$_cfg" ]; then
        while IFS= read -r _deic_line || [ -n "\$_deic_line" ]; do
            case "\$_deic_line" in
                ''|'#'*) continue ;;
                *) CURSOR_EXTRA_FLAGS+=("\$_deic_line") ;;
            esac
        done < "\$_cfg"
        break
    fi
done
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
    # Raised caps for an IDE + agent runtime: the uniform 1G/10%-CPU default
    # OOM-kills or starves the agent process.
    APP_MEM_PCT=40 APP_MEM_CAP_MB=8192 APP_CPU_PCT=50 \
        apply_app_resource_limit --id cursor --exec "$cursor_real_binary" --root

    # Build user data directory path for Cursor
    CURSOR_USERDATA_DIR="$desktop_manager_home/.config/Cursor"
    print_info_from_common_functions "Cursor user data directory: $CURSOR_USERDATA_DIR"

    # Create user data directory if it doesn't exist
    if [[ ! -d "$CURSOR_USERDATA_DIR" ]]; then
        mkdir -p "$CURSOR_USERDATA_DIR" 2>/dev/null || true
        # Set ownership to desktop user if running as root
        if [[ "$EUID" -eq 0 ]] && [[ -d "$CURSOR_USERDATA_DIR" ]]; then
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

    # --- cursor:// URL scheme handler (login callback) ------------------------------
    # Sign-in ends with a browser redirect to cursor://...; without a registered
    # scheme handler the callback is dropped and the IDE stays logged out. The
    # handler entry is NoDisplay (no menu icon); the browser runs as the desktop
    # user (browser bridge above), so the callback re-elevates through the normal
    # pkexec wrapper and forwards to the already-running instance.
    local url_handler_entry="$DSM_APPLICATIONS_DIR/cursor-url-handler.desktop"
    $USE_SUDO tee "$url_handler_entry" >/dev/null <<EOF
[Desktop Entry]
Type=Application
Name=Cursor - URL Handler
Comment=Handle cursor:// authentication callbacks
Exec=/usr/local/bin/cursor --open-url %U
Icon=$desktop_icon
NoDisplay=true
Terminal=false
Categories=Development;IDE;TextEditor;
MimeType=x-scheme-handler/cursor;
StartupNotify=false
EOF
    if command -v update-desktop-database >/dev/null 2>&1; then
        $USE_SUDO update-desktop-database "$DSM_APPLICATIONS_DIR" 2>/dev/null || true
    fi
    # Register as the default handler inside the desktop user's session config.
    if command -v xdg-settings >/dev/null 2>&1 && [[ -n "$desktop_manager_user" ]] && [[ "$desktop_manager_user" != "root" ]]; then
        local desktop_manager_uid
        desktop_manager_uid="$(id -u "$desktop_manager_user" 2>/dev/null)"
        if [[ -n "$desktop_manager_uid" ]]; then
            sudo -u "#$desktop_manager_uid" env \
                HOME="$desktop_manager_home" \
                XDG_RUNTIME_DIR="/run/user/$desktop_manager_uid" \
                DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$desktop_manager_uid/bus" \
                xdg-settings set default-url-scheme-handler cursor cursor-url-handler.desktop >/dev/null 2>&1 || true
        fi
    fi
    print_success_from_common_functions "cursor:// URL handler registered: $url_handler_entry"

    # GTK + Wayland IME bridge for Wubi/CJK input (idempotent with 10_install_chinese_wubi.sh).
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
