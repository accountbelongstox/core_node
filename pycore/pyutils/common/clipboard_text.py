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
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.desktop_session import current_desktop_session
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import run_args, run_args_bytes
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
    (USER32, "GetClipboardData", [ctypes.c_uint], ctypes.c_void_p),
    (USER32, "GetClipboardFormatNameW", [ctypes.c_uint, ctypes.c_wchar_p, ctypes.c_int], ctypes.c_int),
    (USER32, "RegisterClipboardFormatW", [ctypes.c_wchar_p], ctypes.c_uint),
    (KERNEL32, "GlobalSize", [ctypes.c_void_p], ctypes.c_size_t),
)
WIN32_OPEN_ATTEMPTS = 10
WIN32_OPEN_RETRY_SECONDS = 0.02
WIN32_FORMAT_NAME_MAX_CHARS = 256
WIN32_REGISTERED_FORMAT_FIRST = 0xC000
# Formats whose handle is a GDI object or NULL (CF_BITMAP, CF_METAFILEPICT,
# CF_PALETTE, CF_ENHMETAFILE, CF_OWNERDISPLAY, CF_DSP*) cannot be copied as
# memory; CF_BITMAP/CF_PALETTE are synthesized again from CF_DIB/CF_DIBV5.
WIN32_HANDLE_FORMATS = frozenset({2, 3, 9, 14, 0x80, 0x82, 0x83, 0x8E})
# CF_PRIVATEFIRST..CF_PRIVATELAST handles are owned by the source window.
WIN32_PRIVATE_FORMATS = range(0x200, 0x300)
# Live OLE references into the source process; meaningless once it lost ownership.
WIN32_OLE_LIVE_FORMAT_NAMES = frozenset({"DataObject", "Ole Private Data"})
# Synthesized siblings: only the first enumerated (the real) one is kept.
WIN32_SYNTHESIZED_GROUPS = (frozenset({1, 7, 13}), frozenset({8, 17}))
# Registered formats that keep an item out of Win+V history and cloud sync.
WIN32_HISTORY_EXCLUSION_FORMATS = (
    ("ExcludeClipboardContentFromMonitorProcessing", b"\0\0\0\0"),
    ("CanIncludeInClipboardHistory", b"\0\0\0\0"),
    ("CanUploadToCloudClipboard", b"\0\0\0\0"),
)
CLIPBOARD_SNAPSHOT_MAX_BYTES = 128 * 1024 * 1024

if IS_WINDOWS:
    for _library, _name, _argtypes, _restype in WINAPI_PROTOTYPES:
        getattr(_library, _name).argtypes = _argtypes
        getattr(_library, _name).restype = _restype


def _open_win32_clipboard() -> bool:
    for _attempt in range(WIN32_OPEN_ATTEMPTS):
        if USER32.OpenClipboard(None):
            return True
        time.sleep(WIN32_OPEN_RETRY_SECONDS)
    return False


def _win32_global(data: bytes) -> Optional[int]:
    handle = KERNEL32.GlobalAlloc(GMEM_MOVEABLE, max(len(data), 1))
    if not handle:
        return None
    locked = KERNEL32.GlobalLock(handle)
    if not locked:
        KERNEL32.GlobalFree(handle)
        return None
    ctypes.memmove(locked, data, len(data))
    KERNEL32.GlobalUnlock(handle)
    return handle


def _win32_format_id(format_id: int, name: str) -> int:
    return int(USER32.RegisterClipboardFormatW(name)) if name else format_id


def _win32_history_exclusion_entries() -> List[Tuple[int, str, bytes]]:
    return [(0, name, data) for name, data in WIN32_HISTORY_EXCLUSION_FORMATS]


