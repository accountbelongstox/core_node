# -*- coding: utf-8 -*-
"""Show overrideredirect Tk roots in the Windows taskbar and set AppUserModelID."""

import ctypes
import sys

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.window.win32_window_constants import (
    GWL_EXSTYLE,
    GWLP_HWNDPARENT,
    HWND_TOP,
    SWP_FRAMECHANGED,
    SWP_NOMOVE,
    SWP_NOSIZE,
    SWP_NOZORDER,
    WS_EX_APPWINDOW,
    WS_EX_TOOLWINDOW,
)

EX_STYLE_MASK = 0xFFFFFFFF


def set_windows_app_user_model_id(app_id: str) -> bool:
    """Set the process AppUserModelID (taskbar grouping); Windows only."""
    if sys.platform != "win32":
        return False
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(app_id)
    except OSError as exc:
        ColorPrint.yellow(f"[TkTaskbar] SetCurrentProcessExplicitAppUserModelID failed app_id={app_id}: {exc}")
        return False
    return True


def ensure_tk_root_in_taskbar(root) -> bool:
    """Swap WS_EX_TOOLWINDOW for WS_EX_APPWINDOW, clear the owner and refresh the frame.

    Call after the window is realized (e.g. deferred via root.after).
    """
    if sys.platform != "win32":
        return False
    root.update_idletasks()
    hwnd = ctypes.c_void_p(root.winfo_id())
    if not hwnd.value:
        return False
    user32 = ctypes.windll.user32
    try:
        ex_style = int(user32.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)) & EX_STYLE_MASK
        new_style = (ex_style & ~WS_EX_TOOLWINDOW) | WS_EX_APPWINDOW
        if new_style != ex_style:
            user32.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style)
        user32.SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, 0)
        user32.SetWindowPos(
            hwnd, ctypes.c_void_p(HWND_TOP), 0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
        )
    except OSError as exc:
        ColorPrint.yellow(f"[TkTaskbar] taskbar style update failed hwnd={hwnd.value}: {exc}")
        return False
    return True
