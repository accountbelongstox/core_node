#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Desktop Icon Repair Script (Debian 12/13, freedesktop Desktop Entry Spec)
#
# Scans every application known to linux_applications_list.sh and repairs its
# launcher integration at three independent granularity levels, each checked
# and fixed separately so re-runs only touch what is actually broken:
#   1. MENU ENTRY   - a .desktop file whose Exec points at the installed binary
#                     (/usr/share/applications, snapd desktop dir, user dir)
#   2. ENTRY HEALTH - Exec target must exist; Icon must resolve to a real file
#                     (absolute path or hicolor/pixmaps theme lookup)
#   3. DESKTOP ICON - a trusted launcher in the real user's XDG Desktop dir
# Extra repairs: re-enable *.desktop.disabled entries, hide duplicate snap
# menu entries when a native entry exists for the same program.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

SCRIPT_INDEX="154"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/linux_applications_list.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_shortcut_manager.sh"

SCRIPT_TEMP_DIR=$(create_script_temp_dir "154_repair_desktop_icons")
LOG_FILE="$SCRIPT_TEMP_DIR/desktop_icons_repair_$(date +%Y%m%d_%H%M%S).log"

REAL_USER="$(get_real_user_from_common_functions 2>/dev/null || true)"
[ "$REAL_USER" = "root" ] && REAL_USER=""
REAL_USER_HOME=""
USER_DESKTOP_DIR=""
USER_APPLICATIONS_DIR=""
if [ -n "$REAL_USER" ]; then
    REAL_USER_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
    USER_DESKTOP_DIR="$(_dsm_desktop_dir "$REAL_USER" "$REAL_USER_HOME")"
    USER_APPLICATIONS_DIR="$REAL_USER_HOME/.local/share/applications"
fi

# Directories scanned for menu entries, most authoritative first.
MENU_ENTRY_DIRS=(
    "/usr/share/applications"
    "/var/lib/snapd/desktop/applications"
)
[ -n "$USER_APPLICATIONS_DIR" ] && MENU_ENTRY_DIRS+=("$USER_APPLICATIONS_DIR")

# Apps that are pure terminal tools: they must not get desktop icons.
CLI_ONLY_APPS=" vim cmake powershell "

COUNT_OK=0
COUNT_REPAIRED=0
COUNT_CREATED=0
COUNT_SKIPPED=0
COUNT_DESKTOP_CREATED=0

log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

# --- Icon resolution ---------------------------------------------------------

