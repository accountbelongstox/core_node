#!/usr/bin/env bash

IS_WSL=false
IS_PRODUCTION=false
IS_DESKTOP_WITH_WINDOWS=false
HAS_DESKTOP_ENVIRONMENT=false
IS_HEADLESS_SERVER=false
DESKTOP_ENVIRONMENT=""
WSL_USERS_PATH="/mnt/c/Users"
RUNTIME_DESKTOP_PROCESS_PATTERN="gnome-session|startplasma|plasma_session|xfce4-session|mate-session|cinnamon-session|lxde-session|lxqt-session|openbox|fluxbox|i3|awesome|dwm"
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
    if command -v pgrep >/dev/null 2>&1 && pgrep -x "$RUNTIME_DESKTOP_PROCESS_PATTERN" >/dev/null 2>&1; then
        HAS_DESKTOP_ENVIRONMENT=true
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
