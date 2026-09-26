# -*- coding: utf-8 -*-
"""
Single system clipboard text primitive shared by every pyutils domain.

Windows: Win32 API, then pyperclip, then PowerShell.
Linux: xclip / xsel when an X11 or Xwayland display exists (mutter bridges X11
and Wayland selections), wl-clipboard on pure Wayland, then pyperclip.
Linux can also own the PRIMARY selection, which Shift+Insert pastes in
xterm-family terminals.
"""
from __future__ import annotations

import ctypes
import sys
from typing import Callable, List, Optional, Tuple

from pycore.pyfoundations.desktop_session import current_desktop_session
from pycore.pyfoundations.pybasecommon.commander import run_args
from pycore.pyfoundations.third_party.api import get_third_package_pyperclip

pyperclip = get_third_package_pyperclip()

SELECTION_CLIPBOARD = "clipboard"
SELECTION_PRIMARY = "primary"
CLIPBOARD_COMMAND_TIMEOUT_SECONDS = 3
GMEM_MOVEABLE = 0x0002
CF_UNICODETEXT = 13
IS_WINDOWS = sys.platform.startswith("win")
IS_LINUX = sys.platform.startswith("linux")


def _set_with_winapi(text: str, _selection: str) -> bool:
    if not IS_WINDOWS:
        return False
    kernel32 = ctypes.windll.kernel32
    user32 = ctypes.windll.user32
    buffer = ctypes.create_unicode_buffer(text)
    size = ctypes.sizeof(buffer)
    handle = kernel32.GlobalAlloc(GMEM_MOVEABLE, size)
    if not handle:
        return False
    locked = kernel32.GlobalLock(handle)
    if not locked:
        kernel32.GlobalFree(handle)
        return False
    ctypes.memmove(locked, ctypes.addressof(buffer), size)
    kernel32.GlobalUnlock(handle)
    if not user32.OpenClipboard(None):
        kernel32.GlobalFree(handle)
        return False
    user32.EmptyClipboard()
    if not user32.SetClipboardData(CF_UNICODETEXT, handle):
        user32.CloseClipboard()
        kernel32.GlobalFree(handle)
        return False
    user32.CloseClipboard()
    return True


def _set_with_powershell(text: str, _selection: str) -> bool:
    if not IS_WINDOWS:
        return False
    script = "Set-Clipboard -Value ([Console]::In.ReadToEnd())"
    return run_args(
        ["powershell", "-NoProfile", "-Command", script],
        input_text=text,
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
    ).success


def _get_with_powershell(_selection: str) -> Optional[str]:
    if not IS_WINDOWS:
        return None
    result = run_args(
        ["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"],
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
    )
    return result.stdout if result.success else None


def _linux_x11_ready() -> bool:
    return IS_LINUX and current_desktop_session().has_x11_display


def _linux_wayland_only() -> bool:
    session = current_desktop_session()
    return IS_LINUX and session.is_wayland and not session.has_x11_display


def _set_with_xclip(text: str, selection: str) -> bool:
    if not _linux_x11_ready():
        return False
    return run_args(
        ["xclip", "-selection", selection, "-in"],
        input_text=text,
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
        detach_output=True,
    ).success


def _get_with_xclip(selection: str) -> Optional[str]:
    if not _linux_x11_ready():
        return None
    result = run_args(
        ["xclip", "-selection", selection, "-out"],
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
    )
    return result.stdout if result.success else None


def _set_with_xsel(text: str, selection: str) -> bool:
    if not _linux_x11_ready():
        return False
    return run_args(
        ["xsel", f"--{selection}", "--input"],
        input_text=text,
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
        detach_output=True,
    ).success


def _get_with_xsel(selection: str) -> Optional[str]:
    if not _linux_x11_ready():
        return None
    result = run_args(
        ["xsel", f"--{selection}", "--output"],
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
    )
    return result.stdout if result.success else None


def _wl_selection_args(selection: str) -> List[str]:
    return ["--primary"] if selection == SELECTION_PRIMARY else []


def _set_with_wl_copy(text: str, selection: str) -> bool:
    if not _linux_wayland_only():
        return False
    return run_args(
        ["wl-copy", *_wl_selection_args(selection)],
        input_text=text,
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
        detach_output=True,
    ).success


def _get_with_wl_paste(selection: str) -> Optional[str]:
    if not _linux_wayland_only():
        return None
    result = run_args(
        ["wl-paste", "--no-newline", *_wl_selection_args(selection)],
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
    )
    return result.stdout if result.success else None


def _set_with_pyperclip(text: str, selection: str) -> bool:
    if pyperclip is None or selection != SELECTION_CLIPBOARD:
        return False
    try:
        pyperclip.copy(text)
    except pyperclip.PyperclipException:
        return False
    return True


def _get_with_pyperclip(selection: str) -> Optional[str]:
    if pyperclip is None or selection != SELECTION_CLIPBOARD:
        return None
    try:
        return pyperclip.paste()
    except pyperclip.PyperclipException:
        return None


WRITERS: Tuple[Callable[[str, str], bool], ...] = (
    _set_with_winapi,
    _set_with_xclip,
    _set_with_xsel,
    _set_with_wl_copy,
    _set_with_pyperclip,
    _set_with_powershell,
)
READERS: Tuple[Callable[[str], Optional[str]], ...] = (
    _get_with_xclip,
    _get_with_xsel,
    _get_with_wl_paste,
    _get_with_pyperclip,
    _get_with_powershell,
)


def _write_selection(text: str, selection: str) -> bool:
    return any(writer(text, selection) for writer in WRITERS)


def set_clipboard_text(text: str, include_primary: bool = False) -> bool:
    """Set the clipboard (and, on Linux, optionally PRIMARY) to text."""
    written = _write_selection(text, SELECTION_CLIPBOARD)
    if written and include_primary and IS_LINUX:
        return _write_selection(text, SELECTION_PRIMARY)
    return written


def get_clipboard_text() -> Optional[str]:
    """Return the current clipboard text, or None if no backend can read it."""
    for reader in READERS:
        value = reader(SELECTION_CLIPBOARD)
        if value is not None:
            return value
    return None


__all__ = [
    "get_clipboard_text",
    "set_clipboard_text",
]