# An Icon value is valid when it is an existing absolute file or a theme icon
# name found in hicolor/pixmaps/snapd icon dirs (Debian 12/13 search paths per
# the freedesktop Icon Theme Specification).
icon_resolves() {
    local icon="$1"
    local dir=""
    [ -z "$icon" ] && return 1
    case "$icon" in
        /*) [ -f "$icon" ] && return 0 ;;
        *)
            for dir in /usr/share/icons /usr/local/share/icons /usr/share/pixmaps \
                       /var/lib/snapd/desktop/icons ${REAL_USER_HOME:+$REAL_USER_HOME/.local/share/icons}; do
                [ -d "$dir" ] || continue
                if find "$dir" \( -name "$icon.png" -o -name "$icon.svg" -o -name "$icon.xpm" \) -print -quit 2>/dev/null | grep -q .; then
                    return 0
                fi
            done
            ;;
    esac
    return 1
}

# Pick the best available icon for an app: per-app install dir, snap metadata,
# theme lookup by exec/app name, then a generic fallback.
resolve_icon_for_app() {
    local app_name="$1"
    local exec_name="$2"
    local package_id="$3"
    local candidate=""

    case "$app_name" in
        android_studio)
            candidate="$(map_web_path "compile_dir" "applications/android-studio")/bin/studio.png"
            [ -f "$candidate" ] && { echo "$candidate"; return 0; }
            ;;
        postman)
            candidate="$(find /opt/Postman -name 'icon*.png' -type f 2>/dev/null | head -1)"
            [ -n "$candidate" ] && { echo "$candidate"; return 0; }
            ;;
    esac

    # Snap metadata icon (strict snaps ship meta/gui/icon.png)
    for candidate in "/snap/$package_id/current/meta/gui/icon.png" \
                     "/snap/$exec_name/current/meta/gui/icon.png"; do
        [ -f "$candidate" ] && { echo "$candidate"; return 0; }
    done

    # Theme lookup by exec name (native deb packages register here)
    for candidate in /usr/share/icons/hicolor/*/apps/"$exec_name".png \
                     /usr/share/icons/hicolor/*/apps/"$exec_name".svg \
                     /usr/share/pixmaps/"$exec_name".png \
                     /usr/share/pixmaps/"$exec_name".xpm; do
        [ -f "$candidate" ] && { echo "$candidate"; return 0; }
    done

    echo "application-x-executable"
}

# --- Menu entry inspection ---------------------------------------------------

# Resolve a command to the binary it actually executes: follow symlinks, and
# unwrap small wrapper scripts (Debian diversions like /usr/bin/firefox, which
# just `exec firefox-esr "$@"`). Snap commands stop at /snap/bin/<cmd> because
# every snap resolves to the same /usr/bin/snap launcher.
resolve_exec_identity() {
    local path="$1"
    local depth="${2:-0}"
    local real=""
    local inner=""
    local size=""

    [ "$depth" -ge 3 ] && { printf '%s' "$path"; return 0; }
    real="$(readlink -f "$path" 2>/dev/null || true)"
    [ -n "$real" ] || real="$path"
    [ "$real" = "/usr/bin/snap" ] && { printf '%s' "$path"; return 0; }

    size="$(stat -c%s "$real" 2>/dev/null || echo 99999)"
    if [ -f "$real" ] && [ "$size" -lt 8192 ] && [ "$(head -c 2 "$real" 2>/dev/null)" = "#!" ]; then
        inner="$(grep -oE 'exec +("?)(/[^ ";]+|[a-zA-Z0-9._-]+)\1' "$real" 2>/dev/null | tail -1 | awk '{print $2}' | tr -d '"')"
        case "$inner" in
            /*) [ -e "$inner" ] && { resolve_exec_identity "$inner" $((depth + 1)); return 0; } ;;
            ?*) command -v "$inner" >/dev/null 2>&1 && { resolve_exec_identity "$(command -v "$inner")" $((depth + 1)); return 0; } ;;
        esac
    fi
    printf '%s' "$real"
}

# Identity match between a .desktop entry and an executable, by BINARY, not
# name: direct path equality, single-hop symlink equality (/usr/local/bin/x ->
# /snap/bin/x vs a snap entry), snap alias commands (sublime-text.subl for
# subl), and fully-resolved identity (google-chrome vs google-chrome-stable,
# wrapper scripts like /usr/bin/firefox).
entry_matches_exec() {
    local entry="$1"
    local exec_path="$2"
    local exec_identity="$3"
    local exec_single_hop="$4"
    local exec_name="$5"
    local target=""
    local target_path=""
    local target_identity=""
    local target_base=""

    target="$(entry_exec_target "$entry")"
    [ -n "$target" ] || return 1
    case "$target" in
        /*) target_path="$target" ;;
        *) target_path="$(command -v "$target" 2>/dev/null || true)" ;;
    esac
    [ -n "$target_path" ] || return 1

    [ "$target_path" = "$exec_path" ] && return 0
    [ -n "$exec_single_hop" ] && [ "$target_path" = "$exec_single_hop" ] && return 0
    if [ -L "$target_path" ] && [ "$(readlink "$target_path" 2>/dev/null)" = "$exec_path" ]; then
        return 0
    fi

    # Snap alias commands: /snap/bin/<snap>.<exec> is the same program.
    case "$target_path" in
        /snap/bin/*)
            target_base="${target_path##*/}"
            [ "$target_base" = "$exec_name" ] && return 0
            case "$target_base" in
                *".$exec_name") return 0 ;;
            esac
            ;;
    esac

    if [ -n "$exec_identity" ] && [ "$exec_identity" != "/usr/bin/snap" ]; then
        target_identity="$(resolve_exec_identity "$target_path")"
        [ -n "$target_identity" ] && [ "$target_identity" = "$exec_identity" ] && return 0
    fi
    return 1
}

