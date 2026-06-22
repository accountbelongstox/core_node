#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cross-platform compatibility layer for Windows/Linux/Debian/Ubuntu.

Provides unified interface for platform-specific operations.
"""

import os
import platform
import logging

from pycore.pyfoundations.pybasecommon.commander import (
    command_exists,
    exec_silent,
    get_command_output,
)

logger = logging.getLogger(__name__)

IS_WINDOWS = platform.system() == "Windows"
IS_LINUX = platform.system() == "Linux"
IS_MACOS = platform.system() == "Darwin"


def get_platform_info() -> dict:
    """Get detailed platform information."""
    info = {
        "system": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "is_windows": IS_WINDOWS,
        "is_linux": IS_LINUX,
    }
    if IS_LINUX:
        os_release_path = "/etc/os-release"
        if os.path.isfile(os_release_path):
            with open(os_release_path) as f:
                for line in f:
                    k, _, v = line.partition("=")
                    if k in ("ID", "VERSION_ID", "PRETTY_NAME"):
                        info[k.lower()] = v.strip().strip('"')
    return info


def find_claude_binary() -> str:
    """Find Claude CLI binary cross-platform."""
    # 1. Check PATH
    if command_exists("claude"):
        output = get_command_output("where claude" if IS_WINDOWS else "which claude")
        path = output.strip().split("\n")[0].strip() if output.strip() else ""
        if path and os.path.isfile(path):
            return path

    # 2. Platform-specific common locations
    if IS_WINDOWS:
        appdata = os.environ.get("APPDATA", "")
        localappdata = os.environ.get("LOCALAPPDATA", "")
        candidates = [
            os.path.expanduser("~/.claude/local/claude.exe"),
            os.path.join(localappdata, "Programs", "claude", "claude.exe") if localappdata else "",
            os.path.join(appdata, "npm", "claude.cmd") if appdata else "",
            r"C:\Program Files\Claude\claude.exe",
        ]
        candidates = [c for c in candidates if c]
    else:
        candidates = [
            os.path.expanduser("~/.claude/local/claude"),
            "/usr/local/bin/claude",
            "/usr/bin/claude",
            os.path.expanduser("~/.npm-global/bin/claude"),
        ]

    for path in candidates:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    return "claude"  # fallback, let PATH resolve


def run_as_user(username: str, command: list, cwd: str = None, env: dict = None):
    """Run command as specified user (cross-platform).

    Returns a CommandResult from exec_silent.
    """
    if IS_WINDOWS:
        logger.debug(f"Windows: running command directly (no user switch): {command}")
        cmd_str = " ".join(f'"{c}"' if " " in c else c for c in command)
        return exec_silent(cmd_str, cwd=cwd)
    else:
        full_cmd = ["sudo", "-u", username, "--"] + command
        cmd_str = " ".join(f'"{c}"' if " " in c else c for c in full_cmd)
        return exec_silent(cmd_str, cwd=cwd)


def get_allowed_project_dirs() -> list:
    """Get platform-specific allowed project directory prefixes."""
    if IS_WINDOWS:
        home = os.path.expanduser("~")
        return [
            home,
            os.path.join(home, "Documents"),
            os.path.join(home, "Projects"),
            "D:\\",
        ]
    else:
        return [
            "/home/",
            "/var/lib/",
            "/opt/",
        ]


def get_claude_config_dir(username: str) -> str:
    """
    Get per-user Claude config directory.

    Multi-user isolation strategy (per Claude Code official docs):
    - Linux:  sudo -u switches user; each user's ~/.claude is naturally isolated.
    - Windows: no user switching; set CLAUDE_CONFIG_DIR=<per-user-dir> to isolate
               sessions and credentials without creating OS-level accounts.
               For the *current* Windows user, use the default ~/.claude path
               (Claude CLI is already logged in there).
    """
    if IS_WINDOWS:
        current_user = os.environ.get("USERNAME", "")
        if username == current_user:
            return os.path.join(os.path.expanduser("~"), ".claude")
        else:
            return os.path.join(os.path.expanduser("~"), ".claude-users", username)
    else:
        return f"/home/{username}/.claude"


def ensure_claude_user_config(username: str) -> str:
    """
    Ensure Claude config directory exists for a user, including the
    inner 'settings' sub-directory that Claude CLI expects.

    Returns the config directory path.
    """
    config_dir = get_claude_config_dir(username)
    os.makedirs(config_dir, exist_ok=True)
    settings_dir = os.path.join(config_dir, "settings")
    os.makedirs(settings_dir, exist_ok=True)
    return config_dir


def ensure_data_dir(path: str) -> str:
    """Ensure data directory exists (cross-platform)."""
    os.makedirs(path, exist_ok=True)
    return path
