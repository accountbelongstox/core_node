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
from pycore.pyutils.common.clipboard_text import get_clipboard_text, set_clipboard_text


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
        content = get_clipboard_text()
        if content is None:
            ColorPrint.yellow("[Clipboard] Failed to read clipboard content via available backends.")
        return content

    def set_text(self, text: str, include_primary: bool = False) -> bool:
        """
        Set clipboard text content.

        Args:
            text: Text to copy to clipboard.
            include_primary: Also own the Linux PRIMARY selection (Shift+Insert paste).

        Returns:
            True if successful, False otherwise.
        """
        if set_clipboard_text(text, include_primary):
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
