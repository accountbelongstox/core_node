#!/bin/bash
# Antigravity backend for install_shells/155_install_ides.sh (sourced; requires
# gvar_common, common_functions, desktop_shortcut_manager, app_resource_limit,
# desktop_browser_bridge and ide_package_common).
#
# Entry points: antigravity_main_install | antigravity_refresh | antigravity_cleanup.
# The package comes from Google's Artifact Registry through apt_repository_manager
# (repo added for the install/upgrade and restored afterwards).

ANTIGRAVITY_PACKAGE="antigravity"
ANTIGRAVITY_BINARY="/usr/bin/antigravity"
ANTIGRAVITY_REPO_LIST_FILE="/etc/apt/sources.list.d/antigravity.list"
ANTIGRAVITY_REPO_KEY_FILE="/etc/apt/keyrings/antigravity-repo-key.gpg"
ANTIGRAVITY_REPO_MANAGER="$IDE_COMMON_DIR/apt_repository_manager.sh"
ANTIGRAVITY_NAME="Antigravity"
ANTIGRAVITY_ICON="antigravity"
ANTIGRAVITY_CATEGORIES="Utility;Development;"
ANTIGRAVITY_WM_CLASS="antigravity"
ANTIGRAVITY_AGY_CLI="agy"
ANTIGRAVITY_ROOT_MODE=true

antigravity_is_installed() {
    dpkg -s "$ANTIGRAVITY_PACKAGE" >/dev/null 2>&1
}

antigravity_exec_path() {
    command -v antigravity 2>/dev/null || echo "$ANTIGRAVITY_BINARY"
}

# apt install/upgrade through the repository manager. sudo drops a leading
# VAR=value prefix (env_reset), so it is routed through env(1).
antigravity_apt() {
    source "$ANTIGRAVITY_REPO_MANAGER"
    add_antigravity_repository_from_apt_repository_manager \
        "$USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y $* $ANTIGRAVITY_PACKAGE"
}

# Antigravity CLI (agy) is owned by 99_install_ai_tools.sh (key "agy").
antigravity_ensure_agy_cli() {
    bash "$IDE_SHELLS_DIR/99_install_ai_tools.sh" --only agy \
        || print_warning_from_common_functions "99_install_ai_tools.sh reported errors for agy."
    hash -r 2>/dev/null || true
    if [[ -x "/usr/local/bin/$ANTIGRAVITY_AGY_CLI" ]] || command -v "$ANTIGRAVITY_AGY_CLI" >/dev/null 2>&1; then
        return 0
    fi
    print_warning_from_common_functions "Could not verify $ANTIGRAVITY_AGY_CLI binary after install."
    return 1
}

# Repoint visible package entries (not core_node_*, not hidden) at the managed
# launcher in root mode or at the binary in normal mode; entries already pointing
# at a launcher are left alone (no launcher-wrapping-launcher recursion).
antigravity_repoint_package_entries() {
    local launcher_script="" script target_exec search_path desktop_file current_exec
    for script in /usr/local/super_scripts/antigravity*launcher.sh; do
        [[ -x "$script" ]] && { launcher_script="$script"; break; }
    done
    target_exec="$ANTIGRAVITY_BINARY"
    [[ "$ANTIGRAVITY_ROOT_MODE" == "true" ]] && [[ -n "$launcher_script" ]] && target_exec="$launcher_script"

    for search_path in /usr/share/applications /usr/local/share/applications \
        "$HOME/.local/share/applications" "${ACTUAL_DESKTOP_USER_HOME:-$HOME}/.local/share/applications"; do
        [[ -d "$search_path" ]] || continue
        while IFS= read -r -d '' desktop_file; do
            [[ "$desktop_file" == *"core_node_"* ]] && continue
            grep -qE '^(NoDisplay|Hidden)=true' "$desktop_file" 2>/dev/null && continue
            current_exec=$(grep -m1 "^Exec=" "$desktop_file" 2>/dev/null | sed 's/^Exec=//')
            [[ "$current_exec" == "$target_exec"* ]] && continue
            [[ "$current_exec" == *"/super_scripts/"* ]] && continue
            # '#' delimiter: with '|' the escaped alternation would never match.
            $USE_SUDO sed -i \
                -e "s#^Exec=\(/usr/bin/antigravity\|/usr/share/antigravity/antigravity\)\(.*\)#Exec=$target_exec\2#" \
                -e "s|^Icon=.*|Icon=$ANTIGRAVITY_ICON|" "$desktop_file"
            grep -q "^StartupWMClass=" "$desktop_file" \
                || echo "StartupWMClass=$ANTIGRAVITY_WM_CLASS" | $USE_SUDO tee -a "$desktop_file" >/dev/null
            print_info_from_common_functions "Repointed $desktop_file -> $target_exec"
        done < <(find "$search_path" -maxdepth 1 -name "*antigravity*.desktop" -type f -print0 2>/dev/null)
    done
}

