# -*- coding: utf-8 -*-
"""
Browser window finder for CN Battle.net login fallback.
Finds browser windows by title (e.g. Battle.net login). Prefers the frontmost browser
(relative to other browsers) that matches the title.
"""

from typing import List, Dict, Any, Optional, Sequence

from pycore.pyfoundations.third_party.api import get_third_package_win32gui
from pycore.pyutils.common.browser_window_detector import (
    get_process_exe_path,
    is_browser_process_by_path,
)

from providor.constants.common import BROWSER_LOGIN_WINDOW_TITLE_SUBSTRS

win32gui = get_third_package_win32gui()


def find_browser_login_windows(title_substrs: Optional[Sequence[str]] = None) -> List[Dict[str, Any]]:
    """
    Find visible browser windows whose title contains any of the given substrings.
    Returns list of dicts: hwnd, title, rect, width, height.
    """
    needles = title_substrs if title_substrs is not None else (BROWSER_LOGIN_WINDOW_TITLE_SUBSTRS or ())
    needles = [s.strip() for s in needles if s and str(s).strip()]
    if not needles:
        return []
    out: List[Dict[str, Any]] = []
    try:
        def _callback(hwnd, _):
            if not win32gui.IsWindowVisible(hwnd):
                return True
            path = get_process_exe_path(hwnd)
            if not path or not is_browser_process_by_path(path):
                return True
            try:
                title = win32gui.GetWindowText(hwnd)
                if not title or not any(nd in title for nd in needles):
                    return True
                rect = win32gui.GetWindowRect(hwnd)
                out.append({
                    "hwnd": hwnd,
                    "title": title,
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


def get_frontmost_browser_login_window(title_substrs: Optional[Sequence[str]] = None) -> Optional[Dict[str, Any]]:
    """
    Return the browser login window to use: foreground window if it matches,
    otherwise the first from find_browser_login_windows (frontmost among browsers).
    """
    candidates = find_browser_login_windows(title_substrs=title_substrs)
    if not candidates:
        return None
    try:
        fg = win32gui.GetForegroundWindow()
        if fg:
            for c in candidates:
                if c.get("hwnd") == fg:
                    return c
    except Exception:
        pass
    return candidates[0]
