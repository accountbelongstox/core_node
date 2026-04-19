# -*- coding: utf-8 -*-
"""
Battle.net window finder (shared).
Finds Battle.net windows by process name. Used by both D3 and D4 without game-specific imports.
"""
import os
from pathlib import Path
from typing import Optional, List, Dict, Any

from providor.constants.common import BATTLE_NET_EXE_NAME
from providor.providor_index import get_config_value_safe
from pycore.pyfoundations.third_party import get_third_package_win32gui
from pycore.pyutils.common.browser_window_detector import get_process_exe_path

win32gui = get_third_package_win32gui()


def get_battlenet_path() -> Optional[Path]:
    """Return Battle.net exe path from config battlenet.battlenet_path, or None."""
    path = (get_config_value_safe("battlenet.battlenet_path") or "").strip()
    if not path:
        return None
    p = Path(path)
    return p if p.is_file() else None


def find_battlenet_windows() -> List[Dict[str, Any]]:
    """
    Find Battle.net windows by process only (Battle.net.exe).
    Returns list of window dicts: hwnd, title, rect, width, height, class_name.
    """
    exe_lower = (BATTLE_NET_EXE_NAME or "").strip().lower()
    if not exe_lower:
        return []
    out: List[Dict[str, Any]] = []
    try:
        def _callback(hwnd, _):
            if not win32gui.IsWindowVisible(hwnd):
                return True
            path = get_process_exe_path(hwnd)
            if not path or os.path.basename(path).lower() != exe_lower:
                return True
            try:
                rect = win32gui.GetWindowRect(hwnd)
                out.append({
                    "hwnd": hwnd,
                    "title": win32gui.GetWindowText(hwnd),
                    "class_name": win32gui.GetClassName(hwnd),
                    "rect": rect,
                    "width": rect[2] - rect[0],
                    "height": rect[3] - rect[1],
                })
            except Exception:
                pass
            return True
        win32gui.EnumWindows(_callback, None)
    except Exception:
        pass
    return out
