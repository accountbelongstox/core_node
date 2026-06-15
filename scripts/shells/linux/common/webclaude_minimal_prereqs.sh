#!/bin/bash
# Minimal prerequisites for WebClaude Go gateway / golang install scripts on Linux.
# Pattern aligned with check_and_install_sudo() in gvar_common.sh (same package managers).
# Source this file only; do not execute directly.

webclaude_check_and_install_sudo() {
    if command -v sudo >/dev/null 2>&1; then
        return 0
    fi

    echo "[webclaude-prereq] sudo not found; attempting install (requires root)..."

    if [ "$(id -u)" -ne 0 ]; then
        echo "[webclaude-prereq] Not root: cannot install sudo automatically. Run as root or: apt-get install -y sudo"
        return 1
    fi

    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq && apt-get install -y sudo
    elif command -v yum >/dev/null 2>&1; then
        yum install -y sudo
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y sudo
    elif command -v zypper >/dev/null 2>&1; then
        zypper install -y sudo
    elif command -v pacman >/dev/null 2>&1; then
        pacman -S --noconfirm sudo
    elif command -v apk >/dev/null 2>&1; then
        apk add --no-cache sudo
    else
        echo "[webclaude-prereq] No supported package manager for sudo"
        return 1
    fi

    if command -v sudo >/dev/null 2>&1; then
        echo "[webclaude-prereq] sudo installed: $(sudo --version | head -1)"
        return 0
    fi
    echo "[webclaude-prereq] sudo install failed"
    return 1
}

webclaude_check_and_install_wget() {
    if command -v wget >/dev/null 2>&1; then
        echo "[webclaude-prereq] wget OK: $(wget --version 2>/dev/null | head -1)"
        return 0
    fi

    echo "[webclaude-prereq] wget not found; attempting install..."

    _wc_run_pkg() {
        if [ "$(id -u)" -eq 0 ]; then
            "$@"
        elif command -v sudo >/dev/null 2>&1; then
            sudo "$@"
        else
            echo "[webclaude-prereq] Need root or sudo to install wget"
            return 1
        fi
    }

    if command -v apt-get >/dev/null 2>&1; then
        _wc_run_pkg apt-get update -qq && _wc_run_pkg apt-get install -y wget ca-certificates
    elif command -v yum >/dev/null 2>&1; then
        _wc_run_pkg yum install -y wget ca-certificates
    elif command -v dnf >/dev/null 2>&1; then
        _wc_run_pkg dnf install -y wget ca-certificates
    elif command -v zypper >/dev/null 2>&1; then
        _wc_run_pkg zypper install -y wget ca-certificates
    elif command -v pacman >/dev/null 2>&1; then
        _wc_run_pkg pacman -S --noconfirm wget ca-certificates
    elif command -v apk >/dev/null 2>&1; then
        _wc_run_pkg apk add --no-cache wget ca-certificates
    else
        echo "[webclaude-prereq] No supported package manager for wget"
        return 1
    fi

    if command -v wget >/dev/null 2>&1; then
        echo "[webclaude-prereq] wget installed: $(wget --version 2>/dev/null | head -1)"
        return 0
    fi
    echo "[webclaude-prereq] wget install failed"
    return 1
}