# Print ALL menu entries invoking the same binary as the given executable.
# Native entries are listed before snap entries (directory order).
find_menu_entries_for_exec() {
    local exec_name="$1"
    local exec_path=""
    local exec_real=""
    local exec_single_hop=""
    local dir=""
    local entry=""

    exec_path="$(command -v "$exec_name" 2>/dev/null || true)"
    [ -n "$exec_path" ] || return 1
    exec_real="$(resolve_exec_identity "$exec_path")"
    [ -L "$exec_path" ] && exec_single_hop="$(readlink "$exec_path" 2>/dev/null || true)"

    for dir in "${MENU_ENTRY_DIRS[@]}"; do
        [ -d "$dir" ] || continue
        for entry in "$dir"/*.desktop; do
            [ -e "$entry" ] || continue
            if entry_matches_exec "$entry" "$exec_path" "$exec_real" "$exec_single_hop" "$exec_name"; then
                echo "$entry"
            fi
        done
    done
    return 0
}

# Entries whose display Name matches the app but whose Exec points elsewhere
# (legacy installs, renamed binaries, parallel installs). They belong to the
# same app and their health is repaired too.
find_menu_entries_for_name() {
    local display_name="$1"
    local dir=""
    local entry=""
    local entry_name=""

    for dir in "${MENU_ENTRY_DIRS[@]}"; do
        [ -d "$dir" ] || continue
        for entry in "$dir"/*.desktop; do
            [ -e "$entry" ] || continue
            entry_name="$(grep -m1 '^Name=' "$entry" 2>/dev/null | cut -d= -f2-)"
            [ "$entry_name" = "$display_name" ] && echo "$entry"
        done
    done
    return 0
}

# True when some .desktop file in the user's Desktop dir invokes this binary.
desktop_icon_exists() {
    local exec_name="$1"
    local exec_path=""
    local exec_real=""
    local exec_single_hop=""
    local entry=""

    [ -n "$USER_DESKTOP_DIR" ] && [ -d "$USER_DESKTOP_DIR" ] || return 1
    exec_path="$(command -v "$exec_name" 2>/dev/null || true)"
    [ -n "$exec_path" ] || return 1
    exec_real="$(resolve_exec_identity "$exec_path")"
    [ -L "$exec_path" ] && exec_single_hop="$(readlink "$exec_path" 2>/dev/null || true)"

    for entry in "$USER_DESKTOP_DIR"/*.desktop; do
        [ -e "$entry" ] || continue
        if entry_matches_exec "$entry" "$exec_path" "$exec_real" "$exec_single_hop" "$exec_name"; then
            return 0
        fi
    done
    return 1
}

# Extract the first token of the Exec line (field codes and env wrappers stripped).
entry_exec_target() {
    local entry="$1"
    grep -m1 '^Exec=' "$entry" 2>/dev/null | cut -d= -f2- \
        | sed -e 's/^env [^ ]* //' -e 's/[[:space:]]*%[fFuUdDnNickvm].*$//' \
        | awk '{print $1}' | tr -d '"'
}

entry_exec_valid() {
    local entry="$1"
    local target=""
    target="$(entry_exec_target "$entry")"
    [ -z "$target" ] && return 1
    case "$target" in
        /*) [ -e "$target" ] ;;
        *) command -v "$target" >/dev/null 2>&1 ;;
    esac
}

entry_icon_valid() {
    local entry="$1"
    local icon=""
    icon="$(grep -m1 '^Icon=' "$entry" 2>/dev/null | cut -d= -f2-)"
    icon_resolves "$icon"
}

# Rewrite just the Icon= line of an entry in place (fine-grained repair).
repair_entry_icon() {
    local entry="$1"
    local new_icon="$2"
    if grep -q '^Icon=' "$entry"; then
        $USE_SUDO sed -i "s|^Icon=.*|Icon=$new_icon|" "$entry"
    else
        echo "Icon=$new_icon" | $USE_SUDO tee -a "$entry" >/dev/null
    fi
}

# Rewrite the main Exec= line of an entry in place when its target died
# (keeps field codes like %U; actions sections are left untouched).
repair_entry_exec() {
    local entry="$1"
    local new_exec="$2"
    local old_line=""
    local field_codes=""
    old_line="$(grep -m1 '^Exec=' "$entry")"
    field_codes="$(printf '%s' "$old_line" | grep -oE '%[fFuUdDnNickvm]+' | head -1)"
    $USE_SUDO sed -i "0,/^Exec=.*/s||Exec=$new_exec${field_codes:+ $field_codes}|" "$entry"
}

# --- Per-app repair ----------------------------------------------------------

