#!/bin/bash
# Shared IDE installer helpers (Cursor / VS Code / Antigravity backends).

IDE_DEB_INTEGRITY_READY="no"
IDE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IDE_SHELLS_DIR="$(dirname "$IDE_COMMON_DIR")/debian/install_shells"
IDE_DESKTOP_MANAGER_SCRIPT="$(dirname "$IDE_COMMON_DIR")/debian/debian_com/desktop_entry_manager.sh"
IDE_APPLICATIONS_DIR="$(map_web_path "compile_dir" "applications")"
IDE_APP_VERSIONS_DIR="$CORE_NODE_APP_VERSIONS_DIR/${OS_VAR_TAG:-UNKNOWN}"
IDE_LAUNCH_DIR="$CORE_NODE_DATA_DIR/scripts_launch_dir"
IDE_USER_AGENT="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

ide_extract_version_from_filename() {
    local filename="$1"
    local basename_file=""
    local version_string=""

    basename_file="$(basename "$filename")"
    version_string="${basename_file%.*}"
    printf '%s' "$version_string"
}

ide_deb_integrity_check() {
    local deb_file="$1"
    local file_size="0"

    IDE_DEB_INTEGRITY_READY="no"
    print_step_from_common_functions "Checking .deb file integrity..."
    if [[ ! -f "$deb_file" ]]; then
        print_error_from_common_functions ".deb file not found: $deb_file"
        return
    fi

    file_size="$(stat -c%s "$deb_file" 2>/dev/null || echo "0")"
    if [[ "$file_size" -lt 50000000 ]]; then
        print_warning_from_common_functions ".deb file too small ($file_size bytes), expected > 50MB"
        return
    fi
    if ! dpkg-deb --info "$deb_file" >/dev/null 2>&1; then
        print_warning_from_common_functions ".deb file is corrupted (dpkg-deb check failed)"
        return
    fi
    if ! ar t "$deb_file" >/dev/null 2>&1; then
        print_warning_from_common_functions ".deb file is corrupted (ar archive check failed)"
        return
    fi

    IDE_DEB_INTEGRITY_READY="yes"
    print_success_from_common_functions ".deb file integrity check passed"
}

# Read FIELD=value from an app version flag file.
ide_read_version_field() {
    local flag_file="$1" field="$2"
    [[ -f "$flag_file" ]] && grep "^$field=" "$flag_file" 2>/dev/null | cut -d= -f2-
}

# Write the app version flag file (DATE/VERSION/[TYPE]/PACKAGE/PATH).
ide_write_version_flag() {
    local flag_file="$1" version="$2" package_file="$3" install_type="${4:-}"
    $USE_SUDO mkdir -p "$(dirname "$flag_file")"
    {
        echo "DATE=$(date '+%Y-%m-%d %H:%M:%S')"
        echo "VERSION=$version"
        [[ -n "$install_type" ]] && echo "TYPE=$install_type"
        echo "PACKAGE=$(basename "$package_file")"
        echo "PATH=$package_file"
    } | $USE_SUDO tee "$flag_file" >/dev/null
}

# Latest version string = final redirect filename without extension (bounded so an
# idempotent version check never hangs). Empty output when offline.
ide_remote_version_from_redirect() {
    local api_url="$1" final_url="" filename=""
    if command -v wget >/dev/null 2>&1; then
        final_url=$(wget --spider --server-response --user-agent="$IDE_USER_AGENT" \
            --max-redirect=10 --timeout=15 --tries=1 "$api_url" 2>&1 \
            | grep -i "Location:" | tail -1 | awk '{print $2}' | tr -d '\r')
    fi
    if [[ -z "$final_url" ]] && command -v curl >/dev/null 2>&1; then
        final_url=$(curl -sIL -A "$IDE_USER_AGENT" --max-redirs 10 --connect-timeout 10 --max-time 25 "$api_url" \
            | grep -i "^location:" | tail -1 | awk '{print $2}' | tr -d '\r')
    fi
    [[ -n "$final_url" ]] || return 1
    filename="$(basename "$final_url")"
    filename="${filename%%\?*}"
    [[ -n "${filename%.*}" ]] || return 1
    echo "${filename%.*}"
}

