# -*- coding: utf-8 -*-
"""Quick commands offered to the terminal UI: built-in system commands plus every
claudeteam directory script, run by name (the scripts are installed on PATH)."""

from __future__ import annotations

from typing import Any, Dict, List

from pycore.pyfoundations.pygvar import IS_WINDOWS
from pycore.pyfoundations.system_paths import get_core_node_root

PLATFORM_WINDOWS = "windows"
PLATFORM_LINUX = "linux"
# Directory of claudeteam and its sibling launcher scripts, per platform.
CLAUDETEAM_SCRIPT_DIRS = {
    PLATFORM_WINDOWS: ("scripts", "winenvs"),
    PLATFORM_LINUX: ("scripts", "linuxenvs"),
}
CLAUDETEAM_SCRIPT_SUFFIXES = {
    PLATFORM_WINDOWS: ".ps1",
    PLATFORM_LINUX: ".sh",
}
SYSTEM_COMMANDS = {
    PLATFORM_WINDOWS: ("cls", "claude", "claude --continue", "claude --resume", "git status", "git pull"),
    PLATFORM_LINUX: ("clear", "claude", "claude --continue", "claude --resume", "git status", "git pull"),
}
KIND_SYSTEM = "system"
KIND_CUSTOM = "custom"


def _platform() -> str:
    return PLATFORM_WINDOWS if IS_WINDOWS else PLATFORM_LINUX


def list_quick_commands() -> Dict[str, Any]:
    platform = _platform()
    script_dir = get_core_node_root().joinpath(*CLAUDETEAM_SCRIPT_DIRS[platform])
    suffix = CLAUDETEAM_SCRIPT_SUFFIXES[platform]
    custom: List[Dict[str, str]] = []
    if script_dir.is_dir():
        custom = [
            {"kind": KIND_CUSTOM, "command": script.stem, "script": script.name}
            for script in sorted(script_dir.iterdir(), key=lambda path: path.name.lower())
            if script.is_file() and script.suffix.lower() == suffix
        ]
    return {
        "success": True,
        "platform": platform,
        "script_dir": str(script_dir),
        "system": [{"kind": KIND_SYSTEM, "command": command} for command in SYSTEM_COMMANDS[platform]],
        "custom": custom,
    }
