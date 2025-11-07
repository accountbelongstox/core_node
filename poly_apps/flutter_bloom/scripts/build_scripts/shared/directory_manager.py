#!/usr/bin/env python3
"""
Directory Manager
Shared directory management class for handling origin and temp directory switching
"""

import os
import sys
from pathlib import Path
from typing import Optional

# Import PrintHelper from utils directory
sys.path.insert(0, str(Path(__file__).parent.parent / "utils"))
from print_helper import PrintHelper

# Import build constants
sys.path.insert(0, str(Path(__file__).parent.parent / "core" / "constants"))
from build_constants import COMPILE_FACTORY_DIR


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

    def get_build_root_directory(self, **kwargs) -> Optional[Path]:
        """
        Get the build root directory (parent directory containing android/, ios/, etc.)

        This method tries multiple strategies to locate the build root directory:
        1. temp_build_root from kwargs (preferred)
        2. build_root from kwargs
        3. Current temp directory if in temp
        4. Latest build directory in compile_factory (fallback)

        Args:
            **kwargs: May contain 'temp_build_root' or 'build_root' parameters

        Returns:
            Path to build root directory, or None if not found
        """
        # Strategy 1: temp_build_root parameter (from modern_build_system)
        if 'temp_build_root' in kwargs:
            build_root = Path(kwargs['temp_build_root'])
            if build_root.exists():
                PrintHelper.info(f"Using temp_build_root parameter: {build_root}", "DIR-MANAGER")
                return build_root
            else:
                PrintHelper.warning(f"temp_build_root does not exist: {build_root}", "DIR-MANAGER")

        # Strategy 2: build_root parameter
        if 'build_root' in kwargs:
            build_root = Path(kwargs['build_root'])
            if build_root.exists():
                PrintHelper.info(f"Using build_root parameter: {build_root}", "DIR-MANAGER")
                return build_root

        # Strategy 3: Current temp directory (if we're in temp)
        if self.is_in_temp and self._temp_dir:
            PrintHelper.info(f"Using current temp directory: {self._temp_dir}", "DIR-MANAGER")
            return self._temp_dir

        # Strategy 4: Current directory (if in temp but temp_dir not set)
        if self.is_in_temp:
            PrintHelper.info(f"Using current directory (in temp): {self.current_dir}", "DIR-MANAGER")
            return self.current_dir

        # Strategy 5: Fallback - look for latest build in compile_factory
        compile_factory = Path(COMPILE_FACTORY_DIR)
        if compile_factory.exists():
            build_dirs = [d for d in compile_factory.iterdir()
                         if d.is_dir() and 'app_' in d.name]
            if build_dirs:
                latest_build = max(build_dirs, key=lambda x: x.stat().st_mtime)
                PrintHelper.info(f"Using latest compile_factory directory: {latest_build}", "DIR-MANAGER")
                return latest_build

        PrintHelper.error("Could not determine build root directory", "DIR-MANAGER")
        return None

    def print_status(self):
        """Print current directory status"""
        info = self.get_current_info()
        PrintHelper.header("Directory Status", "DIR-MANAGER")
        PrintHelper.info(f"Origin Dir: {info['origin_dir']}", "DIR-MANAGER")
        PrintHelper.info(f"Current Dir: {info['current_dir']}", "DIR-MANAGER")
        PrintHelper.info(f"Temp Dir: {info['temp_dir']}", "DIR-MANAGER")
        PrintHelper.info(f"Is In Temp: {info['is_in_temp']}", "DIR-MANAGER")
        PrintHelper.info(f"Working Dir: {info['working_dir']}", "DIR-MANAGER")