#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Path scanner for ROSBOT and Battle.net executables.
Scans drives (D first, then others, C last) up to a fixed depth.
"""

import os
import glob
from typing import List, Tuple, Optional, Callable, Dict

from providor.constants.common import BATTLE_NET_EXE_NAME, PATH_SCAN_MAX_DEPTH
from providor.constants.d3 import DIABLO_III_EXE_NAME, ROSBOT_EXE_PATTERNS
from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG
from d3utils.drive_order import get_fixed_drive_roots_for_scan

# Log prefix for UI (ROSBOT log receives these via ColorPrint callback)
_PATHSCAN_TAG = "[PathScan]"

# Subdirectories to skip: names starting with "." plus common cache/temp/build dirs (case-insensitive)
_SCAN_SKIP_DIRS = frozenset({
    "node_modules", "__pycache__", ".git", ".svn", ".hg", ".venv", "venv", "env",
    ".npm", ".cache", ".yarn", "tmp", "temp", "build", "dist", ".idea", ".vscode",
    "appdata", "cache", "caches", ".nuget", "packages", ".tox", ".mypy_cache",
})


def _should_skip_dir(name: str) -> bool:
    """Return True if this directory name should be skipped (dot-prefix or in skip set)."""
    if not name or name.startswith("."):
        return True
    return name.lower() in _SCAN_SKIP_DIRS


def _file_mtime(path: str) -> float:
    """Return mtime of file, or 0 on error (so path is still kept)."""
    try:
        return os.path.getmtime(path)
    except (OSError, PermissionError):
        return 0.0


def _keep_newer(
    current: Optional[Tuple[str, float]], new_path: str, new_mtime: float
) -> Optional[Tuple[str, float]]:
    """Keep the path with the later (newer) mtime. Returns (path, mtime)."""
    if current is None:
        return (new_path, new_mtime)
    return (new_path, new_mtime) if new_mtime > current[1] else current


def _scan_dir(
    root: str,
    depth: int,
    progress_callback: Optional[Callable[[str], None]] = None,
) -> Tuple[Optional[Tuple[str, float]], List[Tuple[str, float]], Optional[Tuple[str, float]]]:
    """
    Scan one directory (and subdirs up to depth).
    Returns (battlenet_path_mtime, list of (rosbot_dir, mtime), d3_path_mtime).
    When multiple matches for the same exe type are found, the one with the newest mtime is kept.
    progress_callback(current_dir) is invoked from the scan thread; do not perform UI ops in it.
    """
    battlenet: Optional[Tuple[str, float]] = None
    rosbot_list: List[Tuple[str, float]] = []
    d3: Optional[Tuple[str, float]] = None
    if depth > PATH_SCAN_MAX_DEPTH:
        return battlenet, rosbot_list, d3
    if progress_callback:
        progress_callback(root)
    try:
        entries = os.listdir(root)
    except (OSError, PermissionError):
        return battlenet, rosbot_list, d3
    for name in entries:
        full = os.path.join(root, name)
        if os.path.isfile(full):
            mtime = _file_mtime(full)
            if name == BATTLE_NET_EXE_NAME:
                battlenet = _keep_newer(battlenet, full, mtime)
            elif name == DIABLO_III_EXE_NAME:
                d3 = _keep_newer(d3, full, mtime)
            else:
                for pattern in ROSBOT_EXE_PATTERNS:
                    if glob.fnmatch.fnmatch(name, pattern):
                        rosbot_list.append((root, mtime))
                        break
        elif os.path.isdir(full):
            if _should_skip_dir(name):
                continue
            sub_bn, sub_ros, sub_d3 = _scan_dir(full, depth + 1, progress_callback)
            if sub_bn:
                battlenet = _keep_newer(battlenet, sub_bn[0], sub_bn[1])
            if sub_d3:
                d3 = _keep_newer(d3, sub_d3[0], sub_d3[1])
            rosbot_list.extend(sub_ros)
    return battlenet, rosbot_list, d3


def _get_configured_battlenet_path() -> Optional[str]:
    """Return configured Battle.net path if non-empty and file exists, else None."""
    path = (CONFIG.get("battlenet") or {}).get("battlenet_path", "").strip()
    if not path or not os.path.isfile(path):
        return None
    if os.path.basename(path) != BATTLE_NET_EXE_NAME:
        return None
    return path


def _get_configured_d3_path() -> Optional[str]:
    """Return configured D3 path if non-empty and file exists, else None."""
    path = (CONFIG.get("d3") or {}).get("d3_path", "").strip()
    if not path or not os.path.isfile(path):
        return None
    if os.path.basename(path) != DIABLO_III_EXE_NAME:
        return None
    return path


def scan_for_paths(
    progress_callback: Optional[Callable[[str], None]] = None,
    include_rosbot: bool = True,
) -> Tuple[Optional[str], List[str], Optional[str]]:
    """
    Scan from D (then other drives, C last), max PATH_SCAN_MAX_DEPTH levels.
    If configured Battle.net path exists and is valid, skip scanning for Battle.net; same for D3.
    When include_rosbot is True, ROSBOT is scanned; when False, only Battle.net and D3 are scanned.
    Returns (battlenet_exe_path or None, list of ROSBOT directory paths, d3_exe_path or None).
    progress_callback(current_dir) is called from the scan thread for each directory; do not perform UI operations in it.
    """
    battlenet_path: Optional[str] = None
    battlenet_mtime: float = 0.0
    d3_path: Optional[str] = None
    d3_mtime: float = 0.0
    rosbot_by_dir: Dict[str, Tuple[str, float]] = {}
    drives = get_fixed_drive_roots_for_scan()

    configured_bn = _get_configured_battlenet_path()
    if configured_bn:
        battlenet_path = configured_bn
        battlenet_mtime = _file_mtime(configured_bn)
        ColorPrint.blue(f"{_PATHSCAN_TAG} Battle.net configured and exists, skip scan: {configured_bn}")

    configured_d3 = _get_configured_d3_path()
    if configured_d3:
        d3_path = configured_d3
        d3_mtime = _file_mtime(configured_d3)
        ColorPrint.blue(f"{_PATHSCAN_TAG} D3 configured and exists, skip scan: {configured_d3}")

    ColorPrint.blue(f"{_PATHSCAN_TAG} === Scan criteria ===")
    ColorPrint.blue(f"{_PATHSCAN_TAG} Drives: {', '.join(drives) or '(none)'}, Max depth: {PATH_SCAN_MAX_DEPTH}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} Battle.net: {'configured, skip' if battlenet_path else 'will scan'}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} D3: {'configured, skip' if d3_path else 'will scan'}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} ROSBOT: {'will scan' if include_rosbot else 'skip (BN+D3 only)'}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} === Start scan ===")

    need_bn = battlenet_path is None
    need_d3 = d3_path is None
    need_rosbot = include_rosbot

    for drive_root in drives:
        if not need_bn and not need_d3 and not need_rosbot:
            break
        if progress_callback:
            progress_callback(drive_root)
        ColorPrint.blue(f"{_PATHSCAN_TAG} Scanning {drive_root} ...")
        bn, ros, d3 = _scan_dir(drive_root, 1, progress_callback)
        if bn and (battlenet_path is None or bn[1] > battlenet_mtime):
            battlenet_path = bn[0]
            battlenet_mtime = bn[1]
            ColorPrint.green(f"{_PATHSCAN_TAG} Found Battle.net.exe: {bn[0]}")
        if d3 and (d3_path is None or d3[1] > d3_mtime):
            d3_path = d3[0]
            d3_mtime = d3[1]
            ColorPrint.green(f"{_PATHSCAN_TAG} Found Diablo III.exe: {d3[0]}")
        if include_rosbot:
            for dir_path, mtime in ros:
                norm = os.path.normpath(dir_path)
                if norm not in rosbot_by_dir or mtime > rosbot_by_dir[norm][1]:
                    rosbot_by_dir[norm] = (dir_path, mtime)
                    ColorPrint.green(f"{_PATHSCAN_TAG} Found ROSBOT: {dir_path}")
        need_bn = battlenet_path is None
        need_d3 = d3_path is None
        need_rosbot = include_rosbot and len(rosbot_by_dir) == 0
        if not need_bn and not need_d3 and not need_rosbot:
            ColorPrint.blue(f"{_PATHSCAN_TAG} Scan complete.")
            break

    rosbot_dirs = [t[0] for t in sorted(rosbot_by_dir.values(), key=lambda x: -x[1])]
    ColorPrint.blue(f"{_PATHSCAN_TAG} === Scan done === Battle.net: {1 if battlenet_path else 0}, D3: {1 if d3_path else 0}, ROSBOT dirs: {len(rosbot_dirs)}")
    return battlenet_path, rosbot_dirs, d3_path
