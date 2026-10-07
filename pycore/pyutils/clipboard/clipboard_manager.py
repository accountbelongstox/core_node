#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clipboard Manager

Cross-platform clipboard operations with backup/restore functionality.
"""

from __future__ import annotations

import platform
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.clipboard_text import (
    ClipboardSnapshot,
    get_clipboard_text,
    restore_clipboard,
    set_clipboard_text,
    snapshot_clipboard,
)


class ClipboardManager:
    """
    Clipboard manager with backup/restore functionality.

    Provides cross-platform clipboard access using multiple backends.
    """

    def __init__(self):
        self.platform = platform.system()
        self._backup_content: Optional[ClipboardSnapshot] = None

    def get_text(self, primary: bool = False) -> Optional[str]:
        """
        Get current clipboard text content.

        Args:
            primary: Read the Linux PRIMARY selection instead of the clipboard.

        Returns:
            Clipboard text or None if clipboard is empty/unavailable.
        """
        content = get_clipboard_text(primary)
        if content is None:
            ColorPrint.yellow("[Clipboard] Failed to read clipboard content via available backends.")
        return content

    def set_text(self, text: str, include_primary: bool = False, transient: bool = False) -> bool:
        """
        Set clipboard text content.

        Args:
            text: Text to copy to clipboard.
            include_primary: Also own the Linux PRIMARY selection (Shift+Insert paste).
            transient: Keep the item out of the Windows clipboard history (temporary paste content).

        Returns:
            True if successful, False otherwise.
        """
        if set_clipboard_text(text, include_primary, transient):
            return True
        ColorPrint.red("[Clipboard] Failed to set clipboard content via available backends.")
        return False

    def snapshot(self) -> Optional[ClipboardSnapshot]:
        """
        Capture the clipboard in every restorable format (text, screenshots, copied files).

        Returns:
            The snapshot, or None if the clipboard could not be read.
        """
        snapshot = snapshot_clipboard()
        if snapshot is None:
            ColorPrint.yellow("[Clipboard] Failed to snapshot clipboard content; it will be left as is.")
        return snapshot

    def restore_snapshot(self, snapshot: Optional[ClipboardSnapshot]) -> bool:
        """
        Put a snapshot back; a missing snapshot (unreadable clipboard) is a no-op success.

        Returns:
            True if restored (or nothing to restore), False otherwise.
        """
        if snapshot is None:
            return True
        if restore_clipboard(snapshot):
            return True
        ColorPrint.red(f"[Clipboard] Failed to restore clipboard content kind={snapshot.kind}.")
        return False

    def backup(self) -> bool:
        """
        Backup current clipboard content

        Returns:
            True if backup successful, False otherwise
        """
        self._backup_content = self.snapshot()
        if self._backup_content is not None:
            ColorPrint.blue(f"[Clipboard] Backed up: {self._backup_content.kind}")
            return True
        return False

    def restore(self) -> bool:
        """
        Restore previously backed up clipboard content

        Returns:
            True if restore successful, False otherwise
        """
        if self._backup_content is not None:
            success = self.restore_snapshot(self._backup_content)
            if success:
                ColorPrint.blue(f"[Clipboard] Restored: {self._backup_content.kind}")
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
        return self.set_text(text, transient=True)


# Singleton instance
clipboard_manager = ClipboardManager()
