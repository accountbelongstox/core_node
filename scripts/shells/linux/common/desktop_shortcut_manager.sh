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

# =============================================================================
# desktop_shortcut_manager.sh - Reusable cross-desktop-environment shortcut
# (freedesktop ".desktop") create / edit / remove library for ALL install scripts.
#
# Source it, then call (idempotent, safe to re-run):
#   create_desktop_shortcut_from_desktop_shortcut_manager \
#       --id <stem> --name <Name> --exec <command> \
#       [--icon <name|path>] [--comment <text>] [--generic <text>] \
#       [--categories 'Network;System;'] [--keywords 'a;b;'] [--terminal] \
#       [--no-menu] [--desktop all|all-users|<username>]
#   edit_desktop_shortcut_from_desktop_shortcut_manager  --id <stem> --key <K> --value <V> [--desktop <who>]
#   remove_desktop_shortcut_from_desktop_shortcut_manager --id <stem> [--menu] [--desktop <who>]
#
# Mechanisms (per the freedesktop Desktop Entry Specification + XDG Base Directory
# / user-dirs specs - https://specifications.freedesktop.org/desktop-entry-spec/
# and https://specifications.freedesktop.org/menu-spec/):
#   * Application-menu entry: <id>.desktop in /usr/share/applications -> shown by
#     EVERY compliant DE (GNOME/KDE/XFCE/MATE/Cinnamon/LXQt/LXDE/Budgie/Deepin).
#   * Desktop icon: <id>.desktop in each target user's XDG Desktop dir, made
#     executable + chowned to that user + (GNOME/Nautilus) marked trusted via
#     `gio set <file> metadata::trusted true` so it shows and launches.
#
# Targets (--desktop): "all"/"all-users" = every real login user (uid>=1000) + root;
# or a single <username>. Works regardless of which user runs the installer: when
# run as root it resolves each user's home + Desktop dir and chowns appropriately.
#
# IDEMPOTENT: identical content overwrites in place; permissions/trust re-applied
# each run; nothing is duplicated. Supports Debian 11-13, Ubuntu 18.04-26.x, Kali
# (all apt-based desktops). NON-FATAL: a missing tool just degrades that step.
# =============================================================================

# Variable declarations (all at top)
DSM_APPLICATIONS_DIR="/usr/share/applications"
DSM_TAB="$(printf '\t')"

# Privilege prefix: honor a caller-set USE_SUDO (from gvar_common); else derive it
# (root -> none; non-root with sudo -> "sudo"; otherwise empty / best-effort).
_dsm_sudo() {
    if [ -n "${USE_SUDO+x}" ]; then printf '%s' "$USE_SUDO"; return 0; fi
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then printf 'sudo'; fi
}

# Sanitize an id/name into a safe .desktop filename stem (lowercase, [a-z0-9._-]).
_dsm_id() {
    printf '%s' "$1" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9._-'
}

# Echo "user<TAB>home" for every real login user: root + uid in [1000,65534).
_dsm_login_users() {
    awk -F: -v OFS="$DSM_TAB" '($3>=1000 && $3<65534) || $3==0 {print $1, $6}' /etc/passwd 2>/dev/null
}

# Resolve a user's Desktop directory: the localized XDG_DESKTOP_DIR from the user's
# ~/.config/user-dirs.dirs when present (parsed literally and $HOME-substituted, NOT
# sourced - sourcing as root would wrongly expand $HOME to /root), else ~/Desktop.
_dsm_desktop_dir() {
    local user="$1" home="$2" d="" v=""
    d="$home/Desktop"
    if [ -r "$home/.config/user-dirs.dirs" ]; then
        v="$(grep -E '^[[:space:]]*XDG_DESKTOP_DIR=' "$home/.config/user-dirs.dirs" 2>/dev/null | head -1 | cut -d= -f2-)"
        v="${v%\"}"; v="${v#\"}"
        [ -n "$v" ] && d="${v/\$HOME/$home}"
    fi
    printf '%s' "$d"
}

# Build the .desktop content.
# Args: name exec icon comment categories keywords terminal generic extra
# `extra` is a newline-separated set of raw additional Desktop Entry lines
# (e.g. "StartupWMClass=Foo", "MimeType=...", "NoDisplay=true").
_dsm_build() {
    local name="$1" exec="$2" icon="$3" comment="$4" cats="$5" kw="$6" term="$7" generic="$8" extra="$9" notify="${10}"
    printf '[Desktop Entry]\n'
    printf 'Version=1.0\n'
    printf 'Type=Application\n'
    printf 'Name=%s\n' "$name"
    [ -n "$generic" ] && printf 'GenericName=%s\n' "$generic"
    [ -n "$comment" ] && printf 'Comment=%s\n' "$comment"
    printf 'Exec=%s\n' "$exec"
    printf 'Icon=%s\n' "${icon:-application-x-executable}"
    printf 'Terminal=%s\n' "${term:-false}"
    printf 'Categories=%s\n' "${cats:-Utility;}"
    [ -n "$kw" ] && printf 'Keywords=%s\n' "$kw"
    # StartupNotify is emitted EXACTLY ONCE (no duplicate-key, which is spec-invalid).
    printf 'StartupNotify=%s\n' "${notify:-false}"
    [ -n "$extra" ] && printf '%s\n' "$extra"
    return 0
}