repair_app_icons() {
    local app_name="$1"
    local display_name=""
    local exec_name=""
    local package_id=""
    local entry=""
    local icon=""
    local needs_recreate=false
    local status="OK"

    display_name=$(get_app_property "$app_name" "name")
    exec_name=$(get_app_property "$app_name" "exec")
    package_id=$(get_effective_package_id "$app_name")
    [ -z "$display_name" ] && display_name="$app_name"

    # Not installed -> nothing to repair.
    if ! command -v "$exec_name" >/dev/null 2>&1; then
        COUNT_SKIPPED=$((COUNT_SKIPPED + 1))
        return 0
    fi

    # Pure terminal tools ship their own package entries or need none; they
    # get no menu/desktop launcher work here.
    case "$CLI_ONLY_APPS" in
        *" $exec_name "*|*" $app_name "*) return 0 ;;
    esac

    # 1+2. Menu entry presence and health. Every entry belonging to this app
    # (by binary identity or by display name) is checked and repaired in
    # place; a new entry is created only when none exist at all.
    local entries=""
    local by_name=""
    entries="$(find_menu_entries_for_exec "$exec_name")"
    by_name="$(find_menu_entries_for_name "$display_name")"
    for entry in $by_name; do
        case " $entries " in
            *" $entry "*) ;;
            *) entries="$entries $entry" ;;
        esac
    done

    if [ -n "${entries// }" ]; then
        for entry in $entries; do
            # Component/hidden entries (NoDisplay/Hidden, e.g. LibreOffice
            # filter entries sharing the same binary) are not launchers and
            # are left exactly as the package shipped them.
            if grep -qE '^(NoDisplay|Hidden)=true' "$entry"; then
                continue
            fi
            if ! entry_exec_valid "$entry"; then
                repair_entry_exec "$entry" "$(command -v "$exec_name")"
                log_message "REPAIRED-EXEC: $display_name - $(basename "$entry") Exec -> $exec_name"
                COUNT_REPAIRED=$((COUNT_REPAIRED + 1))
                status="REPAIRED"
            fi
            if ! entry_icon_valid "$entry"; then
                icon="$(resolve_icon_for_app "$app_name" "$exec_name" "$package_id")"
                repair_entry_icon "$entry" "$icon"
                log_message "REPAIRED-ICON: $display_name - $(basename "$entry") Icon -> $icon"
                COUNT_REPAIRED=$((COUNT_REPAIRED + 1))
                status="REPAIRED"
            fi
        done
    else
        needs_recreate=true
    fi

    if [ "$needs_recreate" = true ]; then
        icon="$(resolve_icon_for_app "$app_name" "$exec_name" "$package_id")"
        create_desktop_shortcut_from_desktop_shortcut_manager \
            --id "$exec_name" \
            --name "$display_name" \
            --exec "$exec_name" \
            --icon "$icon" \
            --comment "$display_name" \
            --categories "Utility;" \
            --keywords "$exec_name;" >/dev/null 2>&1
        log_message "CREATED-MENU: $display_name - /usr/share/applications/$exec_name.desktop (icon: $icon)"
        COUNT_CREATED=$((COUNT_CREATED + 1))
        status="CREATED"
    fi
    [ "$status" = "OK" ] && COUNT_OK=$((COUNT_OK + 1))

    # 3. Desktop icon for GUI apps.
    if desktop_icon_exists "$exec_name"; then
        return 0
    fi
    if [ -n "$USER_DESKTOP_DIR" ] && [ -d "$USER_DESKTOP_DIR" ]; then
        icon="$(resolve_icon_for_app "$app_name" "$exec_name" "$package_id")"
        create_desktop_shortcut_from_desktop_shortcut_manager \
            --id "$exec_name" \
            --name "$display_name" \
            --exec "$exec_name" \
            --icon "$icon" \
            --comment "$display_name" \
            --categories "Utility;" \
            --no-menu \
            --desktop "$REAL_USER" >/dev/null 2>&1
        log_message "CREATED-DESKTOP: $display_name - $USER_DESKTOP_DIR/$exec_name.desktop"
        COUNT_DESKTOP_CREATED=$((COUNT_DESKTOP_CREATED + 1))
    fi
}

# --- Extra repairs -----------------------------------------------------------

