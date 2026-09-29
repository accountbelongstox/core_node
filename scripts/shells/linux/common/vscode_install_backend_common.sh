#!/bin/bash
# Visual Studio Code backend for install_shells/155_install_ides.sh (sourced; requires
# gvar_common, common_functions, app_resource_limit and ide_package_common).
#
# Entry points: vscode_main_install | vscode_refresh | vscode_cleanup.
# The menu shows exactly one managed core_node_vscode entry (root mode via pkexec by
# default); package-provided code*.desktop entries are hidden and disabled.

VSCODE_API_URL="https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64"
VSCODE_DOWNLOAD_URL="https://code.visualstudio.com/Download"
VSCODE_INSTALL_DIR="$IDE_APPLICATIONS_DIR/vscode"
VSCODE_DEB_DIR="$VSCODE_INSTALL_DIR/deb"
VSCODE_INSTALLED_FLAG="$IDE_APP_VERSIONS_DIR/vscode.version"
VSCODE_PACKAGE_ENTRIES=("code.desktop" "code-url-handler.desktop")
VSCODE_SYSTEM_ENTRY_DIRS=("/usr/share/applications" "/usr/local/share/applications")
VSCODE_DEPENDENCIES=("wget" "gpg" "apt-transport-https")
VSCODE_MAX_ATTEMPTS=3
VSCODE_ROOT_MODE=true

vscode_is_installed() {
    command -v code >/dev/null 2>&1
}

vscode_installed_version() {
    ide_read_version_field "$VSCODE_INSTALLED_FLAG" VERSION
}

