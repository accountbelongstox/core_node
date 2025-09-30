#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bot Scanner
Recursively scans for RoS-BoT.exe and manages bot directory detection
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from utils.color_print import ColorPrint


class BotScanner:
    """Scans for bot programs and manages bot directory detection"""
    
    def __init__(self, bot_base_dir: str, bot_exe_name: str = "RoS-BoT.exe"):
        """
        Initialize bot scanner
        
        Args:
            bot_base_dir: Base directory to scan for bot programs
            bot_exe_name: Name of bot executable
        """
        self.bot_base_dir = Path(bot_base_dir)
        self.bot_exe_name = bot_exe_name
        self._bot_dir = None
        self._boot_exe_name = None
        ColorPrint.green("[INIT] BotScanner initialized")
    
    def scan_for_bot_directory(self) -> Dict:
        """
        Recursively scan bot_base_dir for RoS-BoT.exe and get bot directory
        
        Returns:
            Dictionary with scan results including bot_dir and boot_exe_name
        """
        try:
            if not self.bot_base_dir.exists():
                ColorPrint.red(f"[ERROR] Bot base directory not found: {self.bot_base_dir}")
                return {
                    "success": False,
                    "error": f"Bot base directory not found: {self.bot_base_dir}",
                    "bot_dir": None,
                    "boot_exe_name": None,
                    "other_exe_files": []
                }
            
            ColorPrint.blue(f"[SCAN] Scanning for {self.bot_exe_name} in: {self.bot_base_dir}")
            
            # Find all directories containing RoS-BoT.exe
            bot_directories = []
            
            for root, dirs, files in os.walk(self.bot_base_dir):
                if self.bot_exe_name in files:
                    bot_exe_path = Path(root) / self.bot_exe_name
                    mod_time = bot_exe_path.stat().st_mtime
                    
                    bot_directories.append({
                        'path': Path(root),
                        'bot_exe_path': bot_exe_path,
                        'mod_time': mod_time,
                        'mod_time_str': datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d %H:%M:%S')
                    })
                    ColorPrint.green(f"[FOUND] Found {self.bot_exe_name} in: {root}")
                    ColorPrint.gray(f"   Modified: {datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d %H:%M:%S')}")
            
            if not bot_directories:
                ColorPrint.yellow(f"[WARNING] No {self.bot_exe_name} found in {self.bot_base_dir}")
                return {
                    "success": False,
                    "error": f"No {self.bot_exe_name} found",
                    "bot_dir": None,
                    "boot_exe_name": None,
                    "other_exe_files": []
                }
            
            # Sort by modification time (newest first) and select the latest
            bot_directories.sort(key=lambda x: x['mod_time'], reverse=True)
            selected_bot_dir = bot_directories[0]
            
            self._bot_dir = selected_bot_dir['path']
            
            ColorPrint.blue(f"[STATS] Found {len(bot_directories)} {self.bot_exe_name} file(s)")
            if len(bot_directories) == 1:
                ColorPrint.green(f"[SELECTED] Using bot directory: {self._bot_dir}")
            else:
                ColorPrint.green(f"[SELECTED] Selected latest bot directory: {self._bot_dir}")
                ColorPrint.gray(f"   Latest modification: {selected_bot_dir['mod_time_str']}")
            
            # Find other .exe files (potential boot exe names)
            other_exe_files = self._find_other_exe_files(self._bot_dir)
            
            # Try to determine boot exe name
            self._boot_exe_name = self._determine_boot_exe_name(other_exe_files)
            
            result = {
                "success": True,
                "bot_dir": str(self._bot_dir),
                "boot_exe_name": self._boot_exe_name,
                "other_exe_files": other_exe_files,
                "bot_exe_path": str(selected_bot_dir['bot_exe_path'])
            }
            
            ColorPrint.green("[SUCCESS] Bot scan completed successfully")
            ColorPrint.green(f"[BOT_DIR] Bot directory: {self._bot_dir}")
            if self._boot_exe_name:
                ColorPrint.green(f"[BOOT_EXE] Boot exe name: {self._boot_exe_name}")
            else:
                ColorPrint.yellow("[PENDING] Boot exe name not yet determined (may be generated after RoS-BoT.exe starts)")

            if other_exe_files:
                ColorPrint.blue(f"[OTHER_EXE] Other exe files found: {', '.join(other_exe_files)}")
            
            return result
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error scanning for bot directory: {e}")
            return {
                "success": False,
                "error": str(e),
                "bot_dir": None,
                "boot_exe_name": None,
                "other_exe_files": []
            }
    
    def _find_other_exe_files(self, bot_dir: Path) -> List[str]:
        """
        Find other .exe files in bot directory (excluding RoS-BoT.exe)
        
        Args:
            bot_dir: Bot directory path
            
        Returns:
            List of other exe file names
        """
        other_exe_files = []
        try:
            for file in bot_dir.iterdir():
                if file.is_file() and file.suffix.lower() == '.exe' and file.name != self.bot_exe_name:
                    other_exe_files.append(file.name)
                    ColorPrint.gray(f"   Found other exe: {file.name}")
        except Exception as e:
            ColorPrint.yellow(f"⚠️  Error reading bot directory: {e}")
        
        return other_exe_files
    
    def _determine_boot_exe_name(self, other_exe_files: List[str]) -> Optional[str]:
        """
        Try to determine boot exe name from other exe files
        Boot exe is typically generated after RoS-BoT.exe starts
        
        Args:
            other_exe_files: List of other exe files
            
        Returns:
            Boot exe name if found, None otherwise
        """
        if not other_exe_files:
            return None
        
        # If only one other exe file, it's likely the boot exe
        if len(other_exe_files) == 1:
            ColorPrint.blue(f"🎯 Assuming boot exe: {other_exe_files[0]}")
            return other_exe_files[0]
        
        # If multiple exe files, try to identify the boot exe
        # Look for common patterns in bot exe names
        boot_patterns = ['rbassist', 'bot', 'assist', 'helper']
        
        for exe_file in other_exe_files:
            exe_lower = exe_file.lower()
            for pattern in boot_patterns:
                if pattern in exe_lower:
                    ColorPrint.blue(f"🎯 Identified boot exe by pattern: {exe_file}")
                    return exe_file
        
        # If no pattern match, return the first one
        ColorPrint.yellow(f"⚠️  Multiple exe files found, using first: {other_exe_files[0]}")
        return other_exe_files[0]
    
    def rescan_for_boot_exe(self) -> Optional[str]:
        """
        Rescan bot directory for boot exe (useful after RoS-BoT.exe has started)
        
        Returns:
            Boot exe name if found, None otherwise
        """
        if not self._bot_dir:
            ColorPrint.yellow("⚠️  No bot directory set, run scan_for_bot_directory first")
            return None
        
        ColorPrint.blue("🔄 Rescanning for boot exe...")
        other_exe_files = self._find_other_exe_files(self._bot_dir)
        self._boot_exe_name = self._determine_boot_exe_name(other_exe_files)
        
        if self._boot_exe_name:
            ColorPrint.green(f"✅ Boot exe found: {self._boot_exe_name}")
        else:
            ColorPrint.yellow("⚠️  Boot exe still not found")
        
        return self._boot_exe_name
    
    def get_bot_dir(self) -> Optional[str]:
        """Get current bot directory"""
        return str(self._bot_dir) if self._bot_dir else None
    
    def get_boot_exe_name(self) -> Optional[str]:
        """Get current boot exe name"""
        return self._boot_exe_name
    
    def get_bot_exe_path(self) -> Optional[str]:
        """Get full path to RoS-BoT.exe"""
        if self._bot_dir:
            return str(self._bot_dir / self.bot_exe_name)
        return None
    
    def get_boot_exe_path(self) -> Optional[str]:
        """Get full path to boot exe"""
        if self._bot_dir and self._boot_exe_name:
            return str(self._bot_dir / self._boot_exe_name)
        return None
