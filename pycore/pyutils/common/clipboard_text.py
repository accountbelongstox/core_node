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
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.desktop_session import current_desktop_session
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import run_args
from pycore.pyfoundations.third_party.api import get_third_package_pyperclip


SELECTION_CLIPBOARD = "clipboard"
SELECTION_PRIMARY = "primary"
CLIPBOARD_COMMAND_TIMEOUT_SECONDS = 3
# Writers offer text only: wl-copy would otherwise sniff the MIME type from the
# content; xclip/xsel default to the text targets; Win32 empties every format
# (images included) before setting CF_UNICODETEXT.
TEXT_PLAIN_MIME = "text/plain;charset=utf-8"
GMEM_MOVEABLE = 0x0002
CF_UNICODETEXT = 13
IS_WINDOWS = sys.platform.startswith("win")
IS_LINUX = sys.platform.startswith("linux")
POWERSHELL_UTF8_INPUT = "[Console]::InputEncoding = [Text.UTF8Encoding]::new($false); "
POWERSHELL_UTF8_OUTPUT = "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); "
# Private DLL handles with explicit 64-bit-safe prototypes (HGLOBAL/HANDLE are
# pointers; the ctypes default int restype truncates them on 64-bit Windows).
KERNEL32 = ctypes.WinDLL("kernel32", use_last_error=True) if IS_WINDOWS else None
USER32 = ctypes.WinDLL("user32", use_last_error=True) if IS_WINDOWS else None
WINAPI_PROTOTYPES = (
    (KERNEL32, "GlobalAlloc", [ctypes.c_uint, ctypes.c_size_t], ctypes.c_void_p),
    (KERNEL32, "GlobalLock", [ctypes.c_void_p], ctypes.c_void_p),
    (KERNEL32, "GlobalUnlock", [ctypes.c_void_p], ctypes.c_int),
    (KERNEL32, "GlobalFree", [ctypes.c_void_p], ctypes.c_void_p),
    (USER32, "OpenClipboard", [ctypes.c_void_p], ctypes.c_int),
    (USER32, "EmptyClipboard", [], ctypes.c_int),
    (USER32, "SetClipboardData", [ctypes.c_uint, ctypes.c_void_p], ctypes.c_void_p),
    (USER32, "CloseClipboard", [], ctypes.c_int),
    (USER32, "EnumClipboardFormats", [ctypes.c_uint], ctypes.c_uint),
)

if IS_WINDOWS:
    for _library, _name, _argtypes, _restype in WINAPI_PROTOTYPES:
        getattr(_library, _name).argtypes = _argtypes
        getattr(_library, _name).restype = _restype


def _set_with_winapi(text: str, _selection: str) -> bool:
    if not IS_WINDOWS:
        return False
    kernel32 = KERNEL32
    user32 = USER32
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
    if not user32.EmptyClipboard():
        user32.CloseClipboard()
        kernel32.GlobalFree(handle)
        return False
    if not user32.SetClipboardData(CF_UNICODETEXT, handle):
        user32.CloseClipboard()
        kernel32.GlobalFree(handle)
        return False
    user32.CloseClipboard()
    return True


def _set_with_powershell(text: str, _selection: str) -> bool:
    if not IS_WINDOWS:
        return False
    script = POWERSHELL_UTF8_INPUT + "Set-Clipboard -Value ([Console]::In.ReadToEnd())"
    return run_args(
        ["powershell", "-NoProfile", "-Command", script],
        input_text=text,
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
    ).success


def _get_with_powershell(_selection: str) -> Optional[str]:
    if not IS_WINDOWS:
        return None
    result = run_args(
        ["powershell", "-NoProfile", "-Command", POWERSHELL_UTF8_OUTPUT + "Get-Clipboard -Raw"],
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
        ["wl-copy", "--type", TEXT_PLAIN_MIME, *_wl_selection_args(selection)],
        input_text=text,
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
        detach_output=True,
    ).success


def _get_with_wl_paste(selection: str) -> Optional[str]:
    if not _linux_wayland_only():
        return None
    result = run_args(
        ["wl-paste", "--no-newline", "--type", "text", *_wl_selection_args(selection)],
        timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
    )
    return result.stdout if result.success else None


def _set_with_pyperclip(text: str, selection: str) -> bool:
    pyperclip = get_third_package_pyperclip()
    if pyperclip is None or selection != SELECTION_CLIPBOARD:
        return False
    try:
        pyperclip.copy(text)
    except pyperclip.PyperclipException as exc:
        ColorPrint.yellow(f"[ClipboardText] pyperclip copy failed: {exc}")
        return False
    return True


