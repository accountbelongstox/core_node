#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Path scanner for ROSBOT and Battle.net executables.
Scans drives (D first, then others, C last) up to a fixed depth.
"""

import os
import glob
from typing import List, Tuple, Optional

from config.constants import (
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

    # 扫描前检查：已配置且存在的 Battle.net 则不再扫
    configured_bn = _get_configured_battlenet_path()
    if configured_bn:
        battlenet_path = configured_bn
        ColorPrint.blue(f"{_PATHSCAN_TAG} Battle.net 已配置且存在，跳过扫描: {configured_bn}")

    # 扫描条件：输出到日志并传递到 UI
    ColorPrint.blue(f"{_PATHSCAN_TAG} === 扫描条件 ===")
    ColorPrint.blue(f"{_PATHSCAN_TAG} 盘符顺序: D 盘优先，C 盘最后（仅固定盘，已跳过 U 盘/光驱/网络盘）")
    ColorPrint.blue(f"{_PATHSCAN_TAG} 参与盘符: {', '.join(drives) or '(无)'}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} 最大深度: {PATH_SCAN_MAX_DEPTH} 级目录")
    ColorPrint.blue(f"{_PATHSCAN_TAG} Battle.net: {'已配置，本次不扫描' if battlenet_path else '未配置或不存在，本次扫描'}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} --- ROSBOT 扫描条件 ---")
    ColorPrint.blue(f"{_PATHSCAN_TAG} ROSBOT 每次均扫描，查找目标: {', '.join(ROSBOT_EXE_PATTERNS)}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} ROSBOT 参与盘符: {', '.join(drives) or '(无)'}")
    ColorPrint.blue(f"{_PATHSCAN_TAG} ROSBOT 最大深度: {PATH_SCAN_MAX_DEPTH} 级目录")
    ColorPrint.blue(f"{_PATHSCAN_TAG} === 开始扫描 ===")

    for drive_root in drives:
        ColorPrint.blue(f"{_PATHSCAN_TAG} 正在扫描 {drive_root} ...")
        bn, ros = _scan_dir(drive_root, 1)
        if bn and battlenet_path is None:
            battlenet_path = bn
            ColorPrint.green(f"{_PATHSCAN_TAG} 找到 Battle.net.exe: {bn}")
        for d in ros:
            norm = os.path.normpath(d)
            if norm not in seen_rosbot:
                seen_rosbot.add(norm)
                rosbot_dirs.append(d)
                ColorPrint.green(f"{_PATHSCAN_TAG} 找到 ROSBOT: {d}")

    ColorPrint.blue(f"{_PATHSCAN_TAG} === 扫描结束 === Battle.net: {1 if battlenet_path else 0} 个, ROSBOT 目录: {len(rosbot_dirs)} 个")
    return battlenet_path, rosbot_dirs
