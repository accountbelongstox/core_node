# -*- coding: utf-8 -*-
"""
Tkinter taskbar helper (Windows).

When a Tk root uses overrideredirect(True), the window gets WS_EX_TOOLWINDOW
and does not appear in the taskbar. This module uses Win32 API to remove that
style so the window shows in the taskbar, and optionally sets AppUserModelID
for correct taskbar grouping.

Usage:
    root = tk.Tk()
    root.overrideredirect(True)
    # ... create UI ...
    from pycore.pyutils.desktop.tk_taskbar import ensure_tk_root_in_taskbar, set_windows_app_user_model_id
    set_windows_app_user_model_id("my.app.1.0")  # optional, call once per process
    ensure_tk_root_in_taskbar(root)
"""

import sys
from typing import Optional

from pycore.pyfoundations.third_party import get_third_package_win32gui, get_third_package_win32con

import ctypes



# GWL_EXSTYLE = -20, GWLP_HWNDPARENT = -8 (owner; 0 = unowned top-level)
# WS_EX_TOOLWINDOW: window does not appear in taskbar (MSDN)
# WS_EX_APPWINDOW: forces top-level window onto taskbar when visible (MSDN)
GWL_EXSTYLE = -20
GWLP_HWNDPARENT = -8
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_APPWINDOW = 0x00040000
SWP_NOMOVE = 0x0002
SWP_NOSIZE = 0x0001
SWP_NOZORDER = 0x0004
SWP_FRAMECHANGED = 0x0020
HWND_TOP = 0


def set_windows_app_user_model_id(app_id: str) -> bool:
    """
    Set Windows AppUserModelID for the current process (taskbar grouping).
    Call once at startup, before creating windows. Windows only.

    Args:
        app_id: e.g. "pycore.d3check.1.0"

    Returns:
        True if set successfully, False on non-Windows or on failure.
    """
    if sys.platform != "win32":
        return False
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(app_id)
        return True
    except Exception:
        return False


def _apply_taskbar_style_pywin32(hwnd: int) -> bool:
    """Use pywin32 to set ex-style and owner. Returns True if applied."""
    try:
        win32gui = get_third_package_win32gui()
        win32con = get_third_package_win32con()
        if not win32gui or not win32con:
            return False
        ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
        ex_style = int(ex_style) & 0xFFFFFFFF
        new_style = (ex_style & (~WS_EX_TOOLWINDOW)) | WS_EX_APPWINDOW
        if new_style != ex_style:
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, new_style)
        try:
            gwlp_parent = getattr(win32con, "GWLP_HWNDPARENT", getattr(win32con, "GWL_HWNDPARENT", -8))
            win32gui.SetWindowLong(hwnd, gwlp_parent, 0)
        except Exception:
            pass
        swp_framechanged = getattr(win32con, "SWP_FRAMECHANGED", 0x0020)
        flags = win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_NOZORDER | swp_framechanged
        win32gui.SetWindowPos(hwnd, win32con.HWND_TOP, 0, 0, 0, 0, flags)
        return True
    except Exception:
        return False


def _apply_taskbar_style_ctypes(hwnd: int) -> bool:
    """Use ctypes to set ex-style and owner. Returns True if applied."""
    try:
        user32 = ctypes.windll.user32
        ex_style = user32.GetWindowLongPtrW(ctypes.c_void_p(hwnd), GWL_EXSTYLE)
        if ex_style is None:
            return False
        ex_style = int(ex_style) & 0xFFFFFFFF
        new_style = (ex_style & (~WS_EX_TOOLWINDOW)) | WS_EX_APPWINDOW
        if new_style != ex_style:
            user32.SetWindowLongPtrW(ctypes.c_void_p(hwnd), GWL_EXSTYLE, new_style)
        try:
            user32.SetWindowLongPtrW(ctypes.c_void_p(hwnd), GWLP_HWNDPARENT, 0)
        except Exception:
            pass
        flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED
        user32.SetWindowPos(ctypes.c_void_p(hwnd), ctypes.c_void_p(HWND_TOP), 0, 0, 0, 0, flags)
        return True
    except Exception:
        return False


def ensure_tk_root_in_taskbar(root) -> bool:
    """
    Make a Tk root window appear in the Windows taskbar when it uses
    overrideredirect(True). Removes WS_EX_TOOLWINDOW, adds WS_EX_APPWINDOW,
    sets owner to NULL, then SetWindowPos(SWP_FRAMECHANGED). Prefers pywin32.

    Call after the window is realized or mapped (e.g. deferred via root.after).
    """
    if sys.platform != "win32":
        return False
    try:
        root.update_idletasks()
        hwnd = root.winfo_id()
        if not hwnd:
            return False
        if _apply_taskbar_style_pywin32(hwnd):
            return True
        return _apply_taskbar_style_ctypes(hwnd)
    except Exception:
        return False