# Visible package entries (antigravity*.desktop, excluding core_node_* and
# already-hidden ones) get a per-user Hidden=true shadow.
antigravity_hide_package_entries() {
    local entry entries=()
    for entry in /usr/share/applications/antigravity*.desktop /usr/local/share/applications/antigravity*.desktop; do
        [[ -f "$entry" ]] || continue
        grep -qE '^(NoDisplay|Hidden)=true' "$entry" 2>/dev/null && continue
        entries+=("$(basename "$entry")")
    done
    [[ ${#entries[@]} -gt 0 ]] && ide_hide_package_entries "${entries[@]}"
    return 0
}

# Fallback when desktop_entry_manager is unavailable: a plain system-wide entry.
antigravity_create_fallback_entry() {
    local exec_path userdata_home
    exec_path="$(antigravity_exec_path)"
    if [[ "$ANTIGRAVITY_ROOT_MODE" == "true" ]]; then
        userdata_home="${ACTUAL_DESKTOP_USER_HOME:-$HOME}"
        ide_ensure_user_data_dir "$userdata_home/.config/Antigravity" "$ACTUAL_DESKTOP_USER"
        exec_path="$exec_path --no-sandbox --user-data-dir=$userdata_home/.config/Antigravity"
    fi
    create_desktop_shortcut_from_desktop_shortcut_manager \
        --id antigravity --name "$ANTIGRAVITY_NAME" --exec "$exec_path" --icon "$ANTIGRAVITY_ICON" \
        --comment "Antigravity Client" --categories "$ANTIGRAVITY_CATEGORIES" \
        --startup-wmclass "$ANTIGRAVITY_WM_CLASS" --startup-notify true
}

# Managed launcher through a cgroup-v2 wrapper with raised IDE + agent caps (the
# uniform 1G/10%-CPU default kills the agent). Root mode pins --user-data-dir (the
# VS Code-derived CLI refuses root without it) and needs the browser bridge so
# Google sign-in can open the desktop user's browser.
antigravity_create_desktop_entry() {
    local exec_path app_binary userdata_dir="" arl_root_flag=""
    exec_path="$(antigravity_exec_path)"
    if [[ ! -x "$exec_path" ]]; then
        print_error_from_common_functions "Antigravity binary not found at $exec_path"
        return 1
    fi
    app_binary="$exec_path"
    if [[ "$ANTIGRAVITY_ROOT_MODE" == "true" ]]; then
        userdata_dir="${ACTUAL_DESKTOP_USER_HOME:-$HOME}/.config/Antigravity"
        ide_ensure_user_data_dir "$userdata_dir" "$ACTUAL_DESKTOP_USER"
        ide_ensure_simple_file_dialog "$userdata_dir" "$ACTUAL_DESKTOP_USER"
        ensure_desktop_browser_bridge
        arl_root_flag="--root"
    fi
    if APP_MEM_PCT=40 APP_MEM_CAP_MB=8192 APP_CPU_PCT=50 \
        apply_app_resource_limit --id antigravity --exec "$exec_path" $arl_root_flag \
        && [[ -x /usr/local/bin/antigravity-rlimit ]]; then
        app_binary="/usr/local/bin/antigravity-rlimit"
    fi
    if ! ide_create_managed_app antigravity "$ANTIGRAVITY_NAME" "$app_binary" "$ANTIGRAVITY_ICON" \
        "$ANTIGRAVITY_CATEGORIES" "Antigravity Client" "$ANTIGRAVITY_WM_CLASS" "$userdata_dir" "$ANTIGRAVITY_ROOT_MODE"; then
        antigravity_create_fallback_entry
    fi
    antigravity_repoint_package_entries
    antigravity_hide_package_entries
    ide_refresh_desktop_databases
}

# Idempotent: installed -> refresh (keeping the baked root mode), then an optional
# upgrade (default Y); absent -> install (default Y on desktops, N on servers).
antigravity_main_install() {
    local answer="" default_answer="n"
    print_header_from_common_functions "Antigravity"
    if ! command -v apt-get >/dev/null 2>&1; then
        print_warning_from_common_functions "Antigravity supports apt-based systems only; skipping."
        return 0
    fi
    if antigravity_is_installed; then
        antigravity_refresh
        prompt_read_default answer "y" 30 "$ANTIGRAVITY_NAME is installed. Upgrade it? [Y/n]: "
        if [[ ! "$answer" =~ ^[nN]([oO])?$ ]]; then
            antigravity_apt --only-upgrade || print_info_from_common_functions "Antigravity already current or upgrade failed."
        fi
    else
        [[ "$HAS_DESKTOP_ENVIRONMENT" == true ]] && default_answer="y"
        prompt_read_default answer "$default_answer" 30 "Install $ANTIGRAVITY_NAME now? [y/n] (default $default_answer): "
        if [[ "$answer" =~ ^[yY]([eE][sS])?$ ]]; then
            prompt_read_default answer "y" 30 "Run $ANTIGRAVITY_NAME with root privileges (pkexec)? [Y/n]: "
            [[ "$answer" =~ ^[nN]([oO])?$ ]] && ANTIGRAVITY_ROOT_MODE=false
            if antigravity_apt && antigravity_is_installed; then
                antigravity_create_desktop_entry
            else
                print_error_from_common_functions "Failed to install $ANTIGRAVITY_PACKAGE"
                antigravity_ensure_agy_cli
                return 1
            fi
        fi
    fi
    antigravity_ensure_agy_cli
}

antigravity_refresh() {
    local baked_mode
    antigravity_is_installed || { print_info_from_common_functions "Antigravity not installed; nothing to refresh."; return 0; }
    baked_mode="$(ide_root_mode_from_wrapper antigravity)"
    [[ -n "$baked_mode" ]] && ANTIGRAVITY_ROOT_MODE="$baked_mode"
    antigravity_create_desktop_entry
}

antigravity_cleanup() {
    local target_home="${ACTUAL_DESKTOP_USER_HOME:-$HOME}"
    print_header_from_common_functions "Removing Antigravity"
    antigravity_is_installed && $USE_SUDO apt-get remove -y "$ANTIGRAVITY_PACKAGE" >/dev/null 2>&1
    if [[ -f "$ANTIGRAVITY_REPO_LIST_FILE" ]] || [[ -f "$ANTIGRAVITY_REPO_KEY_FILE" ]]; then
        $USE_SUDO rm -f "$ANTIGRAVITY_REPO_LIST_FILE" "$ANTIGRAVITY_REPO_KEY_FILE"
        $USE_SUDO apt-get update -qq >/dev/null 2>&1 || true
    fi
    $USE_SUDO rm -f /usr/share/applications/antigravity.desktop /usr/share/applications/core_node_antigravity.desktop \
        /usr/local/super_scripts/antigravity.sh /usr/local/bin/antigravity-rlimit 2>/dev/null || true
    rm -f "$target_home/.local/share/applications/antigravity.desktop" \
        "$target_home/.local/share/applications/core_node_antigravity.desktop" 2>/dev/null || true
    ide_refresh_desktop_databases
    print_success_from_common_functions "Antigravity removed"
}