def _win32_write(entries: List[Tuple[int, str, bytes]]) -> bool:
    """Replace the clipboard with (format_id, registered_name, data) items; an empty list empties it."""
    if not IS_WINDOWS or not _open_win32_clipboard():
        return False
    written = 0
    try:
        if not USER32.EmptyClipboard():
            return False
        for format_id, name, data in entries:
            target = _win32_format_id(format_id, name)
            handle = _win32_global(data) if target else None
            if handle is None:
                continue
            if USER32.SetClipboardData(target, handle):
                written += 1
            else:
                KERNEL32.GlobalFree(handle)
    finally:
        USER32.CloseClipboard()
    return written > 0 or not entries


def _win32_text_entries(text: str, transient: bool) -> List[Tuple[int, str, bytes]]:
    entries = [(CF_UNICODETEXT, "", text.encode("utf-16-le") + b"\0\0")]
    return entries + _win32_history_exclusion_entries() if transient else entries


def _set_with_winapi(text: str, _selection: str, transient: bool = False) -> bool:
    return IS_WINDOWS and _win32_write(_win32_text_entries(text, transient))


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
    if not IS_WINDOWS or not _open_win32_clipboard():
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


def _write_selection(text: str, selection: str, transient: bool = False) -> bool:
    if transient and _set_with_winapi(text, selection, transient):
        return True
    return any(writer(text, selection) for writer in WRITERS)


def set_clipboard_text(text: str, include_primary: bool = False, transient: bool = False) -> bool:
    """Set the clipboard (and, on Linux, optionally PRIMARY) to text.

    transient=True keeps the item out of the Windows clipboard history and cloud sync.
    """
    written = _write_selection(text, SELECTION_CLIPBOARD, transient)
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


POSIX_META_TARGETS = frozenset({"TARGETS", "MULTIPLE", "TIMESTAMP", "SAVE_TARGETS", "DELETE", "INSERT_PROPERTY",
                                "INSERT_SELECTION"})
POSIX_IMAGE_PREFERENCE = ("image/png",)
POSIX_FILE_PREFERENCE = ("x-special/gnome-copied-files", "text/uri-list")


@dataclass(frozen=True)
class ClipboardSnapshot:
    """Every restorable format of the clipboard at one moment.

    items are (win32 format id, registered name or POSIX target, raw bytes).
    text holds the POSIX text kind, restored through the text writers.
    """
    kind: str
    items: Tuple[Tuple[int, str, bytes], ...] = ()
    text: Optional[str] = None


def _win32_format_name(format_id: int) -> str:
    if format_id < WIN32_REGISTERED_FORMAT_FIRST:
        return ""
    buffer = ctypes.create_unicode_buffer(WIN32_FORMAT_NAME_MAX_CHARS)
    length = USER32.GetClipboardFormatNameW(format_id, buffer, WIN32_FORMAT_NAME_MAX_CHARS)
    return buffer.value[:length] if length > 0 else ""


def _win32_read_handle(handle: int) -> Optional[bytes]:
    size = int(KERNEL32.GlobalSize(handle) or 0)
    if size <= 0:
        return None
    locked = KERNEL32.GlobalLock(handle)
    if not locked:
        return None
    try:
        return ctypes.string_at(locked, size)
    finally:
        KERNEL32.GlobalUnlock(handle)


def _win32_snapshot() -> Optional[ClipboardSnapshot]:
    kind = get_clipboard_kind()
    if kind["type"] == CLIPBOARD_KIND_UNKNOWN and not kind["formats"]:
        return None
    if not _open_win32_clipboard():
        return None
    items: List[Tuple[int, str, bytes]] = []
    total = 0
    claimed_groups = set()
    try:
        format_id = USER32.EnumClipboardFormats(0)
        while format_id:
            current = int(format_id)
            format_id = USER32.EnumClipboardFormats(current)
            if current in WIN32_HANDLE_FORMATS or current in WIN32_PRIVATE_FORMATS:
                continue
            group = next((index for index, members in enumerate(WIN32_SYNTHESIZED_GROUPS) if current in members), None)
            if group is not None:
                if group in claimed_groups:
                    continue
                claimed_groups.add(group)
            name = _win32_format_name(current)
            if current >= WIN32_REGISTERED_FORMAT_FIRST and (not name or name in WIN32_OLE_LIVE_FORMAT_NAMES):
                continue
            handle = USER32.GetClipboardData(current)
            data = _win32_read_handle(handle) if handle else None
            if data is None or total + len(data) > CLIPBOARD_SNAPSHOT_MAX_BYTES:
                continue
            total += len(data)
            items.append((current, name, data))
    finally:
        USER32.CloseClipboard()
    return ClipboardSnapshot(kind["type"], tuple(items))


