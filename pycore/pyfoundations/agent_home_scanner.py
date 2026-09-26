# -*- coding: utf-8 -*-
"""Agent home directory scan center (base library).

Single source of truth for "which user homes may hold local AI agent history".
Roots come ONLY from system_paths: AGENT_SLOT_USERS_ROOTS (per-launcher slot
roots, see AGENT_LAUNCHER_SLOT_PROFILES) plus the OS-level user roots.

Supported hosts: Windows 10/11 (native roots) and Linux (Ubuntu / Debian /
Kali, incl. WSL and dual-boot NTFS data disks via get_shared_windows_users_roots).

Homes are deduped by file identity (st_dev, st_ino), so bind mounts and
symlink aliases of the same tree (e.g. /www/programing == /mnt/<disk>/programing)
are scanned once. Homes the process cannot read (e.g. /root while pycore runs
as a desktop user) are reported by unreadable_user_homes() instead of being
silently dropped; on Linux the root spool helper
(pycore.pyctl.agent_history.root_spool) parses those sources for the worker.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

try:
    import pwd
    PWD_AVAILABLE = True
except ImportError:
    PWD_AVAILABLE = False

from pycore.pyfoundations.core_node_dirs import get_core_node_data_dir
from pycore.pyfoundations.system_paths import (
    AGENT_HISTORY_HUMAN_UID_MIN,
    AGENT_HISTORY_NOLOGIN_SHELLS,
    AGENT_HISTORY_NON_HUMAN_SUFFIXES,
    AGENT_HISTORY_NON_HUMAN_USERS,
    AGENT_HISTORY_OFFICIAL_HOME_MARKERS,
    AGENT_HISTORY_USERS_ROOTS_ENV,
    AGENT_HISTORY_USERS_ROOTS_LINUX,
    AGENT_HISTORY_USERS_ROOTS_WINDOWS,
    AGENT_SLOT_USERS_ROOTS,
    get_shared_windows_users_roots,
)

_PLATFORM_KEY = "win32" if sys.platform == "win32" else "linux"
_READ_MODE = os.R_OK | os.X_OK


def path_identity(path: str) -> Tuple[int, int] | str:
    """(st_dev, st_ino) of a path; realpath when the FS reports no inode."""
    if not os.path.exists(path):
        return os.path.realpath(path)
    st = os.stat(path)
    if st.st_ino:
        return (st.st_dev, st.st_ino)
    return os.path.realpath(path)


def _expand_root(template: str) -> Path:
    if template.startswith("<data>"):
        return get_core_node_data_dir() / template[len("<data>/"):]
    if template.startswith("~"):
        return Path.home() / template[2:]
    return Path(template)


def agent_history_slot_users_roots() -> List[Path]:
    """Per-slot users-roots for this platform, from AGENT_SLOT_USERS_ROOTS."""
    roots: List[Path] = []
    for spec in AGENT_SLOT_USERS_ROOTS.values():
        for template in spec.get(_PLATFORM_KEY) or ():
            roots.append(_expand_root(template))
    return roots


def agent_history_users_roots() -> List[Path]:
    """Users-root directories to scan, platform-split, env-overridable."""
    override = os.environ.get(AGENT_HISTORY_USERS_ROOTS_ENV, "").strip()
    if override:
        return [Path(item.strip()) for item in override.split(os.pathsep) if item.strip()]
    os_roots = AGENT_HISTORY_USERS_ROOTS_WINDOWS if _PLATFORM_KEY == "win32" else AGENT_HISTORY_USERS_ROOTS_LINUX
    roots = [Path(item) for item in os_roots]
    roots.extend(agent_history_slot_users_roots())
    roots.extend(get_shared_windows_users_roots())
    return roots


def _passwd_by_home() -> Dict[str, Tuple[int, str]]:
    """home dir -> (uid, shell) from the local account database (POSIX)."""
    if not PWD_AVAILABLE:
        return {}
    return {os.path.realpath(e.pw_dir): (e.pw_uid, e.pw_shell) for e in pwd.getpwall()}


def is_human_account(name: str, path: Path, accounts: Dict[str, Tuple[int, str]]) -> bool:
    """False for system/service/machine accounts (constants in system_paths)."""
    if name in AGENT_HISTORY_NON_HUMAN_USERS or name.endswith(AGENT_HISTORY_NON_HUMAN_SUFFIXES):
        return False
    account = accounts.get(os.path.realpath(path))
    if account is None:
        return True
    uid, shell = account
    if uid == 0:
        return True
    return uid >= AGENT_HISTORY_HUMAN_UID_MIN and shell not in AGENT_HISTORY_NOLOGIN_SHELLS


def _readable_dir(path: Path) -> bool:
    return os.path.isdir(path) and os.access(path, _READ_MODE)


def _is_home_root(root: Path) -> bool:
    """A root that itself carries agent markers (or is /root) is a home."""
    if str(root) == "/root":
        return True
    return any(os.path.exists(root / marker) for marker in _all_marker_dirs())


def _candidate_homes() -> List[Tuple[Path, str]]:
    accounts = _passwd_by_home()
    home = Path.home()
    user = os.environ.get("USERNAME") or os.environ.get("USER") or home.name
    candidates: List[Tuple[Path, str]] = [(home, user)]
    for root in agent_history_users_roots():
        if not os.path.isdir(root):
            continue
        if not os.access(root, _READ_MODE):
            candidates.append((root, root.name))
            continue
        if _is_home_root(root):
            candidates.append((root, root.name))
            continue
        for child in sorted(root.iterdir()):
            if child.name.startswith(".") or not os.path.isdir(child):
                continue
            if is_human_account(child.name, child, accounts):
                candidates.append((child, child.name))
    return candidates


def scan_user_homes() -> Dict[str, str]:
    """Map of readable home path -> OS user / slot name, identity-deduped."""
    homes: Dict[str, str] = {}
    seen: set = set()
    for path, user in _candidate_homes():
        if not _readable_dir(path):
            continue
        key = path_identity(str(path))
        if key in seen:
            continue
        seen.add(key)
        homes[str(path)] = user
    return homes


def unreadable_user_homes() -> List[str]:
    """Existing homes the scanning process cannot read (permission gap)."""
    out: List[str] = []
    for path, _user in _candidate_homes():
        if os.path.isdir(path) and not os.access(path, _READ_MODE):
            out.append(str(path))
    return sorted(set(out))


def _all_marker_dirs() -> List[str]:
    markers: List[str] = []
    for spec in AGENT_HISTORY_OFFICIAL_HOME_MARKERS.values():
        markers.extend(str(name) for name in (spec.get("dirs") or ()))
    return markers


__all__ = [
    "agent_history_slot_users_roots",
    "agent_history_users_roots",
    "is_human_account",
    "path_identity",
    "scan_user_homes",
    "unreadable_user_homes",
]
