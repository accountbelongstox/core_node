# -*- coding: utf-8 -*-
"""
Ubuntu Shortcut Finder
Finds Ubuntu shortcuts in Windows Start Menu
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_win32com_client
from pycore.pyutils.launcher.app_search import current_username

START_MENU_TEMPLATE = 'C:\\Users\\{username}\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu'
UBUNTU_SHORTCUT_PATTERNS = ('*ubuntu*.lnk',)


class UbuntuFinder:
    """Find Ubuntu shortcuts in Start Menu"""

    def __init__(self):
        self.start_menu_path = Path(START_MENU_TEMPLATE.format(username=current_username()))

    def find_ubuntu_shortcuts(self) -> List[Dict[str, str]]:
        """
        Find Ubuntu shortcuts in Start Menu

        Returns:
            List of dictionaries with shortcut information:
            {
                'name': shortcut name,
                'path': shortcut file path,
                'target': target executable path,
                'arguments': shortcut arguments,
                'full_command': full command to execute
            }
        """
        win32com_client = get_third_package_win32com_client()
        if win32com_client is None:
            # pywin32 is Windows-only and this reads the Windows Start Menu, so on
            # Linux/macOS this finder is a no-op; warn only on Windows.
            if sys.platform == "win32":
                ColorPrint.yellow("Warning: win32com not available, cannot read shortcuts")
            return []

        if not self.start_menu_path.exists():
            ColorPrint.yellow(f"Warning: Start Menu path not found: {self.start_menu_path}")
            return []

        found_shortcuts = []
        for pattern in UBUNTU_SHORTCUT_PATTERNS:
            try:
                shortcuts = list(self.start_menu_path.rglob(pattern))
            except OSError as exc:
                ColorPrint.yellow(f"Warning: searching {self.start_menu_path} for {pattern} failed: {exc}")
                continue
            for shortcut_path in shortcuts:
                shortcut_info = self._read_shortcut(shortcut_path)
                if shortcut_info:
                    found_shortcuts.append(shortcut_info)
        return found_shortcuts

    def _read_shortcut(self, shortcut_path: Path) -> Optional[Dict[str, str]]:
        """Shortcut target/arguments of a .lnk file, or None when unreadable."""
        win32com_client = get_third_package_win32com_client()
        COM_ERRORS = (OSError, win32com_client.pywintypes.com_error) if win32com_client is not None else (OSError,)
        try:
            shell = win32com_client.Dispatch("WScript.Shell")
            link = shell.CreateShortcut(str(shortcut_path))
            target = link.TargetPath
            arguments = link.Arguments or ""
        except COM_ERRORS as exc:
            ColorPrint.yellow(f"Warning: Failed to read shortcut {shortcut_path}: {exc}")
            return None
        return {
            'name': shortcut_path.stem,
            'path': str(shortcut_path),
            'target': target,
            'arguments': arguments,
            'full_command': f"{target} {arguments}".strip()
        }

    def get_first_ubuntu_shortcut(self) -> Optional[Dict[str, str]]:
        """First Ubuntu shortcut found, or None."""
        shortcuts = self.find_ubuntu_shortcuts()
        return shortcuts[0] if shortcuts else None