vscode_install_dependencies() {
    local dep missing=()
    for dep in "${VSCODE_DEPENDENCIES[@]}"; do
        dpkg -s "$dep" >/dev/null 2>&1 || missing+=("$dep")
    done
    [[ ${#missing[@]} -eq 0 ]] && return 0
    $USE_SUDO apt-get update -qq
    $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing[@]}"
}

# Disable package-provided entries system-wide (kept as .disabled for restore) and
# shadow them per user; both steps are no-ops once applied.
vscode_hide_package_entries() {
    local dir entry system_desktop
    ide_hide_package_entries "${VSCODE_PACKAGE_ENTRIES[@]}"
    for dir in "${VSCODE_SYSTEM_ENTRY_DIRS[@]}"; do
        for entry in "${VSCODE_PACKAGE_ENTRIES[@]}"; do
            system_desktop="$dir/$entry"
            [[ -f "$system_desktop" ]] || continue
            $USE_SUDO mv -f "$system_desktop" "${system_desktop}.disabled" 2>/dev/null || true
        done
    done
    ide_refresh_desktop_databases
}

# Launcher + core_node_vscode.desktop through a machine-relative cgroup-v2 wrapper
# (--system scope in root mode, --user otherwise), then hide package entries.
vscode_create_desktop_entry() {
    local desktop_user_info desktop_user desktop_home userdata_dir icon launch_bin arl_root_flag=""
    desktop_user_info="$(ide_detect_desktop_user)"
    desktop_user="${desktop_user_info%%:*}"
    desktop_home="${desktop_user_info##*:}"
    userdata_dir="$desktop_home/.config/Code"
    icon="/usr/share/pixmaps/vscode.png"
    [[ -f "$icon" ]] || icon="vscode"
    ide_ensure_user_data_dir "$userdata_dir" "$desktop_user"

    launch_bin="/usr/bin/code"
    [[ "$VSCODE_ROOT_MODE" == "true" ]] && arl_root_flag="--root"
    if apply_app_resource_limit --id vscode --exec /usr/bin/code $arl_root_flag \
        && [[ -x /usr/local/bin/vscode-rlimit ]]; then
        launch_bin="/usr/local/bin/vscode-rlimit"
    fi
    ide_create_managed_app vscode "Visual Studio Code" "$launch_bin" "$icon" Development \
        "Code editor for developers" "Code" "$userdata_dir" "$VSCODE_ROOT_MODE" \
        || print_warning_from_common_functions "desktop_entry_manager.sh --create-app reported an error for VS Code"
    vscode_hide_package_entries
}

vscode_install_deb() {
    local deb_file="$1" installed_deb
    ide_deb_integrity_check "$deb_file"
    if [[ "$IDE_DEB_INTEGRITY_READY" != "yes" ]]; then
        rm -f "$deb_file"
        return 2
    fi
    $USE_SUDO mkdir -p "$VSCODE_DEB_DIR"
    $USE_SUDO cp "$deb_file" "$VSCODE_DEB_DIR/"
    installed_deb="$VSCODE_DEB_DIR/$(basename "$deb_file")"
    if ! $USE_SUDO dpkg -i "$installed_deb"; then
        $USE_SUDO apt-get install -f -y
        if ! $USE_SUDO dpkg -i "$installed_deb"; then
            $USE_SUDO rm -f "$installed_deb"
            return 1
        fi
    fi
    print_success_from_common_functions "VS Code .deb installed"
}

# Downloads .deb, else automatic download, else a manual download prompt.
vscode_obtain_deb() {
    local deb_file download_dir
    deb_file=$(find_file_in_downloads_from_common_functions "code*.deb" "newest")
    if [[ -n "$deb_file" ]] && [[ -f "$deb_file" ]]; then
        echo "$deb_file"
        return 0
    fi
    download_dir="$HOME/Downloads"
    [[ -d "$download_dir" ]] || download_dir=$(find /home -maxdepth 2 -type d -name "Downloads" 2>/dev/null | head -1)
    [[ -n "$download_dir" ]] && [[ -d "$download_dir" ]] || download_dir="/tmp"
    print_step_from_common_functions "Downloading VS Code from $VSCODE_API_URL into $download_dir..." >&2
    download_with_browser_headers_from_common_functions "$VSCODE_API_URL" "$download_dir" 3 >&2 || true
    deb_file=$(find_file_in_downloads_from_common_functions "code*.deb" "newest")
    if [[ -z "$deb_file" ]] || [[ ! -f "$deb_file" ]]; then
        deb_file=$(prompt_and_wait_for_download_from_common_functions "$VSCODE_DOWNLOAD_URL" "code*.deb" 0)
    fi
    [[ -n "$deb_file" ]] && [[ -f "$deb_file" ]] && echo "$deb_file"
}

vscode_install_attempt() {
    local deb_file rc
    deb_file=$(vscode_obtain_deb)
    if [[ -z "$deb_file" ]]; then
        print_error_from_common_functions "No VS Code .deb available; download it from $VSCODE_DOWNLOAD_URL and re-run."
        return 1
    fi
    vscode_install_deb "$deb_file"
    rc=$?
    if [[ $rc -eq 2 ]]; then
        print_error_from_common_functions "File corruption detected: $deb_file"
        $USE_SUDO rm -f "$VSCODE_DEB_DIR/$(basename "$deb_file")" 2>/dev/null || true
        return 2
    fi
    [[ $rc -eq 0 ]] || return 1
    vscode_create_desktop_entry
    ide_write_version_flag "$VSCODE_INSTALLED_FLAG" "$(ide_extract_version_from_filename "$deb_file")" "$deb_file"
    print_success_from_common_functions "Visual Studio Code installed (menu: Visual Studio Code (Core Node))"
}

# Idempotent: an installed VS Code is refreshed (keeping its baked root mode) and
# upgraded only when a KNOWN newer version exists and the user confirms (default Y).
vscode_main_install() {
    local installed_version remote_version answer="" attempt=1 rc=1
    print_header_from_common_functions "Visual Studio Code"
    if [[ "$HAS_DESKTOP_ENVIRONMENT" != true ]] && [[ "$IS_WSL" != true ]] && [[ "$IS_PRODUCTION" == true ]]; then
        print_info_from_common_functions "Skipping VS Code (production server without desktop environment)"
        return 0
    fi
    if vscode_is_installed; then
        vscode_refresh
        installed_version=$(vscode_installed_version)
        remote_version=$(ide_remote_version_from_redirect "$VSCODE_API_URL" 2>/dev/null)
        print_info_from_common_functions "VS Code installed: ${installed_version:-unknown} (latest: ${remote_version:-unknown})"
        if [[ -z "$remote_version" ]] || [[ "$installed_version" == "$remote_version" ]]; then
            return 0
        fi
        prompt_read_default answer "y" 30 "Upgrade VS Code to $remote_version? [Y/n]: "
        [[ "$answer" =~ ^[nN]([oO])?$ ]] && return 0
    else
        prompt_read_default answer "y" 30 "Install VS Code with root privileges (pkexec)? [Y/n]: "
        [[ "$answer" =~ ^[nN]([oO])?$ ]] && VSCODE_ROOT_MODE=false
    fi
    vscode_install_dependencies
    while [[ $attempt -le $VSCODE_MAX_ATTEMPTS ]]; do
        vscode_install_attempt
        rc=$?
        [[ $rc -eq 2 ]] || break
        attempt=$((attempt + 1))
    done
    return $rc
}

vscode_refresh() {
    local baked_mode
    vscode_is_installed || { print_info_from_common_functions "VS Code not installed; nothing to refresh."; return 0; }
    baked_mode="$(ide_root_mode_from_wrapper vscode)"
    [[ -n "$baked_mode" ]] && VSCODE_ROOT_MODE="$baked_mode"
    vscode_create_desktop_entry
}

vscode_cleanup() {
    local dir entry desktop_home
    print_header_from_common_functions "Removing Visual Studio Code"
    desktop_home="$(ide_detect_desktop_user)"
    desktop_home="${desktop_home##*:}"
    ide_safe_kill_processes "/usr/share/code/code" || true
    dpkg -s code >/dev/null 2>&1 && $USE_SUDO apt-get purge -y code
    $USE_SUDO rm -rf "$VSCODE_INSTALL_DIR"
    $USE_SUDO rm -f "$VSCODE_INSTALLED_FLAG" "$IDE_LAUNCH_DIR/vscode_launcher.sh" /usr/local/bin/vscode-rlimit 2>/dev/null || true
    rm -f "$desktop_home/.local/share/applications/core_node_vscode.desktop" 2>/dev/null || true
    for dir in "${VSCODE_SYSTEM_ENTRY_DIRS[@]}"; do
        for entry in "${VSCODE_PACKAGE_ENTRIES[@]}"; do
            [[ -f "$dir/$entry.disabled" ]] && $USE_SUDO mv -f "$dir/$entry.disabled" "$dir/$entry" 2>/dev/null || true
        done
    done
    ide_refresh_desktop_databases
    print_success_from_common_functions "VS Code removed"
}
