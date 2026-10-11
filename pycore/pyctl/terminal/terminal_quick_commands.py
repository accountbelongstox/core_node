# -*- coding: utf-8 -*-
"""Quick-command library of the terminal UI, read from config/terminal_quick_commands.json: presets,
system commands and every claudeteam directory script. Each entry carries one command line per shell
OS, because a pycore host can show terminals of the other OS (e.g. WSL on Windows). Entries are
addressed by key (kind:id); only a key of this library resolves to a command line."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from pycore.pyfoundations.pygvar import IS_WINDOWS
from pycore.pyfoundations.system_paths import get_core_node_root

QUICK_COMMANDS_CONFIG_PATH = (get_core_node_root() / "config" / "terminal_quick_commands.json").resolve()
PLATFORM_WINDOWS = "windows"
PLATFORM_LINUX = "linux"
PLATFORMS = (PLATFORM_WINDOWS, PLATFORM_LINUX)
KIND_SYSTEM = "system"
KIND_CUSTOM = "custom"
KIND_PRESET = "preset"
KEY_SEPARATOR = ":"
ERROR_COMMAND_UNKNOWN = "quick_command_unknown"
ERROR_PLATFORM_INVALID = "quick_command_platform_invalid"
ERROR_PLATFORM_UNAVAILABLE = "quick_command_platform_unavailable"

CONFIG: Dict[str, Any] = json.loads(QUICK_COMMANDS_CONFIG_PATH.read_text(encoding="utf-8"))
INTERRUPT_POLICY: Dict[str, Any] = CONFIG["interrupt"]
# The list is rebuilt only when the script directories or the repo root change
# (adding, removing or renaming an entry updates the directory mtime).
_cache: Dict[str, Any] = {"signature": None, "result": None}


def command_key(kind: str, command_id: str) -> str:
    return f"{kind}{KEY_SEPARATOR}{command_id}"


def _platform() -> str:
    return PLATFORM_WINDOWS if IS_WINDOWS else PLATFORM_LINUX


def _script_dir(root: Path, platform: str) -> Path:
    return root.joinpath(*CONFIG["script_dirs"][platform])


def _script_names(root: Path) -> Dict[str, Set[str]]:
    names: Dict[str, Set[str]] = {}
    for platform in PLATFORMS:
        directory = _script_dir(root, platform)
        suffix = CONFIG["script_suffixes"][platform]
        names[platform] = {
            script.stem for script in directory.iterdir()
            if script.is_file() and script.suffix.lower() == suffix
        } if directory.is_dir() else set()
    return names


def _entry(kind: str, command_id: str, commands: Dict[str, Optional[str]], platform: str) -> Dict[str, Any]:
    return {
        "kind": kind,
        "id": command_id,
        "key": command_key(kind, command_id),
        "command": commands[platform],
        "commands": commands,
    }


def _preset_commands(platform: str) -> List[Dict[str, Any]]:
    return [
        _entry(
            KIND_PRESET,
            preset["id"],
            {os_name: " ".join((preset["entry"][os_name], *preset["arguments"])) for os_name in PLATFORMS},
            platform,
        )
        for preset in CONFIG["presets"]
    ]


def _system_commands(platform: str) -> List[Dict[str, Any]]:
    return [
        _entry(KIND_SYSTEM, command["id"], {os_name: command[os_name] for os_name in PLATFORMS}, platform)
        for command in CONFIG["system"]
    ]


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
        *(_mtime_ns(_script_dir(root, name)) for name in PLATFORMS),
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
        _entry(
            KIND_CUSTOM,
            stem,
            {os_name: (stem if stem in names[os_name] else None) for os_name in PLATFORMS},
            platform,
        )
        for stem in sorted(names[PLATFORM_WINDOWS] | names[PLATFORM_LINUX], key=str.lower)
    ]
    return {
        "success": True,
        "platform": platform,
        "script_dir": str(_script_dir(root, platform)),
        "interrupt": INTERRUPT_POLICY,
        "pinned": [command_key(pin["kind"], pin["id"]) for pin in CONFIG["pinned"]],
        "card": [{"key": command_key(item["kind"], item["id"]), "icon": item["icon"]} for item in CONFIG["card"]],
        "preset": _preset_commands(platform),
        "system": _system_commands(platform),
        "custom": custom,
    }


def resolve_quick_command(command_key_value: str, shell_os: str) -> Dict[str, Any]:
    """Command line of a library entry for a shell OS; any text that is not a library key is refused."""
    if shell_os not in PLATFORMS:
        return {"success": False, "error_code": ERROR_PLATFORM_INVALID}
    catalog = list_quick_commands()
    entries = [*catalog["preset"], *catalog["system"], *catalog["custom"]]
    entry = next((candidate for candidate in entries if candidate["key"] == command_key_value), None)
    if entry is None:
        return {"success": False, "error_code": ERROR_COMMAND_UNKNOWN}
    line = entry["commands"][shell_os]
    if not line:
        return {"success": False, "error_code": ERROR_PLATFORM_UNAVAILABLE}
    return {"success": True, "error_code": None, "key": entry["key"], "kind": entry["kind"], "id": entry["id"], "line": line}
