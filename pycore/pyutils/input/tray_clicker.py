#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""System tray icon clicker (Windows UI Automation via pywinauto)."""

import os
import time
from typing import Any, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_win32api, get_third_package_win32con, get_third_package_pywinauto

win32api = get_third_package_win32api()
win32con = get_third_package_win32con()
pywinauto = get_third_package_pywinauto()
TRAY_CLICKER_AVAILABLE = pywinauto is not None and win32api is not None

TRAY_WINDOW_CLASS_KEYWORDS = ('tray', 'notify', 'shell')
# Tray icons are about 32 px wide; a wider rectangle is treated as inaccurate.
TRAY_ICON_WIDTH = 32
TRAY_ICON_MAX_PLAUSIBLE_WIDTH = 100
CLICK_STEP_DELAY = 0.05


class TrayIconClicker:
    """Find a system tray icon by keyword and double-click it."""

    def __init__(self):
        self.desktop: Optional[Any] = None

    @staticmethod
    def _normalize_keyword(keyword: str) -> str:
        """Strip a path and file extension from a keyword such as 'C:/x/Battle.net.exe'."""
        if not keyword:
            return ""
        base = os.path.basename(keyword)
        stem, _ext = os.path.splitext(base)
        return (stem or base).strip()

    def _double_click(self, x: int, y: int) -> None:
        win32api.SetCursorPos((x, y))
        time.sleep(CLICK_STEP_DELAY)
        for _ in range(2):
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
            time.sleep(CLICK_STEP_DELAY)
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
            time.sleep(CLICK_STEP_DELAY)

    def _find_icons(self, keyword: str) -> List[Any]:
        if self.desktop is None:
            self.desktop = pywinauto.Desktop(backend="uia")
        needle = keyword.lower()
        found = []
        for window in self.desktop.windows():
            class_name = window.class_name()
            if not isinstance(class_name, str):
                continue
            if not any(word in class_name.lower() for word in TRAY_WINDOW_CLASS_KEYWORDS):
                continue
            for child in window.children():
                for icon in child.children():
                    title = icon.window_text()
                    icon_class = icon.class_name()
                    if isinstance(title, str) and isinstance(icon_class, str) and (
                        needle in title.lower() or needle in icon_class.lower()
                    ):
                        ColorPrint.plain(f"[TrayClicker] Found matching icon: '{title}' ({icon_class})")
                        found.append(icon)
        return found

    @staticmethod
    def _click_point(icon: Any) -> Tuple[int, int]:
        rect = icon.rectangle()
        width = rect.right - rect.left
        center_y = rect.top + (rect.bottom - rect.top) // 2
        if width > TRAY_ICON_MAX_PLAUSIBLE_WIDTH:
            return rect.left + TRAY_ICON_WIDTH // 2, center_y
        return rect.left + width // 2, center_y

    def click_tray_icon(self, keyword: str) -> bool:
        """Double-click the first tray icon whose title or class contains ``keyword``."""
        if not TRAY_CLICKER_AVAILABLE:
            ColorPrint.yellow("[TrayClicker] pywinauto/pywin32 unavailable on this platform")
            return False
        normalized_keyword = self._normalize_keyword(keyword)
        ColorPrint.plain(f"[TrayClicker] Searching for tray icon containing keyword: '{normalized_keyword}'")
        try:
            icons = self._find_icons(normalized_keyword)
        except Exception as exc:  # UIA/COM failures surface as assorted pywinauto/comtypes exception types
            ColorPrint.red(f"[TrayClicker] UI Automation enumeration failed keyword={normalized_keyword}: {exc}")
            return False
        if not icons:
            ColorPrint.plain(f"[TrayClicker] No tray icons found containing keyword: '{normalized_keyword}'")
            return False

        original_mouse_pos = win32api.GetCursorPos()
        try:
            x, y = self._click_point(icons[0])
            ColorPrint.plain(f"[TrayClicker] Double-clicking at ({x}, {y})")
            self._double_click(x, y)
        except Exception as exc:  # UIA rectangle / win32 input failures (pywintypes.error, COMError)
            ColorPrint.red(f"[TrayClicker] Double-click failed keyword={normalized_keyword}: {exc}")
            return False
        finally:
            win32api.SetCursorPos(original_mouse_pos)
        return True
