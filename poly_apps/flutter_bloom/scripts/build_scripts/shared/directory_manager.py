#!/usr/bin/env python3
"""
Directory Manager
Shared directory management class for handling origin and temp directory switching
"""

import os
from pathlib import Path
from typing import Optional
from utils.print_helper import PrintHelper


class DirectoryManager:
    """
    Manages directory state and switching between origin and temp directories
    """

    def __init__(self):
        """Initialize the directory manager"""
        # Calculate origin directory (../../../ from current py file location)
        current_file_dir = Path(__file__).parent
        self.origin_dir = current_file_dir / ".." / ".." / ".."
        self.origin_dir = self.origin_dir.resolve()

        # Initialize current_dir to origin_dir
        self.current_dir = self.origin_dir
        self._temp_dir: Optional[Path] = None
        self._is_in_temp = False

        # Initialize factory analyzer for temp directory detection
        self._factory_analyzer = None

    def set_factory_analyzer(self, factory_analyzer):
        """Set the factory analyzer for temp directory detection"""
        self._factory_analyzer = factory_analyzer
        self._update_temp_status()

    def _update_temp_status(self):
        """Update the is_in_temp status based on current directory"""
        if self._factory_analyzer:
            self._is_in_temp = self._factory_analyzer.is_in_temp_directory(str(self.current_dir))
        else:
            self._is_in_temp = False

    @property
    def is_in_temp(self) -> bool:
        """Check if currently in temporary directory"""
        return self._is_in_temp

    @property
    def temp_dir(self) -> Optional[Path]:
        """Get the current temp directory"""
        return self._temp_dir

    def switch_to_origin_dir(self) -> bool:
        """Switch to origin directory"""
        try:
            os.chdir(self.origin_dir)
            self.current_dir = self.origin_dir
            self._update_temp_status()
            PrintHelper.info(f"Switched to origin directory: {self.origin_dir}", "DIR-MANAGER")
            return True
        except Exception as e:
            PrintHelper.error(f"Failed to switch to origin directory: {e}", "DIR-MANAGER")
            return False

    def switch_to_temp_dir(self, temp_dir: Path) -> bool:
        """Switch to temporary directory"""
        try:
            if not temp_dir.exists():
                PrintHelper.error(f"Temp directory does not exist: {temp_dir}", "DIR-MANAGER")
                return False

            os.chdir(temp_dir)
            self.current_dir = temp_dir
            self._temp_dir = temp_dir
            self._update_temp_status()
            PrintHelper.info(f"Switched to temp directory: {temp_dir}", "DIR-MANAGER")
            return True
        except Exception as e:
            PrintHelper.error(f"Failed to switch to temp directory: {e}", "DIR-MANAGER")
            return False

    def update_current_dir(self, new_dir: Path):
        """Update current directory without changing working directory"""
        self.current_dir = new_dir
        self._update_temp_status()
        PrintHelper.info(f"Updated current_dir to: {new_dir}", "DIR-MANAGER")

    def get_current_info(self) -> dict:
        """Get current directory information"""
        return {
            'origin_dir': str(self.origin_dir),
            'current_dir': str(self.current_dir),
            'temp_dir': str(self._temp_dir) if self._temp_dir else None,
            'is_in_temp': self._is_in_temp,
            'working_dir': str(Path.cwd())
        }

    def print_status(self):
        """Print current directory status"""
        info = self.get_current_info()
        PrintHelper.header("Directory Status", "DIR-MANAGER")
        PrintHelper.info(f"Origin Dir: {info['origin_dir']}", "DIR-MANAGER")
        PrintHelper.info(f"Current Dir: {info['current_dir']}", "DIR-MANAGER")
        PrintHelper.info(f"Temp Dir: {info['temp_dir']}", "DIR-MANAGER")
        PrintHelper.info(f"Is In Temp: {info['is_in_temp']}", "DIR-MANAGER")
        PrintHelper.info(f"Working Dir: {info['working_dir']}", "DIR-MANAGER")