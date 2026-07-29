#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clipboard Manager

Cross-platform clipboard operations with backup/restore functionality.
"""

from __future__ import annotations

import ctypes
import platform
import shutil
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime
import sys
from typing import Callable, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_pyperclip
from pycore.pyfoundations.third_party.api import get_third_package_tkinter

pyperclip = get_third_package_pyperclip()
tk = get_third_package_tkinter()


def _copy_with_winapi(text: str) -> bool:
    if not sys.platform.startswith("win"):
        return False
    try:
        kernel32 = ctypes.windll.kernel32
        user32 = ctypes.windll.user32
    except Exception:
        return False

    GMEM_MOVEABLE = 0x0002
    CF_UNICODETEXT = 13

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


def _copy_with_pyperclip(text: str) -> bool:
    if pyperclip is None:
        return False
    try:
        pyperclip.copy(text)
        return True
    except Exception:
        return False


def _copy_with_tkinter(text: str) -> bool:
    root = tk.Tk()
    root.withdraw()
    root.clipboard_clear()
    root.clipboard_append(text)
    root.update()
    root.destroy()
    return True


def _copy_with_powershell(text: str) -> bool:
    if not sys.platform.startswith("win"):
        return False
    script = "Set-Clipboard -Value ([Console]::In.ReadToEnd())"
    try:
        exec_silent(
            ["powershell", "-NoProfile", "-Command", script],
            input=text,
            text=True,
            check=True,
        )
        return True
    except Exception:
        return False


def _copy_with_clip_command(text: str) -> bool:
    if not sys.platform.startswith("win"):
        return False
    clip_cmd = shutil.which("clip") or shutil.which("clip.exe")
    cmd = [clip_cmd] if clip_cmd else ["cmd", "/c", "clip"]
    try:
        exec_silent(
            cmd,
            input=text,
            text=True,
            check=True,
        )
        return True
    except Exception:
        return False


def _read_with_pyperclip() -> Optional[str]:
    if pyperclip is None:
        return None
    try:
        return pyperclip.paste()
    except Exception:
        return None


def _read_with_tkinter() -> Optional[str]:
    root = tk.Tk()
    root.withdraw()
    try:
        content = root.clipboard_get()
    except Exception:
        content = None
    root.destroy()
    return content


def _read_with_powershell() -> Optional[str]:
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


WRITE_HANDLERS: tuple[Callable[[str], bool], ...] = (
    _copy_with_winapi,
    _copy_with_pyperclip,
    _copy_with_tkinter,
    _copy_with_powershell,
    _copy_with_clip_command,
)

READ_HANDLERS: tuple[Callable[[], Optional[str]], ...] = (
    _read_with_pyperclip,
    _read_with_tkinter,
    _read_with_powershell,
)


class ClipboardManager:
    """
    Clipboard manager with backup/restore functionality.

    Provides cross-platform clipboard access using multiple backends.
    """

    def __init__(self):
        self.platform = platform.system()
        self._backup_content: Optional[str] = None

    def get_text(self) -> Optional[str]:
        """
        Get current clipboard text content.

        Returns:
            Clipboard text or None if clipboard is empty/unavailable.
        """
        for reader in READ_HANDLERS:
            content = reader()
            if content:
                return content
        ColorPrint.yellow("[Clipboard] Failed to read clipboard content via available backends.")
        return None

    def set_text(self, text: str) -> bool:
        """
        Set clipboard text content.

        Args:
            text: Text to copy to clipboard.

        Returns:
            True if successful, False otherwise.
        """
        for writer in WRITE_HANDLERS:
            if writer(text):
                return True
        ColorPrint.red("[Clipboard] Failed to set clipboard content via available backends.")
        return False

    def backup(self) -> bool:
        """
        Backup current clipboard content

        Returns:
            True if backup successful, False otherwise
        """
        self._backup_content = self.get_text()
        if self._backup_content is not None:
            ColorPrint.blue(f"[Clipboard] Backed up: {len(self._backup_content)} chars")
            return True
        return False

    def restore(self) -> bool:
        """
        Restore previously backed up clipboard content

        Returns:
            True if restore successful, False otherwise
        """
        if self._backup_content is not None:
            success = self.set_text(self._backup_content)
            if success:
                ColorPrint.blue(f"[Clipboard] Restored: {len(self._backup_content)} chars")
            return success
        return False

    def copy_with_backup(self, text: str) -> bool:
        """
        Copy text to clipboard with automatic backup of previous content

        Args:
            text: Text to copy

        Returns:
            True if successful, False otherwise
        """
        # Backup current content
        self.backup()

        # Set new content
        return self.set_text(text)


# Singleton instance
clipboard_manager = ClipboardManager()
