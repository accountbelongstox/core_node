#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Path scanner for ROSBOT and Battle.net executables.
Scans drives (D first, then others, C last) up to a fixed depth.
"""

import os
import glob
from typing import List, Tuple, Optional

from providor.app_constants import (
    BATTLE_NET_EXE_NAME,
    ROSBOT_EXE_PATTERNS,
    PATH_SCAN_MAX_DEPTH,
)
from providor.common_imports import ColorPrint
from providor.providor_index import CONFIG
from d3utils.drive_order import get_fixed_drive_roots_for_scan

# Log prefix for UI (ROSBOT log receives these via ColorPrint callback)
_PATHSCAN_TAG = "[PathScan]"


def _scan_dir(root: str, depth: int) -> Tuple[Optional[str], List[str]]:
    """
    Scan one directory (and subdirs up to depth). Returns (battlenet_path, list of rosbot dirs).
    """
    battlenet_path: Optional[str] = None
    rosbot_dirs: List[str] = []
    if depth > PATH_SCAN_MAX_DEPTH:
        return battlenet_path, rosbot_dirs
    try:
        entries = os.listdir(root)
    except (OSError, PermissionError):
        return battlenet_path, rosbot_dirs
    for name in entries:
        full = os.path.join(root, name)
        if os.path.isfile(full):
            if name == BATTLE_NET_EXE_NAME and battlenet_path is None:
                battlenet_path = full
            for pattern in ROSBOT_EXE_PATTERNS:
                if glob.fnmatch.fnmatch(name, pattern):
                    rosbot_dirs.append(root)
                    break
        elif os.path.isdir(full):
            sub_bn, sub_ros = _scan_dir(full, depth + 1)
            if sub_bn and battlenet_path is None:
                battlenet_path = sub_bn
            rosbot_dirs.extend(sub_ros)
    return battlenet_path, rosbot_dirs


def _get_configured_battlenet_path() -> Optional[str]:
    """Return configured Battle.net path if non-empty and file exists, else None."""
    path = (CONFIG.get("battlenet") or {}).get("battlenet_path", "").strip()
    if not path or not os.path.isfile(path):
        return None
    if os.path.basename(path) != BATTLE_NET_EXE_NAME:
        return None
    return path


def scan_for_paths() -> Tuple[Optional[str], List[str]]:
    """
    Scan from D (then other drives, C last), max PATH_SCAN_MAX_DEPTH levels.
    If configured Battle.net path exists and is valid, skip scanning for Battle.net; ROSBOT is always scanned.
    Returns (battlenet_exe_path or None, list of ROSBOT directory paths; may be empty).
    Scan conditions and progress are logged via ColorPrint and passed to UI (e.g. ROSBOT log).
    """
    battlenet_path: Optional[str] = None
    rosbot_dirs: List[str] = []
    seen_rosbot = set()
    drives = get_fixed_drive_roots_for_scan()

    # Pre-scan: skip Battle.net scan if already configured and path exists
    configured_bn = _get_configured_battlenet_path()
    if configured_bn:
        battlenet_path = configured_bn
        ColorPrint.blue(f"{_PATHSCAN_TAG} Battle.net configured and exists, skip scan: {configured_bn}")

    # Scan criteria: log and pass to UI
    ColorPrint.blue(f"{_PATHSCAN_TAG} === Scan criteria ===")
    ColorPrint.blue(f"{_PATHSCAN_TAG} Drive order: dynamic (C last, others alphabetical; fixed drives only, skip removable/CD/network)")
    ColorPrint.blue(f"{_PATHSCAN_TAG} Drives: {', '.join(drives) or '(none)'}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} Max depth: {PATH_SCAN_MAX_DEPTH} levels")
    ColorPrint.blue(f"{_PATHSCAN_TAG} Battle.net: {'configured, skip' if battlenet_path else 'not configured or missing, will scan'}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} --- ROSBOT scan criteria ---")
    ColorPrint.blue(f"{_PATHSCAN_TAG} ROSBOT always scanned, patterns: {', '.join(ROSBOT_EXE_PATTERNS)}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} ROSBOT drives: {', '.join(drives) or '(none)'}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} ROSBOT max depth: {PATH_SCAN_MAX_DEPTH} levels")
    ColorPrint.blue(f"{_PATHSCAN_TAG} === Start scan ===")

    for drive_root in drives:
        ColorPrint.blue(f"{_PATHSCAN_TAG} Scanning {drive_root} ...")
        bn, ros = _scan_dir(drive_root, 1)
        if bn and battlenet_path is None:
            battlenet_path = bn
            ColorPrint.green(f"{_PATHSCAN_TAG} Found Battle.net.exe: {bn}")
        for d in ros:
            norm = os.path.normpath(d)
            if norm not in seen_rosbot:
                seen_rosbot.add(norm)
                rosbot_dirs.append(d)
                ColorPrint.green(f"{_PATHSCAN_TAG} Found ROSBOT: {d}")

    ColorPrint.blue(f"{_PATHSCAN_TAG} === Scan done === Battle.net: {1 if battlenet_path else 0}, ROSBOT dirs: {len(rosbot_dirs)}")
    return battlenet_path, rosbot_dirs
