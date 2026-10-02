# -*- coding: utf-8 -*-
"""Quick commands offered to the terminal UI: built-in system commands plus every
claudeteam directory script, run by name (the scripts are installed on PATH)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
KIND_PRESET = "preset"
DD_ENTRY = {PLATFORM_WINDOWS: "dd.cmd", PLATFORM_LINUX: "dd.sh"}
PYSERVICE_ENTRY = {PLATFORM_WINDOWS: "pyservice.ps1", PLATFORM_LINUX: "pyservice.sh"}
GITSYNC_ARGUMENT = "gitsync"
NO_INSTALL_ARGUMENT = "--no-install"
# Preset combinations: (id used for the UI description, entry map, arguments).
PRESET_COMMANDS: Tuple[Tuple[str, Dict[str, str], Tuple[str, ...]], ...] = (
    ("dd_gitsync", DD_ENTRY, (GITSYNC_ARGUMENT,)),
    ("pyservice", PYSERVICE_ENTRY, ()),
    ("pyservice_no_install", PYSERVICE_ENTRY, (NO_INSTALL_ARGUMENT,)),
)
WINDOWS_POWERSHELL_FILE = "powershell -NoProfile -ExecutionPolicy Bypass -File"
LINUX_SHELL = "bash"
# The list is rebuilt only when the script directory or the repo root changes
# (adding, removing or renaming an entry updates the directory mtime).
_cache: Dict[str, Any] = {"signature": None, "result": None}


def _platform() -> str:
    return PLATFORM_WINDOWS if IS_WINDOWS else PLATFORM_LINUX


def _quoted(path: Path) -> str:
    return f'"{path}"' if " " in str(path) else str(path)


# Windows lines run in cmd and PowerShell alike; Linux lines run through bash.
def _invocation(platform: str, entry: Path, arguments: Tuple[str, ...]) -> str:
    if platform == PLATFORM_LINUX:
        prefix = f"{LINUX_SHELL} '{entry}'"
    elif entry.suffix.lower() == ".ps1":
        prefix = f'{WINDOWS_POWERSHELL_FILE} "{entry}"'
    else:
        prefix = _quoted(entry)
    return " ".join((prefix, *arguments))


def _preset_commands(platform: str, root: Path) -> List[Dict[str, str]]:
    return [
        {"kind": KIND_PRESET, "id": preset_id, "command": _invocation(platform, root / entries[platform], arguments)}
        for preset_id, entries, arguments in PRESET_COMMANDS
        if (root / entries[platform]).is_file()
    ]


def _mtime_ns(path: Path) -> int:
    try:
        return path.stat().st_mtime_ns
    except OSError:
        return 0


def list_quick_commands() -> Dict[str, Any]:
    platform = _platform()
    root = get_core_node_root()
    script_dir = root.joinpath(*CLAUDETEAM_SCRIPT_DIRS[platform])
    signature: Tuple[str, int, int] = (platform, _mtime_ns(root), _mtime_ns(script_dir))
    cached: Optional[Dict[str, Any]] = _cache["result"]
    if cached is not None and _cache["signature"] == signature:
        return cached
    result = _scan_quick_commands(platform, root, script_dir)
    _cache["signature"], _cache["result"] = signature, result
    return result


def _scan_quick_commands(platform: str, root: Path, script_dir: Path) -> Dict[str, Any]:
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
        "preset": _preset_commands(platform, root),
        "system": [{"kind": KIND_SYSTEM, "command": command} for command in SYSTEM_COMMANDS[platform]],
        "custom": custom,
    }
