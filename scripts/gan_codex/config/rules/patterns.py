"""Alias handling for terminal detection."""

from __future__ import annotations

import re
from typing import Dict

TERMINAL_ALIASES: Dict[str, str] = {
    "powershell7": "pwsh",
    "powershell-core": "pwsh",
    "ps": "powershell",
    "terminal": "gnome-terminal",
    "gnome": "gnome-terminal",
    "wt": "windows-terminal",
    "cmd.exe": "cmd",
}

_ALIAS_CLEANER = re.compile(r"[^a-z0-9]+")


def normalize_key(name: str) -> str:
    key = _ALIAS_CLEANER.sub("-", name.lower()).strip("-")
    return TERMINAL_ALIASES.get(key, key)
