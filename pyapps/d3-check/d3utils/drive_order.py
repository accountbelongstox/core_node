#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Windows drive order for path scan.
Dynamically gets fixed (local) drive letters, skips removable/USB/CD-ROM/network,
caches the result, and returns roots in preferred order (D first, C last).

Documentation (Windows API):
- GetLogicalDrives: https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getlogicaldrives
- GetDriveTypeW:    https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getdrivetypew
  Return values: DRIVE_UNKNOWN=0, DRIVE_NO_ROOT_DIR=1, DRIVE_REMOVABLE=2 (USB/floppy),
  DRIVE_FIXED=3 (local disk), DRIVE_REMOTE=4 (network), DRIVE_CDROM=5, DRIVE_RAMDISK=6.
  We only include DRIVE_FIXED (3); skip REMOVABLE, CDROM, REMOTE.
"""

import os
import string
from typing import List, Optional

from config.constants import PATH_SCAN_PREFERRED_ORDER

# Module-level cache: list of "X:\\" for fixed drives in scan order
_cached_fixed_roots: Optional[List[str]] = None

# Windows drive type (fileapi.h)
DRIVE_REMOVABLE = 2
DRIVE_FIXED = 3
DRIVE_REMOTE = 4
DRIVE_CDROM = 5


def invalidate_cache() -> None:
    """Clear cached drive list (e.g. after USB plug/unplug or for tests)."""
    global _cached_fixed_roots
    _cached_fixed_roots = None


def get_fixed_drive_roots_for_scan(use_cache: bool = True) -> List[str]:
    """
    Return drive roots to scan: fixed (local) drives only, in preferred order (D first, C last).
    Skips removable/USB (DRIVE_REMOVABLE), CD-ROM (DRIVE_CDROM), network (DRIVE_REMOTE).
    Result is cached; pass use_cache=False to refresh, or call invalidate_cache().
    """
    global _cached_fixed_roots
    if use_cache and _cached_fixed_roots is not None:
        return _cached_fixed_roots

    if os.name != "nt":
        _cached_fixed_roots = []
        return _cached_fixed_roots

    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        # GetLogicalDrives: bitmask, bit 0 = A:, bit 1 = B:, ...
        bitmask = kernel32.GetLogicalDrives()
        fixed_letters: List[str] = []
        for i, letter in enumerate(string.ascii_uppercase):
            if not (bitmask & (1 << i)):
                continue
            root = f"{letter}:\\"
            # GetDriveTypeW: root must have trailing backslash
            drive_type = kernel32.GetDriveTypeW(ctypes.c_wchar_p(root))
            if drive_type == DRIVE_FIXED:
                fixed_letters.append(letter)
    except Exception:
        fixed_letters = []
        for letter in string.ascii_uppercase:
            root = f"{letter}:\\"
            if os.path.exists(root):
                fixed_letters.append(letter)

    # Order: preferred (D, E, F, G, H, C) then any remaining
    ordered: List[str] = []
    for p in PATH_SCAN_PREFERRED_ORDER:
        if p in fixed_letters:
            ordered.append(f"{p}:\\")
    for letter in fixed_letters:
        root = f"{letter}:\\"
        if root not in ordered:
            ordered.append(root)

    _cached_fixed_roots = ordered
    return ordered