# Write the system-wide menu entry (/usr/share/applications) and refresh the cache.
_dsm_write_menu() {
    local id="$1" content="$2" sudo file
    sudo="$(_dsm_sudo)"
    file="$DSM_APPLICATIONS_DIR/$id.desktop"
    $sudo mkdir -p "$DSM_APPLICATIONS_DIR" 2>/dev/null || true
    printf '%s' "$content" | $sudo tee "$file" >/dev/null 2>&1 || return 1
    $sudo chmod 0644 "$file" 2>/dev/null || true
    command -v update-desktop-database >/dev/null 2>&1 \
        && $sudo update-desktop-database "$DSM_APPLICATIONS_DIR" 2>/dev/null || true
    return 0
}

# Drop a desktop icon into ONE user's Desktop dir: executable + owned by the user +
# GNOME-trusted (Nautilus only shows/launches a desktop .desktop when trusted).
_dsm_write_desktop_icon() {
    local user="$1" home="$2" id="$3" content="$4" sudo dir file uid
    [ -n "$user" ] && [ -n "$home" ] && [ -d "$home" ] || return 0
    sudo="$(_dsm_sudo)"
    dir="$(_dsm_desktop_dir "$user" "$home")"
    file="$dir/$id.desktop"
    $sudo mkdir -p "$dir" 2>/dev/null || true
    printf '%s' "$content" | $sudo tee "$file" >/dev/null 2>&1 || return 1
    # Executable: KDE/XFCE/MATE/Cinnamon/LXQt/LXDE require +x to launch without a
    # warning. Owned by the user so it is theirs, not root's.
    $sudo chmod 0755 "$file" 2>/dev/null || true
    $sudo chown "$user:$user" "$dir" "$file" 2>/dev/null || true
    # GNOME/Nautilus 42+ : mark trusted, AS the user against their session bus.
    uid="$(id -u "$user" 2>/dev/null)"
    if command -v gio >/dev/null 2>&1 && [ -n "$uid" ]; then
        if [ "$(id -u)" -eq 0 ] && command -v runuser >/dev/null 2>&1; then
            runuser -u "$user" -- env DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" \
                gio set "$file" metadata::trusted true 2>/dev/null || true
        else
            gio set "$file" metadata::trusted true 2>/dev/null || true
        fi
    fi
    return 0
}

# Apply an action across the requested desktop target(s). $1=action fn, $2=who, $3=id, $4=content
_dsm_for_desktops() {
    local fn="$1" who="$2" id="$3" content="$4" u h
    case "$who" in
        ""|none) return 0 ;;
        all|all-users|true)
            while IFS="$DSM_TAB" read -r u h; do
                [ -n "$u" ] || continue
                "$fn" "$u" "$h" "$id" "$content"
            done < <(_dsm_login_users)
            ;;
        *)
            h="$(getent passwd "$who" 2>/dev/null | cut -d: -f6)"
            "$fn" "$who" "$h" "$id" "$content"
            ;;
    esac
    return 0
}

# ---- public API -------------------------------------------------------------

# Create (or idempotently update) a shortcut. See file header for options.
create_desktop_shortcut_from_desktop_shortcut_manager() {
    local id="" name="" exec="" icon="" comment="" cats="" kw="" term="false" generic=""
    local do_menu=1 desktop_who="" content="" extra="" el notify="false"
    local extra_lines=()
    local NL
    NL=$'\n'
    while [ $# -gt 0 ]; do
        case "$1" in
            --id)              id="$(_dsm_id "$2")"; shift 2 ;;
            --name)            name="$2"; shift 2 ;;
            --exec)            exec="$2"; shift 2 ;;
            --icon)            icon="$2"; shift 2 ;;
            --comment)         comment="$2"; shift 2 ;;
            --generic)         generic="$2"; shift 2 ;;
            --categories)      cats="$2"; shift 2 ;;
            --keywords)        kw="$2"; shift 2 ;;
            --terminal)        term="true"; shift ;;
            --no-menu)         do_menu=0; shift ;;
            --desktop)         desktop_who="$2"; shift 2 ;;
            --startup-notify)  notify="$2"; shift 2 ;;
            --extra)           extra_lines+=("$2"); shift 2 ;;            # raw "KEY=VALUE"
            --startup-wmclass) extra_lines+=("StartupWMClass=$2"); shift 2 ;;
            --mimetype)        extra_lines+=("MimeType=$2"); shift 2 ;;
            --no-display)      extra_lines+=("NoDisplay=true"); shift ;;
            *) shift ;;
        esac
    done
    if [ -z "$id" ] || [ -z "$name" ] || [ -z "$exec" ]; then
        echo "[dsm] create: --id, --name and --exec are required" >&2
        return 1
    fi
    # Fold any StartupNotify passed via --extra into the single notify slot so it is
    # never emitted twice (keeps backward compatibility with --extra StartupNotify=...).
    for el in "${extra_lines[@]:-}"; do
        [ -n "$el" ] || continue
        case "$el" in
            StartupNotify=*) notify="${el#StartupNotify=}" ;;
            *) extra="${extra:+$extra$NL}$el" ;;
        esac
    done
    content="$(_dsm_build "$name" "$exec" "$icon" "$comment" "$cats" "$kw" "$term" "$generic" "$extra" "$notify")"
    if [ "$do_menu" -eq 1 ]; then
        _dsm_write_menu "$id" "$content" \
            && echo "[dsm] menu entry: $DSM_APPLICATIONS_DIR/$id.desktop (all desktop environments)"
    fi
    _dsm_for_desktops _dsm_write_desktop_icon "$desktop_who" "$id" "$content"
    [ -n "$desktop_who" ] && [ "$desktop_who" != "none" ] && echo "[dsm] desktop icon written for: $desktop_who"
    return 0
}

