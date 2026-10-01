#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Activator
Handles window activation and focus management
"""

import time
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.third_party.api import get_third_package_win32gui, get_third_package_win32con

win32gui = get_third_package_win32gui()
win32con = get_third_package_win32con()

WINDOW_CACHE_KEY_PREFIX = "window_cache_"
LOG_INTERVAL = "5min"
ACTIVATION_SETTLE_SECONDS = 0.5
MATCH_MODES: Dict[str, Callable[[str, str], bool]] = {
    "exact": lambda title, target: title == target,
    "startwith": lambda title, target: title.startswith(target),
    "include": lambda title, target: target.lower() in title.lower(),
    "endwith": lambda title, target: title.endswith(target),
}
NOT_FOUND_WINDOW_INFO = {
    "found": False,
    "hwnd": None,
    "title": None,
    "x": None,
    "y": None,
    "width": None,
    "height": None,
    "left": None,
    "top": None,
    "right": None,
    "bottom": None,
    "class_name": None,
    "source": None,
}


def _win32_error() -> type:
    return win32gui.error if win32gui is not None else OSError


def _log(message: str, color: str) -> None:
    ColorPrint.print_min_interval(message, LOG_INTERVAL, color)


def _cache_key(title: str) -> str:
    return f"{WINDOW_CACHE_KEY_PREFIX}{title.lower()}"


def _window_record(hwnd: int, title: str) -> Dict[str, Any]:
    rect = win32gui.GetWindowRect(hwnd)
    return {
        "hwnd": hwnd,
        "title": title,
        "rect": rect,
        "left": rect[0],
        "top": rect[1],
        "right": rect[2],
        "bottom": rect[3],
        "width": rect[2] - rect[0],
        "height": rect[3] - rect[1],
        "class_name": win32gui.GetClassName(hwnd),
    }


def _valid_cached_window(title: str) -> Optional[Dict[str, Any]]:
    cached_info = ENCYCLOPEDIA.get(_cache_key(title))
    if not cached_info:
        return None
    hwnd = cached_info.get("hwnd")
    if hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd):
        return cached_info
    _log(f"[CACHE] Cached window invalid for '{title}'", "yellow")
    return None


def _find_visible_window(predicate: Callable[[str], Optional[str]]) -> Optional[tuple]:
    """First visible titled window for which ``predicate(title)`` returns a cache name: (hwnd, title, name)."""
    found: List[tuple] = []

    def enum_windows_callback(hwnd, _lparam):
        if not win32gui.IsWindowVisible(hwnd):
            return True
        window_title = win32gui.GetWindowText(hwnd)
        name = predicate(window_title) if window_title else None
        if name is None:
            return True
        found.append((hwnd, window_title, name))
        return False

    try:
        win32gui.EnumWindows(enum_windows_callback, None)
    except _win32_error() as exc:
        # EnumWindows reports an error when the callback stops enumeration early.
        if not found:
            _log(f"[ERROR] EnumWindows failed: {exc}", "red")
    return found[0] if found else None


class WindowActivator:
    """Activates and manages window focus"""

    def activate_window_by_title(self, window_title: str) -> bool:
        """Activate the window whose title equals ``window_title``."""
        hwnd = win32gui.FindWindow(None, window_title)
        if not hwnd:
            _log(f"[WARN] Window not found: {window_title}", "yellow")
            return False
        return self.activate_window_by_handle(hwnd)

    def activate_window_by_partial_title(self, partial_title: str, use_cache: bool = True) -> bool:
        """Activate the first visible window whose title contains ``partial_title`` (cache first)."""
        window_info = _valid_cached_window(partial_title) if use_cache else None
        if window_info is None:
            needle = partial_title.lower()
            match = _find_visible_window(lambda title: partial_title if needle in title.lower() else None)
            if match is None:
                _log(f"[WARN] No window found with partial title: {partial_title}", "yellow")
                return False
            hwnd, window_title, _name = match
            window_info = {"hwnd": hwnd, "title": window_title}
        else:
            _log(f"[CACHE] Using cached window: '{window_info.get('title')}' (Handle: {window_info['hwnd']})", "green")

        hwnd = window_info["hwnd"]
        result = self.activate_window_by_handle(hwnd)
        if result:
            # Refresh the cached position after activation (the window may have moved).
            try:
                ENCYCLOPEDIA.add(_cache_key(partial_title), _window_record(hwnd, window_info["title"]))
            except _win32_error() as exc:
                _log(f"[WARN] Error updating cached position for '{partial_title}': {exc}", "yellow")
        return result

    def activate_window_by_handle(self, hwnd: int) -> bool:
        """Restore (if minimized) and foreground the window; True when it became active."""
        if not win32gui.IsWindow(hwnd):
            _log(f"[ERROR] Invalid window handle: {hwnd}", "red")
            return False
        if not win32gui.IsWindowVisible(hwnd):
            _log(f"[WARN] Window is not visible (handle: {hwnd})", "yellow")
            return False

        if win32gui.IsIconic(hwnd):
            _log(f"[RESTORE] Restoring minimized window (handle: {hwnd})", "blue")
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            time.sleep(ACTIVATION_SETTLE_SECONDS)

        _log(f"[ACTIVATE] Activating window (handle: {hwnd})", "blue")
        try:
            win32gui.SetForegroundWindow(hwnd)
        except _win32_error() as exc:
            # Foreground lock held by another process; the window is visible, so clicks may still work.
            _log(f"[WARN] SetForegroundWindow failed (handle: {hwnd}): {exc}", "yellow")
            return True

        time.sleep(ACTIVATION_SETTLE_SECONDS)
        if win32gui.GetForegroundWindow() == hwnd:
            _log(f"[SUCCESS] Window activated (handle: {hwnd})", "green")
            return True
        _log(f"[WARN] Window activation may have failed (handle: {hwnd})", "yellow")
        return False

    def get_active_window_info(self) -> dict:
        """Handle, title, class and rect of the foreground window."""
        active_hwnd = win32gui.GetForegroundWindow()
        if not active_hwnd:
            return {"handle": None, "title": None, "class": None, "rect": None}
        try:
            record = _window_record(active_hwnd, win32gui.GetWindowText(active_hwnd))
        except _win32_error() as exc:
            _log(f"[ERROR] Error getting active window info hwnd={active_hwnd}: {exc}", "red")
            return {"handle": None, "title": None, "class": None, "rect": None}
        return {
            "handle": active_hwnd,
            "title": record["title"],
            "class": record["class_name"],
            "rect": record["rect"],
            "width": record["width"],
            "height": record["height"],
        }

    @staticmethod
    def _window_info_payload(record: Dict[str, Any], source: str) -> Dict[str, Any]:
        return {
            "found": True,
            "hwnd": record["hwnd"],
            "title": record["title"],
            "x": record["left"],
            "y": record["top"],
            "width": record["width"],
            "height": record["height"],
            "left": record["left"],
            "top": record["top"],
            "right": record["right"],
            "bottom": record["bottom"],
            "class_name": record["class_name"],
            "source": source,
        }

    def get_window_info(
        self,
        titles: list,
        search_process: bool = False,
        match_mode: str = "exact",
    ) -> dict:
        """
        Window information from the encyclopedia cache, or (search_process) from visible windows.

        match_mode: "exact", "startwith", "include" or "endwith".
        Returns found/hwnd/title/x/y/width/height/left/top/right/bottom/class_name/source.
        """
        _log(f"[GetWindowInfo] Searching for windows: {titles} (match={match_mode}, search_process={search_process})", "blue")

        for title in titles:
            cached_info = _valid_cached_window(title)
            if cached_info is None:
                continue
            try:
                record = _window_record(cached_info["hwnd"], cached_info.get("title"))
            except _win32_error() as exc:
                _log(f"[Cache] Error reading window rect for '{title}': {exc}", "yellow")
                continue
            _log(f"[Cache] Found valid cached window: '{record['title']}'", "green")
            return self._window_info_payload(record, "cache")

        if search_process:
            matcher = MATCH_MODES[match_mode]
            match = _find_visible_window(
                lambda window_title: next((target for target in titles if matcher(window_title, target)), None)
            )
            if match is not None:
                hwnd, window_title, target_title = match
                record = _window_record(hwnd, window_title)
                ENCYCLOPEDIA.add(_cache_key(target_title), record)
                _log(f"[Process] Found window: '{window_title}'", "green")
                return self._window_info_payload(record, "process")

        _log("[GetWindowInfo] No matching window found", "yellow")
        return dict(NOT_FOUND_WINDOW_INFO)

    def list_visible_windows(self) -> list:
        """All visible titled windows: handle/title/class/rect/width/height."""
        windows = []

        def enum_windows_callback(hwnd, _lparam):
            if win32gui.IsWindowVisible(hwnd):
                window_title = win32gui.GetWindowText(hwnd)
                if window_title:
                    record = _window_record(hwnd, window_title)
                    windows.append({
                        "handle": hwnd,
                        "title": window_title,
                        "class": record["class_name"],
                        "rect": record["rect"],
                        "width": record["width"],
                        "height": record["height"],
                    })
            return True

        try:
            win32gui.EnumWindows(enum_windows_callback, None)
        except _win32_error() as exc:
            _log(f"[ERROR] Error listing windows: {exc}", "red")
            return []
        return windows