# Desktop user for per-user data dirs, as "user:home": SUDO_USER, else a /home
# user with running processes, else the first regular /home user, else $USER.
ide_detect_desktop_user() {
    local user_home detected_user detected_home user_uid
    if [[ -n "${SUDO_USER:-}" ]] && [[ "$SUDO_USER" != "root" ]]; then
        detected_home="$(getent passwd "$SUDO_USER" 2>/dev/null | cut -d: -f6)"
        if [[ -n "$detected_home" ]] && [[ -d "$detected_home" ]]; then
            echo "$SUDO_USER:$detected_home"
            return 0
        fi
    fi
    for user_home in /home/*; do
        [[ -d "$user_home" ]] || continue
        detected_user="$(basename "$user_home")"
        if [[ -n "$(pgrep -u "$detected_user" 2>/dev/null)" ]] && [[ -d "$user_home/.config" ]]; then
            echo "$detected_user:$user_home"
            return 0
        fi
    done
    for user_home in /home/*; do
        [[ -d "$user_home" ]] || continue
        detected_user="$(basename "$user_home")"
        user_uid="$(id -u "$detected_user" 2>/dev/null || echo 0)"
        if [[ $user_uid -ge 1000 ]] && [[ $user_uid -lt 60000 ]]; then
            echo "$detected_user:$user_home"
            return 0
        fi
    done
    echo "$USER:$HOME"
}

# Create a per-user data dir owned by the desktop user (no-op when present).
ide_ensure_user_data_dir() {
    local dir="$1" owner="$2"
    [[ -d "$dir" ]] && return 0
    mkdir -p "$dir" 2>/dev/null || true
    if [[ "$EUID" -eq 0 ]] && [[ -n "$owner" ]] && [[ "$owner" != "root" ]] && [[ -d "$dir" ]]; then
        safe_chown_R "$owner:$owner" "$dir"
    fi
}

# PIDs matching a command-line pattern, excluding this installer's own tree.
ide_filtered_pids() {
    local pattern="$1" pid out=""
    for pid in $(pgrep -f "$pattern" 2>/dev/null); do
        case "$pid" in "$$"|"$PPID"|"${BASHPID:-$$}") continue ;; esac
        out="$out $pid"
    done
    echo $out
}

# SIGTERM, wait up to 5s, then SIGKILL whatever remains.
ide_safe_kill_processes() {
    local pattern="$1" waited=0 pids pid
    pids="$(ide_filtered_pids "$pattern")"
    if [[ -z "$pids" ]]; then
        print_info_from_common_functions "No $pattern processes found"
        return 0
    fi
    print_info_from_common_functions "Terminating $pattern processes: $pids"
    for pid in $pids; do $USE_SUDO kill -15 "$pid" 2>/dev/null || true; done
    while [[ $waited -lt 5 ]] && [[ -n "$(ide_filtered_pids "$pattern")" ]]; do
        sleep 1
        waited=$((waited + 1))
    done
    pids="$(ide_filtered_pids "$pattern")"
    [[ -z "$pids" ]] && return 0
    print_warning_from_common_functions "Force killing remaining $pattern processes: $pids"
    for pid in $pids; do $USE_SUDO kill -9 "$pid" 2>/dev/null || true; done
    sleep 1
    [[ -z "$(ide_filtered_pids "$pattern")" ]]
}

# Root mode baked into an existing <id>-rlimit wrapper ("true"/"false"; empty
# when absent) so a refresh never flips --user <-> --system.
ide_root_mode_from_wrapper() {
    local wrapper="/usr/local/bin/$1-rlimit"
    [[ -f "$wrapper" ]] || return 0
    grep -q '^ARL_SCOPE_MODE="system"' "$wrapper" && { echo true; return 0; }
    grep -q '^ARL_SCOPE_MODE="user"' "$wrapper" && echo false
}

# Shadow package-provided menu entries (by basename) with a Hidden=true user entry
# for every desktop user, so only the managed core_node launcher stays visible.
# XDG-canonical and upgrade-proof; existing Hidden=true overrides are kept.
ide_hide_package_entries() {
    local entry_name user_home u_apps u_owner override_file
    for user_home in "${ACTUAL_DESKTOP_USER_HOME:-$HOME}" /home/*; do
        [[ -d "$user_home" ]] || continue
        u_apps="$user_home/.local/share/applications"
        u_owner="$(stat -c '%U:%G' "$user_home" 2>/dev/null)"
        for entry_name in "$@"; do
            override_file="$u_apps/$entry_name"
            [[ -f "$override_file" ]] && grep -q '^Hidden=true' "$override_file" 2>/dev/null && continue
            mkdir -p "$u_apps" 2>/dev/null || continue
            printf '[Desktop Entry]\nType=Application\nName=%s\nHidden=true\nNoDisplay=true\n' "${entry_name%.desktop}" > "$override_file" 2>/dev/null || continue
            [[ -n "$u_owner" ]] && chown "$u_owner" "$user_home/.local" "$user_home/.local/share" "$u_apps" "$override_file" 2>/dev/null
            chmod 644 "$override_file" 2>/dev/null || true
            print_info_from_common_functions "Hid package menu entry $entry_name for $user_home"
        done
    done
}

ide_refresh_desktop_databases() {
    local dir theme
    if command -v update-desktop-database >/dev/null 2>&1; then
        for dir in "${ACTUAL_DESKTOP_USER_HOME:-$HOME}/.local/share/applications" /usr/share/applications /usr/local/share/applications; do
            [[ -d "$dir" ]] && $USE_SUDO update-desktop-database "$dir" 2>/dev/null || true
        done
    fi
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
        for theme in /usr/share/icons/hicolor /usr/share/icons/Yaru; do
            [[ -d "$theme" ]] && $USE_SUDO gtk-update-icon-cache -f -t "$theme" 2>/dev/null || true
        done
    fi
}

# Create a managed launcher + core_node_<name>.desktop via desktop_entry_manager.
# Args: name display_name binary icon category description wm_class userdata_dir root_mode
ide_create_managed_app() {
    if [[ ! -x "$IDE_DESKTOP_MANAGER_SCRIPT" ]]; then
        print_warning_from_common_functions "desktop_entry_manager.sh not found or not executable: $IDE_DESKTOP_MANAGER_SCRIPT"
        return 1
    fi
    bash "$IDE_DESKTOP_MANAGER_SCRIPT" --create-app "$@"
}
