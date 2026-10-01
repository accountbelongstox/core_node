# -*- coding: utf-8 -*-
"""Format a local file path so a terminal agent CLI (Claude Code, Codex) attaches it.

Messages reach the terminal as one clipboard paste followed by Enter, so the
reference is plain text inside the message: a space-separated path, double
quoted only when it contains whitespace, with no trailing newline (the send
path presses Enter once). Native Windows CLIs accept backslash paths; a WSL
shell inside a Windows terminal needs the /mnt/<drive>/ form.
"""

import re
from pathlib import PurePosixPath, PureWindowsPath
from typing import Any, Dict, Optional

PLATFORM_WINDOWS = "windows"
TARGET_NATIVE = "native"
TARGET_WSL = "wsl"
WSL_MOUNT_ROOT = "/mnt"
WSL_DISTRO_TITLES = ("ubuntu", "debian", "kali", "wsl")
# Bash/zsh prompt titles such as "user@host: ~/dir" or "user@host:/srv".
POSIX_PROMPT_TITLE_RE = re.compile(r"^[\w.-]+@[\w.-]+:\s*[~/]")


def attachment_target(platform_name: str, window: Optional[Dict[str, Any]]) -> str:
    """WSL when a Windows terminal window shows a Linux distro or POSIX prompt title."""
    if platform_name != PLATFORM_WINDOWS or not window:
        return TARGET_NATIVE
    title = str(window.get("title") or "").strip()
    lowered = title.lower()
    if lowered.startswith(WSL_DISTRO_TITLES) or POSIX_PROMPT_TITLE_RE.match(title):
        return TARGET_WSL
    return TARGET_NATIVE


def wsl_path(windows_path: str) -> str:
    path = PureWindowsPath(windows_path)
    drive = path.drive.rstrip(":").lower()
    return str(PurePosixPath(WSL_MOUNT_ROOT, drive, *path.parts[1:]))


def format_attachment_reference(path: str, platform_name: str, window: Optional[Dict[str, Any]] = None) -> str:
    """Exact text to append (after a space) to the message sent to the terminal."""
    text = wsl_path(path) if attachment_target(platform_name, window) == TARGET_WSL else str(path)
    if any(character.isspace() for character in text):
        return f'"{text}"'
    return text