# Remove a shortcut. Default (no flags) removes from the menu AND every desktop.
remove_desktop_shortcut_from_desktop_shortcut_manager() {
    local id="" do_menu=0 desktop_who="" any=0 sudo u h dir
    while [ $# -gt 0 ]; do
        case "$1" in
            --id)      id="$(_dsm_id "$2")"; shift 2 ;;
            --menu)    do_menu=1; any=1; shift ;;
            --desktop) desktop_who="$2"; any=1; shift 2 ;;
            *) shift ;;
        esac
    done
    [ -n "$id" ] || { echo "[dsm] remove: --id required" >&2; return 1; }
    if [ "$any" -eq 0 ]; then do_menu=1; desktop_who="all"; fi
    sudo="$(_dsm_sudo)"
    [ "$do_menu" -eq 1 ] && { $sudo rm -f "$DSM_APPLICATIONS_DIR/$id.desktop" 2>/dev/null || true; }
    case "$desktop_who" in
        ""|none) : ;;
        all|all-users|true)
            while IFS="$DSM_TAB" read -r u h; do
                [ -n "$h" ] || continue
                dir="$(_dsm_desktop_dir "$u" "$h")"
                $sudo rm -f "$dir/$id.desktop" 2>/dev/null || true
            done < <(_dsm_login_users)
            ;;
        *)
            h="$(getent passwd "$desktop_who" 2>/dev/null | cut -d: -f6)"
            dir="$(_dsm_desktop_dir "$desktop_who" "$h")"
            $sudo rm -f "$dir/$id.desktop" 2>/dev/null || true
            ;;
    esac
    command -v update-desktop-database >/dev/null 2>&1 \
        && $sudo update-desktop-database "$DSM_APPLICATIONS_DIR" 2>/dev/null || true
    echo "[dsm] removed shortcut: $id"
    return 0
}

# Edit a single key in an existing shortcut (menu + the chosen desktops). For
# anything more than a one-key tweak, call create again (it upserts idempotently).
edit_desktop_shortcut_from_desktop_shortcut_manager() {
    local id="" key="" value="" desktop_who="all" sudo u h dir
    while [ $# -gt 0 ]; do
        case "$1" in
            --id)      id="$(_dsm_id "$2")"; shift 2 ;;
            --key)     key="$2"; shift 2 ;;
            --value)   value="$2"; shift 2 ;;
            --desktop) desktop_who="$2"; shift 2 ;;
            *) shift ;;
        esac
    done
    if [ -z "$id" ] || [ -z "$key" ]; then echo "[dsm] edit: --id and --key required" >&2; return 1; fi
    sudo="$(_dsm_sudo)"
    _dsm_set_key() {
        local file="$1"
        [ -f "$file" ] || return 0
        if grep -q "^$key=" "$file" 2>/dev/null; then
            $sudo sed -i "s|^$key=.*|$key=$value|" "$file" 2>/dev/null || true
        else
            printf '%s=%s\n' "$key" "$value" | $sudo tee -a "$file" >/dev/null 2>&1 || true
        fi
    }
    _dsm_set_key "$DSM_APPLICATIONS_DIR/$id.desktop"
    case "$desktop_who" in
        none|"") : ;;
        all|all-users|true)
            while IFS="$DSM_TAB" read -r u h; do
                [ -n "$h" ] || continue
                dir="$(_dsm_desktop_dir "$u" "$h")"; _dsm_set_key "$dir/$id.desktop"
            done < <(_dsm_login_users) ;;
        *)
            h="$(getent passwd "$desktop_who" 2>/dev/null | cut -d: -f6)"
            dir="$(_dsm_desktop_dir "$desktop_who" "$h")"; _dsm_set_key "$dir/$id.desktop" ;;
    esac
    echo "[dsm] edited shortcut: $id ($key)"
    return 0
}
