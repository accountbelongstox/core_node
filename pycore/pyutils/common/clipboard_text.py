# -*- coding: utf-8 -*-
"""
Generic clipboard text primitive (shared base).

Get/set the system clipboard as plain text with graceful fallbacks:
pyperclip -> tkinter -> platform CLI (Windows clip / PowerShell Get-Clipboard).
No app- or domain-specific dependencies, so any pyutils package may use it
(e.g. input.field_input pastes Unicode via the clipboard). The richer
clipboard domain package (history / monitor / sync) lives separately in
pyutils/clipboard and is NOT a dependency of this primitive.
"""
from __future__ import annotations

import shutil
import sys
from typing import Optional

from pycore.pyfoundations.pybasecommon.commander import exec_silent
from pycore.pyfoundations.third_party.api import get_third_package_pyperclip
from pycore.pyfoundations.third_party.api import get_third_package_tkinter

pyperclip = get_third_package_pyperclip()
tk = get_third_package_tkinter()


def _set_with_pyperclip(text: str) -> bool:
    if pyperclip is None:
        return False
    try:
        pyperclip.copy(text)
        return True
    except Exception:
        return False


def _set_with_tkinter(text: str) -> bool:
    if tk is None:
        return False
    try:
        root = tk.Tk()
        root.withdraw()
        root.clipboard_clear()
        root.clipboard_append(text)
        root.update()
        root.destroy()
        return True
    except Exception:
        return False


def _set_with_clip_command(text: str) -> bool:
    if not sys.platform.startswith("win"):
        return False
    clip_cmd = shutil.which("clip") or shutil.which("clip.exe")
    cmd = [clip_cmd] if clip_cmd else ["cmd", "/c", "clip"]
    try:
        exec_silent(cmd, input=text, text=True, check=True)
        return True
    except Exception:
        return False


def _get_with_pyperclip() -> Optional[str]:
    if pyperclip is None:
        return None
    try:
        return pyperclip.paste()
    except Exception:
        return None


def _get_with_tkinter() -> Optional[str]:
    if tk is None:
        return None
    try:
        root = tk.Tk()
        root.withdraw()
        try:
            content = root.clipboard_get()
        except Exception:
            content = None
        root.destroy()
        return content
    except Exception:
        return None


def _get_with_powershell() -> Optional[str]:
    if not sys.platform.startswith("win"):
        return None
    try:
        result = exec_silent(
            ["powershell", "-NoProfile", "-Command", "Get-Clipboard"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout
    except Exception:
        return None


def set_clipboard_text(text: str) -> bool:
    """Set the system clipboard to text. Returns True on success."""
    for setter in (_set_with_pyperclip, _set_with_tkinter, _set_with_clip_command):
        if setter(text):
            return True
    return False


def get_clipboard_text() -> Optional[str]:
    """Return the current clipboard text, or None if unavailable."""
    for getter in (_get_with_pyperclip, _get_with_tkinter, _get_with_powershell):
        value = getter()
        if value is not None:
            return value
    return None


__all__ = ["set_clipboard_text", "get_clipboard_text"]