def _posix_restore_target(kind: str, targets: List[str]) -> Optional[str]:
    candidates = [target for target in targets if target not in POSIX_META_TARGETS]
    preference = POSIX_FILE_PREFERENCE if kind == CLIPBOARD_KIND_FILES else POSIX_IMAGE_PREFERENCE
    for target in preference:
        if target in candidates:
            return target
    if kind == CLIPBOARD_KIND_IMAGE:
        return next((target for target in candidates if target.startswith("image/")), None)
    return candidates[0] if candidates else None


def _posix_read_target(target: str) -> Optional[bytes]:
    if _linux_x11_ready():
        command = ["xclip", "-selection", SELECTION_CLIPBOARD, "-t", target, "-o"]
    elif _linux_wayland_only():
        command = ["wl-paste", "--no-newline", "--type", target]
    else:
        return None
    success, data = run_args_bytes(command, timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS)
    return data if success else None


def _posix_write_target(target: str, data: bytes) -> bool:
    if _linux_x11_ready():
        command = ["xclip", "-selection", SELECTION_CLIPBOARD, "-t", target, "-in"]
    elif _linux_wayland_only():
        command = ["wl-copy", "--type", target]
    else:
        return False
    success, _output = run_args_bytes(command, data, CLIPBOARD_COMMAND_TIMEOUT_SECONDS, detach_output=True)
    return success


def _posix_snapshot() -> Optional[ClipboardSnapshot]:
    kind = get_clipboard_kind()
    if kind["type"] == CLIPBOARD_KIND_EMPTY:
        return ClipboardSnapshot(CLIPBOARD_KIND_EMPTY)
    if kind["type"] == CLIPBOARD_KIND_TEXT:
        text = get_clipboard_text()
        return ClipboardSnapshot(CLIPBOARD_KIND_TEXT, text=text) if text is not None else None
    target = _posix_restore_target(kind["type"], kind["formats"])
    data = _posix_read_target(target) if target else None
    if data is None or len(data) > CLIPBOARD_SNAPSHOT_MAX_BYTES:
        return None
    return ClipboardSnapshot(kind["type"], ((0, target, data),))


def snapshot_clipboard() -> Optional[ClipboardSnapshot]:
    """Capture the clipboard in every restorable format (text, images, files, rich text).

    None means the clipboard could not be read; callers then leave it alone.
    """
    if IS_WINDOWS:
        return _win32_snapshot()
    if IS_LINUX:
        return _posix_snapshot()
    text = get_clipboard_text()
    return ClipboardSnapshot(CLIPBOARD_KIND_TEXT, text=text) if text is not None else None


def restore_clipboard(snapshot: ClipboardSnapshot) -> bool:
    """Put a snapshot back; the restored item stays out of the Windows clipboard history."""
    if IS_WINDOWS and snapshot.text is None:
        entries = list(snapshot.items)
        return _win32_write(entries + _win32_history_exclusion_entries() if entries else entries)
    if snapshot.text is not None:
        return set_clipboard_text(snapshot.text, transient=True)
    if snapshot.kind == CLIPBOARD_KIND_EMPTY:
        if _linux_wayland_only():
            return run_args(["wl-copy", "--clear"], timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
                            detach_output=True).success
        return set_clipboard_text("")
    return all(_posix_write_target(target, data) for _format_id, target, data in snapshot.items)


__all__ = [
    "ClipboardSnapshot",
    "get_clipboard_kind",
    "get_clipboard_text",
    "restore_clipboard",
    "set_clipboard_text",
    "snapshot_clipboard",
]
