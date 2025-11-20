#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clipboard Manager

Cross-platform clipboard operations with backup/restore functionality.
"""

import platform
from typing import Optional
from pycore.pyfoundations.color_print import ColorPrint


class ClipboardManager:
    """
    Clipboard manager with backup/restore functionality

    Provides cross-platform clipboard access using tkinter.
    """

    def __init__(self):
        """Initialize clipboard manager"""
        self.platform = platform.system()
        self._backup_content: Optional[str] = None

    def get_text(self) -> Optional[str]:
        """
        Get current clipboard text content

        Returns:
            Clipboard text or None if clipboard is empty/unavailable
        """
        try:
            import tkinter as tk
            root = tk.Tk()
            root.withdraw()  # Hide window
            content = root.clipboard_get()
            root.destroy()
            return content
        except Exception as e:
            ColorPrint.yellow(f"[Clipboard] Failed to get clipboard content: {e}")
            return None

    def set_text(self, text: str) -> bool:
        """
        Set clipboard text content

        Args:
            text: Text to copy to clipboard

        Returns:
            True if successful, False otherwise
        """
        try:
            import tkinter as tk
            root = tk.Tk()
            root.withdraw()
            root.clipboard_clear()
            root.clipboard_append(text)
            root.update()  # Keep clipboard content after destroy
            root.destroy()
            return True
        except Exception as e:
            ColorPrint.red(f"[Clipboard] Failed to set clipboard content: {e}")
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
