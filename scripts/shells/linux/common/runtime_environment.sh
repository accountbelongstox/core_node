#!/usr/bin/env bash

IS_WSL=false
IS_PRODUCTION=false
IS_DESKTOP_WITH_WINDOWS=false
HAS_DESKTOP_ENVIRONMENT=false
IS_HEADLESS_SERVER=false
DESKTOP_ENVIRONMENT=""
WSL_USERS_PATH="/mnt/c/Users"
# Single definition of the unified core_node runtime data root (NO dot-prefixed
# names); every other script sources this file (directly or via gvar_common.sh)
# and reuses the variable. Mirrors pycore core_node_dirs.get_core_node_data_dir,
# GlobalVars.ps1 $Global:USER_DIR and PathMapper::getCoreNodeRuntimeDir:
#   /www/www/core_node  when /www is the mounted Windows D: root (dual-boot)
#   /www/core_node      on a native Linux /www
# NOTE: the shared MODEL cache and the POSIX scratch temp intentionally stay on
# the legacy native base /var/_core_node (pyservice model paths unchanged).
LEGACY_CORE_NODE_DATA_DIR="/var/_core_node"
if [ -z "${CORE_NODE_DATA_DIR:-}" ]; then
    CORE_NODE_DATA_DIR="/www/core_node"
    if [ -d /www/www ] && command -v findmnt >/dev/null 2>&1; then
        __re_src_www="$(findmnt -n -o SOURCE --target /www 2>/dev/null | head -n1)"
        __re_src_root="$(findmnt -n -o SOURCE --target / 2>/dev/null | head -n1)"
        if [ -n "$__re_src_www" ] && [ -n "$__re_src_root" ] && [ "$__re_src_www" != "$__re_src_root" ]; then
            CORE_NODE_DATA_DIR="/www/www/core_node"
        fi
        unset __re_src_www __re_src_root
    fi
fi
# NOTE: process names (comm) are truncated to 15 chars ("gnome-session-b..."), so
# never match with pgrep -x; use a start-anchored substring pattern instead.
RUNTIME_DESKTOP_PROCESS_PATTERN="^(gnome-shell|gnome-session|startplasma|plasmashell|plasma_session|xfce4-session|mate-session|cinnamon-session|lxde-session|lxqt-session|openbox|fluxbox|i3|sway|awesome|dwm|gdm|gdm3|sddm|lightdm|Xorg)"
RUNTIME_SYSTEM_NAME="$(uname -s 2>/dev/null)"

detect_runtime_environment() {
    IS_WSL=false
    IS_PRODUCTION=false
    HAS_DESKTOP_ENVIRONMENT=false
    IS_HEADLESS_SERVER=false
    DESKTOP_ENVIRONMENT=""

    if [ -d "$WSL_USERS_PATH" ] || grep -Eqi 'microsoft|wsl' /proc/sys/kernel/osrelease /proc/version 2>/dev/null; then
        IS_WSL=true
    fi

    if [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi
    if [ -n "${XDG_CURRENT_DESKTOP:-}" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
        DESKTOP_ENVIRONMENT="$XDG_CURRENT_DESKTOP"
    elif [ -n "${DESKTOP_SESSION:-}" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
        DESKTOP_ENVIRONMENT="$DESKTOP_SESSION"
    fi
    # Root/sudo runs lose the XDG/DESKTOP_SESSION env vars; identify the desktop
    # from the running session processes instead (comm is 15-char truncated, so
    # match with start-anchored substrings, never pgrep -x).
    if [ -z "$DESKTOP_ENVIRONMENT" ] && command -v pgrep >/dev/null 2>&1; then
        if pgrep "^gnome-shell" >/dev/null 2>&1; then
            DESKTOP_ENVIRONMENT="GNOME"
        elif pgrep "^(startplasma|plasmashell)" >/dev/null 2>&1; then
            DESKTOP_ENVIRONMENT="KDE"
        elif pgrep "^xfce4-session" >/dev/null 2>&1; then
            DESKTOP_ENVIRONMENT="XFCE"
        elif pgrep "^cinnamon-sess" >/dev/null 2>&1; then
            DESKTOP_ENVIRONMENT="Cinnamon"
        elif pgrep "^mate-session" >/dev/null 2>&1; then
            DESKTOP_ENVIRONMENT="MATE"
        elif pgrep "^lxqt-session" >/dev/null 2>&1; then
            DESKTOP_ENVIRONMENT="LXQt"
        elif pgrep "^lxde-session" >/dev/null 2>&1; then
            DESKTOP_ENVIRONMENT="LXDE"
        fi
    fi
    if command -v pgrep >/dev/null 2>&1 && pgrep "$RUNTIME_DESKTOP_PROCESS_PATTERN" >/dev/null 2>&1; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi
    # Root/sudo runs lose DISPLAY/XDG env vars; an active graphical loginctl
    # session (x11/wayland) still proves a desktop is present.
    if [ "$HAS_DESKTOP_ENVIRONMENT" != true ] && command -v loginctl >/dev/null 2>&1; then
        if loginctl list-sessions --no-legend 2>/dev/null | grep -Eq '[[:space:]](x11|wayland)[[:space:]]'; then
            HAS_DESKTOP_ENVIRONMENT=true
        fi
    fi
    # Last resort: a graphical session is installed on disk (display manager
    # sessions shipped by gdm3/sddm/lightdm under xsessions/wayland-sessions).
    if [ "$HAS_DESKTOP_ENVIRONMENT" != true ]; then
        if ls /usr/share/xsessions/*.desktop /usr/share/wayland-sessions/*.desktop >/dev/null 2>&1; then
            HAS_DESKTOP_ENVIRONMENT=true
        fi
    fi

    if [ "$RUNTIME_SYSTEM_NAME" = "Linux" ] && [ "$IS_WSL" != true ] && [ "$HAS_DESKTOP_ENVIRONMENT" != true ]; then
        IS_PRODUCTION=true
        IS_HEADLESS_SERVER=true
    fi
}

detect_runtime_environment

export IS_WSL
export IS_PRODUCTION
export IS_DESKTOP_WITH_WINDOWS
export HAS_DESKTOP_ENVIRONMENT
export IS_HEADLESS_SERVER
export DESKTOP_ENVIRONMENT
export WSL_USERS_PATH
export CORE_NODE_DATA_DIR
export LEGACY_CORE_NODE_DATA_DIR
