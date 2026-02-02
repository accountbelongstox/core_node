#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 (Diablo III) manager: check if running, kill if running (e.g. before Battle.net click).
Uses WindowFinder to find D3 windows (title/exe can vary), then kills by PID of the actual found window.
"""

from typing import List, Optional, Callable, Dict, Any, Set

from providor.app_constants import DIABLO_III_EXE_NAME
from providor.common_imports import ColorPrint
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.common.browser_window_detector import get_default_skip_browser_callable

from d3utils.process_helper import get_pid_from_hwnd, kill_process_by_pid


class D3Manager:
    """
    Diablo III process/window management.
    Find windows by title list (actual title may vary, e.g. localized); kill by PID of found window(s).
    """

    def __init__(
        self,
        window_titles: List[str],
        exe_name: str,
        skip_browser_callable: Optional[Callable[[Dict[str, Any]], bool]] = None,
    ):
        self._window_titles = window_titles
        self._exe_name = exe_name
        self._skip_browser = skip_browser_callable or get_default_skip_browser_callable()

    def _find_windows(self) -> List[Dict]:
        """Single source: find D3 windows (same logic as is_running, returns list with hwnd)."""
        return WindowFinder.find_windows_by_titles(
            titles=self._window_titles,
            match_mode="in",
            use_cache=True,
            skip_browser_if=self._skip_browser,
        )

    def is_running(self) -> bool:
        """Return True if at least one D3 window exists."""
        return len(self._find_windows()) > 0

    def kill_if_running(self) -> bool:
        """
        If D3 window(s) found, kill process(es) by PID of those windows (use actual found, not exe name).
        Returns True if killed or not running; False on error.
        """
        windows = self._find_windows()
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
