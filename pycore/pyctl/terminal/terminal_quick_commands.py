# -*- coding: utf-8 -*-
"""Quick commands offered to the terminal UI: presets, system commands and every
claudeteam directory script. Each entry carries one command line per shell OS,
because a pycore host can show terminals of the other OS (e.g. WSL on Windows)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from pycore.pyfoundations.pygvar import IS_WINDOWS
from pycore.pyfoundations.system_paths import get_core_node_root

PLATFORM_WINDOWS = "windows"
PLATFORM_LINUX = "linux"
PLATFORMS = (PLATFORM_WINDOWS, PLATFORM_LINUX)
# Directory of claudeteam and its sibling launcher scripts, per platform; every
# script is installed on PATH under its name (.winenvs on Windows, BIN_DIR on Linux).
CLAUDETEAM_SCRIPT_DIRS = {
    PLATFORM_WINDOWS: ("scripts", "winenvs"),
    PLATFORM_LINUX: ("scripts", "linuxenvs"),
}
CLAUDETEAM_SCRIPT_SUFFIXES = {
    PLATFORM_WINDOWS: ".ps1",
    PLATFORM_LINUX: ".sh",
}
# (id, Windows line, Linux line): the UI shows and remembers the id; each terminal runs its own line.
SYSTEM_COMMANDS: Tuple[Tuple[str, str, str], ...] = (
    ("clear_screen", "cls", "clear"),
    ("claude", "claude", "claude"),
    ("claude_continue", "claude --continue", "claude --continue"),
    ("claude_resume", "claude --resume", "claude --resume"),
    ("git_status", "git status", "git status"),
    ("git_pull", "git pull", "git pull"),
)
KIND_SYSTEM = "system"
KIND_CUSTOM = "custom"
KIND_PRESET = "preset"
DD_ENTRY = {PLATFORM_WINDOWS: "dd.cmd", PLATFORM_LINUX: "dd.sh"}
PYSERVICE_ENTRY = {PLATFORM_WINDOWS: "pyservice.ps1", PLATFORM_LINUX: "pyservice.sh"}
GITSYNC_ARGUMENT = "gitsync"
NO_INSTALL_ARGUMENT = "--no-install"
# Preset combinations: (id, entry map, arguments). Prerequisite scripts install every entry
# on PATH, so each OS runs it by name (dd.cmd / dd.sh avoid Git's and coreutils' dd).
PRESET_COMMANDS: Tuple[Tuple[str, Dict[str, str], Tuple[str, ...]], ...] = (
    ("dd_gitsync", DD_ENTRY, (GITSYNC_ARGUMENT,)),
    ("pyservice", PYSERVICE_ENTRY, ()),
    ("pyservice_no_install", PYSERVICE_ENTRY, (NO_INSTALL_ARGUMENT,)),
)
# The list is rebuilt only when the script directories or the repo root change
# (adding, removing or renaming an entry updates the directory mtime).
_cache: Dict[str, Any] = {"signature": None, "result": None}


def _platform() -> str:
    return PLATFORM_WINDOWS if IS_WINDOWS else PLATFORM_LINUX


def _script_names(root: Path) -> Dict[str, Set[str]]:
    names: Dict[str, Set[str]] = {}
    for platform in PLATFORMS:
        directory = root.joinpath(*CLAUDETEAM_SCRIPT_DIRS[platform])
        suffix = CLAUDETEAM_SCRIPT_SUFFIXES[platform]
        names[platform] = {
            script.stem for script in directory.iterdir()
            if script.is_file() and script.suffix.lower() == suffix
        } if directory.is_dir() else set()
    return names


def _preset_commands(platform: str) -> List[Dict[str, Any]]:
    presets: List[Dict[str, Any]] = []
    for preset_id, entries, arguments in PRESET_COMMANDS:
        commands = {os_name: " ".join((entries[os_name], *arguments)) for os_name in PLATFORMS}
        presets.append({"kind": KIND_PRESET, "id": preset_id, "command": commands[platform], "commands": commands})
    return presets


def _mtime_ns(path: Path) -> int:
    try:
        return path.stat().st_mtime_ns
    except OSError:
        return 0


def list_quick_commands() -> Dict[str, Any]:
    platform = _platform()
    root = get_core_node_root()
    signature = (
        platform,
        _mtime_ns(root),
        *(_mtime_ns(root.joinpath(*CLAUDETEAM_SCRIPT_DIRS[name])) for name in PLATFORMS),
    )
    cached: Optional[Dict[str, Any]] = _cache["result"]
    if cached is not None and _cache["signature"] == signature:
        return cached
    result = _scan_quick_commands(platform, root)
    _cache["signature"], _cache["result"] = signature, result
    return result


def _scan_quick_commands(platform: str, root: Path) -> Dict[str, Any]:
    names = _script_names(root)
    custom = [
        {
            "kind": KIND_CUSTOM,
            "id": stem,
            "command": stem if stem in names[platform] else None,
            "commands": {os_name: (stem if stem in names[os_name] else None) for os_name in PLATFORMS},
        }
        for stem in sorted(names[PLATFORM_WINDOWS] | names[PLATFORM_LINUX], key=str.lower)
    ]
    return {
        "success": True,
        "platform": platform,
        "script_dir": str(root.joinpath(*CLAUDETEAM_SCRIPT_DIRS[platform])),
        "preset": _preset_commands(platform),
        "system": [
            {
                "kind": KIND_SYSTEM,
                "id": command_id,
                "command": windows_line if platform == PLATFORM_WINDOWS else linux_line,
                "commands": {PLATFORM_WINDOWS: windows_line, PLATFORM_LINUX: linux_line},
            }
            for command_id, windows_line, linux_line in SYSTEM_COMMANDS
        ],
        "custom": custom,
    }
