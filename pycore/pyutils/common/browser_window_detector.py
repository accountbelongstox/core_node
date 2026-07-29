#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Browser Window Detector - Auxiliary detection by process exe

Determines if a window belongs to a browser (Chrome, Edge, Firefox, etc.)
by inspecting the process executable path, not by window title.
No app-specific hardcoding; only browser exe names are used.
"""

from typing import Optional, Callable

from pycore.pyfoundations.third_party.api import get_third_package_win32gui
from pycore.pyfoundations.third_party.api import get_third_package_psutil

win32gui = get_third_package_win32gui()
psutil = get_third_package_psutil()

try:
    import win32process
except ImportError:
    win32process = None

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


# Exe base names (lowercase) that indicate a browser process
BROWSER_EXE_NAMES = (
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "safari.exe",
    "opera.exe",
    "opera_gx.exe",
    "brave.exe",
    "browser.exe",  # generic
)


def get_process_exe_path(hwnd: int) -> Optional[str]:
    """
    Get the executable path of the process that owns the window.

    Args:
        hwnd: Window handle (HWND)

    Returns:
        Full path to the process exe, or None if unavailable
    """
    try:
        if not hwnd or not win32gui.IsWindow(hwnd):
            return None
        if win32process is None:
            return None
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        if not pid:
            return None
        proc = psutil.Process(pid)
        return proc.exe() or None
    except (psutil.NoSuchProcess, psutil.AccessDenied, OSError, Exception):
        return None


def is_browser_process_by_path(exe_path: Optional[str]) -> bool:
    """
    Check if the given exe path belongs to a known browser.

    Args:
        exe_path: Full path to executable (e.g. C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe)

    Returns:
        True if the exe name matches a known browser
    """
    if not exe_path or not exe_path.strip():
        return False
    name = exe_path.strip().replace("/", "\\").rsplit("\\", 1)[-1].lower()
    return name in BROWSER_EXE_NAMES


class BrowserWindowDetector:
    """
    Auxiliary detector: is a window owned by a browser process?

    Uses process exe path only (Chrome, Edge, Firefox, etc.).
    No title-based or app-specific logic.
    """

    def __init__(self):
        self._cache = {}  # hwnd -> bool, optional cache to avoid repeated psutil lookups

    def get_process_exe_path(self, hwnd: int) -> Optional[str]:
        """Get exe path for the window's process. Delegates to module-level function."""
        return get_process_exe_path(hwnd)

    def is_browser_process_by_path(self, exe_path: Optional[str]) -> bool:
        """Check if exe path is a known browser. Delegates to module-level function."""
        return is_browser_process_by_path(exe_path)

    def is_browser_window(self, hwnd: int) -> bool:
        """
        Return True if the window belongs to a browser process (Chrome, Edge, Firefox, etc.).

        Args:
            hwnd: Window handle

        Returns:
            True if the window's process exe is a known browser
        """
        exe_path = get_process_exe_path(hwnd)
        return is_browser_process_by_path(exe_path)

    def skip_browser_filter(self, hwnd: int, window_title: str) -> bool:
        """
        Callable for WindowFinder skip_browser_if: skip when window is a browser.

        Args:
            hwnd: Window handle
            window_title: Window title (unused; detection is by exe only)

        Returns:
            True if the window should be skipped (it is a browser window)
        """
        if self.is_browser_window(hwnd):
            ColorPrint.yellow(f"[BrowserWindowDetector] Skipping browser window (exe): '{window_title}'")
            return True
        return False


def get_default_skip_browser_callable() -> Callable[[int, str], bool]:
    """Return a callable suitable for WindowFinder skip_browser_if (exe-based detection)."""
    detector = BrowserWindowDetector()
    return detector.skip_browser_filter
