# -*- coding: utf-8 -*-
"""Agent home directory scan center (base library).

Single source of truth for "which user homes may hold local AI agent history".
Covers the real user home plus every per-slot isolated profile root used by
the scripts/winenvs launchers (kimi1/kimi2 -> D:\\.tmp\\Users\\KimiN, codex1 ->
D:\\programing\\Users\\Codex1, pi* -> D:\\programing\\Users\\Pi*, etc.). Linux
roots come from AGENT_HISTORY_USERS_ROOTS_LINUX. All functions never raise.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

from pycore.pyfoundations.system_paths import (
    AGENT_HISTORY_OFFICIAL_HOME_MARKERS,
    AGENT_HISTORY_USERS_ROOTS_ENV,
    AGENT_HISTORY_USERS_ROOTS_LINUX,
    AGENT_HISTORY_USERS_ROOTS_WINDOWS,
)


def agent_history_users_roots() -> List[Path]:
    """Users-root directories to scan, platform-split, env-overridable."""
    override = os.environ.get(AGENT_HISTORY_USERS_ROOTS_ENV, "").strip()
    if override:
        return [
            Path(item.strip())
            for item in override.split(os.pathsep)
            if item.strip()
        ]
    raw = (
        AGENT_HISTORY_USERS_ROOTS_WINDOWS
        if sys.platform == "win32"
        else AGENT_HISTORY_USERS_ROOTS_LINUX
    )
    return [Path(item) for item in raw]


def scan_user_homes() -> Dict[str, str]:
    """Map of home path -> OS user name for every scannable home.

    Includes the current process home, each existing users-root that holds
    profiles directly (e.g. /root), and one level of per-slot profile dirs
    under each users-root (slot names are discovered, never hardcoded).
    """
    homes: Dict[str, str] = {}
    seen: set[str] = set()

    def add(path: Path, user: str) -> None:
        try:
            if not path.is_dir():
                return
            real = str(path.resolve())
        except OSError:
            return
        if real in seen:
            return
        seen.add(real)
        homes[str(path)] = user

    home = Path.home()
    user = os.environ.get("USERNAME") or os.environ.get("USER") or home.name
    add(home, user)

    for root in agent_history_users_roots():
        try:
            if not root.is_dir():
                continue
            children = sorted(root.iterdir())
        except OSError:
            continue
        # A root that itself carries agent markers (or is /root) is a home,
        # not a container of slot profiles -- never descend into it.
        if str(root) == "/root" or any(
            (root / marker).exists() for marker in _all_marker_dirs()
        ):
            add(root, root.name)
            continue
        for child in children:
            if child.name.startswith("."):
                continue
            add(child, child.name)
    return homes


def official_tool_homes(tool: str, home: str) -> List[str]:
    """Official config dirs for a tool inside one home (env override first).

    Order: rooted official env var (KIMI_CODE_HOME / CODEX_HOME /
    CLAUDE_CONFIG_DIR) -> official default dir names in the home. Missing
    dirs are skipped; the caller falls back to a machine scan when empty.
    """
    spec = AGENT_HISTORY_OFFICIAL_HOME_MARKERS.get(str(tool or "").strip().lower())
    if spec is None:
        return []
    out: List[str] = []
    seen: set[str] = set()

    def add(path: str) -> None:
        if not os.path.isdir(path):
            return
        real = os.path.realpath(path)
        if real in seen:
            return
        seen.add(real)
        out.append(path)

    env_key = str(spec.get("env") or "")
    if env_key:
        env_value = os.environ.get(env_key, "").strip()
        if env_value and os.path.isabs(env_value):
            add(env_value)
    for name in spec.get("dirs") or ():
        add(os.path.join(home, name))
    return out


def _all_marker_dirs() -> List[str]:
    markers: List[str] = []
    for spec in AGENT_HISTORY_OFFICIAL_HOME_MARKERS.values():
        markers.extend(str(name) for name in (spec.get("dirs") or ()))
    return markers


__all__ = [
    "agent_history_users_roots",
    "scan_user_homes",
    "official_tool_homes",
]
