# -*- coding: utf-8 -*-
import win32com.client
"""
Ubuntu Shortcut Finder
Finds Ubuntu shortcuts in Windows Start Menu
"""

import os
import sys
from pathlib import Path
from typing import List, Dict, Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

try:
    HAS_WIN32COM = True
except ImportError:
    HAS_WIN32COM = False


class UbuntuFinder:
    """Find Ubuntu shortcuts in Start Menu"""
    
    def __init__(self):
        """Initialize Ubuntu finder"""
        self.username = os.getenv('USERNAME') or os.getenv('USER')
        self.start_menu_path = Path(f'C:\\Users\\{self.username}\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu')
    
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
        if not HAS_WIN32COM:
            # win32com (pywin32) is Windows-only and this reads the Windows Start Menu, so on
            # Linux/macOS this finder is simply a no-op. Warn only on Windows (where pywin32
            # should be installed) to avoid noise on every other platform.
            if sys.platform == "win32":
                ColorPrint.plain("Warning: win32com not available, cannot read shortcuts")
            return []
        
        if not self.start_menu_path.exists():
            ColorPrint.plain(f"Warning: Start Menu path not found: {self.start_menu_path}")
            return []
        
        found_shortcuts = []
        search_patterns = ['*ubuntu*.lnk']
        
        try:
            for pattern in search_patterns:
                shortcuts = list(self.start_menu_path.rglob(pattern))
                for shortcut_path in shortcuts:
                    try:
                        shortcut_info = self._read_shortcut(shortcut_path)
                        if shortcut_info:
                            found_shortcuts.append(shortcut_info)
                    except Exception as e:
                        ColorPrint.plain(f"Warning: Error reading shortcut {shortcut_path}: {e}")
        except Exception as e:
            ColorPrint.plain(f"Warning: Error searching for shortcuts: {e}")
        
        return found_shortcuts
    
    def _read_shortcut(self, shortcut_path: Path) -> Optional[Dict[str, str]]:
        """
        Read shortcut information
        
        Args:
            shortcut_path: Path to .lnk file
            
        Returns:
            Dictionary with shortcut info or None
        """
        if not HAS_WIN32COM:
            return None
        
        try:
            shell = win32com.client.Dispatch("WScript.Shell")
            link = shell.CreateShortcut(str(shortcut_path))
            
            target = link.TargetPath
            arguments = link.Arguments or ""
            full_command = f"{target} {arguments}".strip()
            
            return {
                'name': shortcut_path.stem,
                'path': str(shortcut_path),
                'target': target,
                'arguments': arguments,
                'full_command': full_command
            }
        except Exception as e:
            ColorPrint.plain(f"Warning: Failed to read shortcut {shortcut_path}: {e}")
            return None
    
    def get_first_ubuntu_shortcut(self) -> Optional[Dict[str, str]]:
        """
        Get the first Ubuntu shortcut found
        
        Returns:
            Dictionary with shortcut info or None
        """
        shortcuts = self.find_ubuntu_shortcuts()
        if shortcuts:
            return shortcuts[0]
        return None