# A *.desktop.disabled file hides an otherwise valid entry (e.g. VS Code's).
# Re-enable it when the plain name is free.
reenable_disabled_entries() {
    local disabled=""
    local target=""
    for disabled in /usr/share/applications/*.desktop.disabled; do
        [ -e "$disabled" ] || continue
        target="${disabled%.disabled}"
        if [ -e "$target" ]; then
            log_message "SKIP: $target already exists, leaving $disabled untouched"
            continue
        fi
        $USE_SUDO mv "$disabled" "$target"
        log_message "REPAIRED: re-enabled $(basename "$target")"
        COUNT_REPAIRED=$((COUNT_REPAIRED + 1))
    done
}

# When both a native menu entry and a snap entry exist for the same program,
# the menu shows duplicates. Hide the snap entry with a user-level Hidden=true
# override (the standard freedesktop mechanism; /var/lib/snapd is read-only
# managed and must not be edited). A duplicate is detected by binary identity
# or by identical display Name with a native entry.
hide_duplicate_snap_entries() {
    local snap_dir="/var/lib/snapd/desktop/applications"
    local snap_entry=""
    local snap_name=""
    local exec_base=""
    local exec_path=""
    local exec_real=""
    local exec_single_hop=""
    local entry=""
    local entry_name=""
    local override=""
    local is_dup=false
    [ -d "$snap_dir" ] || return 0
    [ -n "$USER_APPLICATIONS_DIR" ] || return 0

    for snap_entry in "$snap_dir"/*.desktop; do
        [ -e "$snap_entry" ] || continue
        is_dup=false
        snap_name="$(grep -m1 '^Name=' "$snap_entry" 2>/dev/null | cut -d= -f2-)"
        exec_base="$(basename "$(entry_exec_target "$snap_entry")" 2>/dev/null)"
        exec_path=""
        [ -n "$exec_base" ] && exec_path="$(command -v "$exec_base" 2>/dev/null || true)"
        exec_real=""
        exec_single_hop=""
        if [ -n "$exec_path" ]; then
            exec_real="$(resolve_exec_identity "$exec_path")"
            [ -L "$exec_path" ] && exec_single_hop="$(readlink "$exec_path" 2>/dev/null || true)"
        fi

        for entry in /usr/share/applications/*.desktop; do
            [ -e "$entry" ] || continue
            if [ -n "$exec_path" ] && entry_matches_exec "$entry" "$exec_path" "$exec_real" "$exec_single_hop" "$exec_base"; then
                is_dup=true
                break
            fi
            entry_name="$(grep -m1 '^Name=' "$entry" 2>/dev/null | cut -d= -f2-)"
            if [ -n "$snap_name" ] && [ "$entry_name" = "$snap_name" ]; then
                is_dup=true
                break
            fi
        done

        if [ "$is_dup" = true ]; then
            override="$USER_APPLICATIONS_DIR/$(basename "$snap_entry")"
            if [ ! -f "$override" ]; then
                mkdir -p "$USER_APPLICATIONS_DIR" 2>/dev/null || true
                printf '[Desktop Entry]\nHidden=true\n' > "$override"
                chown "$REAL_USER:$REAL_USER" "$override" 2>/dev/null || true
                log_message "HIDDEN-DUPLICATE: $(basename "$snap_entry") ($snap_name)"
                COUNT_REPAIRED=$((COUNT_REPAIRED + 1))
            fi
        fi
    done
}

# --- Main --------------------------------------------------------------------

main() {
    local group=""
    local app=""

    log_message "=========================================="
    log_message "Desktop Icon Repair (Debian 12/13)"
    log_message "Real user: ${REAL_USER:-none}, desktop dir: ${USER_DESKTOP_DIR:-none}"
    log_message "=========================================="

    for group in BASE DEV APP; do
        for app in $(get_apps_by_package_group "$group"); do
            repair_app_icons "$app"
        done
    done

    reenable_disabled_entries
    hide_duplicate_snap_entries

    if command -v update-desktop-database >/dev/null 2>&1; then
        $USE_SUDO update-desktop-database /usr/share/applications 2>/dev/null || true
    fi

    log_message "=========================================="
    log_message "Summary: OK=$COUNT_OK repaired=$COUNT_REPAIRED created-menu=$COUNT_CREATED desktop-icons=$COUNT_DESKTOP_CREATED skipped=$COUNT_SKIPPED"
    log_message "Log file: $LOG_FILE"
    log_message "=========================================="
}

main "$@"
