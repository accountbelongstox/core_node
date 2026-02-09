#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 (Diablo III) manager: check if running, kill if running (e.g. before Battle.net click).
Find windows: by exe (d3.d3_path) when configured, else by title; kill by PID of the actual found window.
"""

import os
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any, Set

from providor.constants.d3 import DIABLO_III_EXE_NAME
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.third_party import get_third_package_win32gui
from providor.providor_index import DIABLO_III_WINDOW_TITLES, get_config_value_safe
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.common.browser_window_detector import get_default_skip_browser_callable, get_process_exe_path

from d3utils.process_helper import get_pid_from_hwnd, kill_process_by_pid

win32gui = get_third_package_win32gui()


def _is_editor_like_title(title: str) -> bool:
    """Return True if window title looks like an editor/document (e.g. file path + Notepad++)."""
    if not title or not title.strip():
        return False
    t = title.strip()
    if " - Notepad++" in t or t.endswith(" - Notepad"):
        return True
    if " - " in t and (".txt" in t or ".ini" in t or ".json" in t or ".xml" in t):
        return True
    return False


class D3Manager:
    """
    Diablo III process/window management.
    Find windows by exe (when d3.d3_path set) else by title; kill by PID of found window(s).
    """

    def __init__(
        self,
        window_titles: List[str],
        exe_name: str,
        skip_browser_callable: Optional[Callable[[Dict[str, Any]], bool]] = None,
    ):
        self._window_titles = window_titles or list(DIABLO_III_WINDOW_TITLES)
        self._exe_name = exe_name or DIABLO_III_EXE_NAME
        _default_skip = get_default_skip_browser_callable()
        if skip_browser_callable is not None:
            self._skip_browser = skip_browser_callable
        else:
            self._skip_browser = lambda h, t: _default_skip(h, t) or _is_editor_like_title(t)

    def get_path(self) -> Optional[Path]:
        """Return D3 exe path from config d3.d3_path (thread-safe), or None."""
        path = (get_config_value_safe("d3.d3_path") or "").strip()
        if not path:
            return None
        p = Path(path)
        return p if p.is_file() else None

    def _find_windows_by_exe(self) -> List[Dict[str, Any]]:
        """Find D3 windows by process only (Diablo III.exe). Returns list of window dicts."""
        exe_lower = (self._exe_name or "").strip().lower()
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
        except Exception as e:
            ColorPrint.yellow("[D3Manager] find_windows by exe: %s" % e)
        return out

    def _find_windows_by_title(self) -> List[Dict]:
        """Find D3 windows by title list. Returns list with hwnd."""
        return WindowFinder.find_windows_by_titles(
            titles=self._window_titles,
            match_mode="in",
            use_cache=True,
            skip_browser_if=self._skip_browser,
        )

    def find_windows(self, use_cache: bool = True) -> List[Dict[str, Any]]:
        """Find D3 windows: by exe when get_path() is set, else by title. Returns list of window dicts."""
        if self.get_path():
            windows = self._find_windows_by_exe()
            if windows:
                return windows
        return self._find_windows_by_title()

    def is_running(self) -> bool:
        """Return True if at least one D3 window exists."""
        return len(self.find_windows()) > 0

    def kill_if_running(self) -> bool:
        """
        If D3 window(s) found, kill process(es) by PID of those windows (use actual found, not exe name).
        Returns True if killed or not running; False on error.
        """
        windows = self.find_windows()
        if not windows:
            return True
        pids: Set[int] = set()
        for w in windows:
            hwnd = w.get("hwnd")
            if not hwnd:
                continue
            pid = get_pid_from_hwnd(hwnd)
            if pid:
                pids.add(pid)
        if not pids:
            ColorPrint.yellow("[D3Manager] D3 window found but could not get PID")
            return False
        ColorPrint.blue(f"[D3Manager] D3 window(s) found, killing {len(pids)} process(es) by PID...")
        ok = True
        for pid in pids:
            if not kill_process_by_pid(pid, log_prefix="[D3Manager]"):
                ok = False
        return ok

    def prime_window_cache_for_capture(self) -> bool:
        """Find window (exe or title) and prime ENCYCLOPEDIA for provider/analyzer. Returns True if found."""
        windows = self.find_windows()
        if not windows:
            return False
        w = windows[0]
        rect = w.get("rect") or (0, 0, w.get("width", 0), w.get("height", 0))
        if isinstance(rect, (list, tuple)) and len(rect) >= 4:
            left, top, right, bottom = rect[0], rect[1], rect[2], rect[3]
        else:
            left, top = 0, 0
            right = left + (w.get("width") or 0)
            bottom = top + (w.get("height") or 0)
        canonical = (self._window_titles[0].lower() if self._window_titles else "d3")
        cache_key = "window_cache_%s" % canonical
        ENCYCLOPEDIA.add(cache_key, {
            "hwnd": w["hwnd"],
            "title": w.get("title") or (self._window_titles[0] if self._window_titles else (DIABLO_III_WINDOW_TITLES[0] if DIABLO_III_WINDOW_TITLES else "Diablo III")),
            "rect": (left, top, right, bottom),
            "left": left, "top": top, "right": right, "bottom": bottom,
            "width": right - left, "height": bottom - top,
            "class_name": w.get("class_name") or "",
        })
        return True

    def get_capture_titles(self) -> List[str]:
        """Single source for titles passed to provider/analyzer after prime. Same as DIABLO_III_WINDOW_TITLES."""
        return list(self._window_titles)


_d3_manager: Optional[D3Manager] = None


def get_d3_manager(window_titles=None, exe_name=None) -> D3Manager:
    """Return global D3Manager instance (singleton). Injects providor/constants if not provided."""
    global _d3_manager
    if _d3_manager is None:
        if window_titles is None or exe_name is None:
            window_titles = window_titles or DIABLO_III_WINDOW_TITLES
            exe_name = exe_name or DIABLO_III_EXE_NAME
        _d3_manager = D3Manager(window_titles, exe_name)
    return _d3_manager