def _get_with_pyperclip(selection: str) -> Optional[str]:
    pyperclip = get_third_package_pyperclip()
    if pyperclip is None or selection != SELECTION_CLIPBOARD:
        return None
    try:
        return pyperclip.paste()
    except pyperclip.PyperclipException as exc:
        ColorPrint.yellow(f"[ClipboardText] pyperclip paste failed: {exc}")
        return None


CLIPBOARD_KIND_TEXT = "text"
CLIPBOARD_KIND_IMAGE = "image"
CLIPBOARD_KIND_FILES = "files"
CLIPBOARD_KIND_EMPTY = "empty"
CLIPBOARD_KIND_UNKNOWN = "unknown"
# Win32 standard formats: CF_TEXT, CF_BITMAP, CF_OEMTEXT, CF_DIB, CF_HDROP, CF_UNICODETEXT, CF_DIBV5
WIN32_FORMAT_NAMES = {1: "CF_TEXT", 2: "CF_BITMAP", 7: "CF_OEMTEXT", 8: "CF_DIB", 15: "CF_HDROP", 13: "CF_UNICODETEXT", 17: "CF_DIBV5"}
WIN32_TEXT_FORMATS = frozenset({1, 7, 13})
WIN32_IMAGE_FORMATS = frozenset({2, 8, 17})
WIN32_FILE_FORMATS = frozenset({15})
POSIX_FILE_TARGETS = ("text/uri-list", "x-special/gnome-copied-files")
POSIX_TEXT_TARGETS = ("UTF8_STRING", "STRING", "TEXT", "text/plain")


def _win32_formats() -> Optional[List[int]]:
    if not IS_WINDOWS or not USER32.OpenClipboard(None):
        return None
    formats = []
    current = USER32.EnumClipboardFormats(0)
    while current:
        formats.append(int(current))
        current = USER32.EnumClipboardFormats(current)
    USER32.CloseClipboard()
    return formats


def _posix_targets() -> Optional[List[str]]:
    if _linux_x11_ready():
        result = run_args(["xclip", "-selection", SELECTION_CLIPBOARD, "-t", "TARGETS", "-o"],
                          timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS)
    elif _linux_wayland_only():
        result = run_args(["wl-paste", "--list-types"], timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS)
    else:
        return None
    if not result.success:
        return [] if "nothing is copied" in (result.stderr or "").lower() or not result.stderr else None
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def get_clipboard_kind() -> Dict[str, Any]:
    """Classify the current clipboard: {type: text|image|files|empty|unknown, formats: [...]}."""
    if IS_WINDOWS:
        codes = _win32_formats()
        if codes is None:
            return {"type": CLIPBOARD_KIND_UNKNOWN, "formats": []}
        names = [WIN32_FORMAT_NAMES.get(code, str(code)) for code in codes]
        code_set = set(codes)
        if not codes:
            kind = CLIPBOARD_KIND_EMPTY
        elif code_set & WIN32_FILE_FORMATS:
            kind = CLIPBOARD_KIND_FILES
        elif code_set & WIN32_IMAGE_FORMATS and not code_set & WIN32_TEXT_FORMATS:
            kind = CLIPBOARD_KIND_IMAGE
        elif code_set & WIN32_TEXT_FORMATS:
            kind = CLIPBOARD_KIND_TEXT
        else:
            kind = CLIPBOARD_KIND_UNKNOWN
        return {"type": kind, "formats": names}
    targets = _posix_targets()
    if targets is None:
        return {"type": CLIPBOARD_KIND_UNKNOWN, "formats": []}
    if not targets:
        kind = CLIPBOARD_KIND_EMPTY
    elif any(target in POSIX_FILE_TARGETS for target in targets):
        kind = CLIPBOARD_KIND_FILES
    elif any(target.startswith("image/") for target in targets) and not any(
        target in POSIX_TEXT_TARGETS or target.startswith("text/plain") for target in targets
    ):
        kind = CLIPBOARD_KIND_IMAGE
    elif any(target in POSIX_TEXT_TARGETS or target.startswith("text/plain") for target in targets):
        kind = CLIPBOARD_KIND_TEXT
    else:
        kind = CLIPBOARD_KIND_UNKNOWN
    return {"type": kind, "formats": targets}


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


def get_clipboard_text(primary: bool = False) -> Optional[str]:
    """Return the clipboard (or, on Linux, PRIMARY) text, or None if no backend can read it."""
    if primary and not IS_LINUX:
        return None
    selection = SELECTION_PRIMARY if primary else SELECTION_CLIPBOARD
    for reader in READERS:
        value = reader(selection)
        if value is not None:
            return value
    return None


__all__ = [
    "get_clipboard_kind",
    "get_clipboard_text",
    "set_clipboard_text",
]
