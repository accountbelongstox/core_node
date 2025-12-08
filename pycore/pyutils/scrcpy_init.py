#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrcpy initialization module

Handles automatic extraction and initialization of scrcpy and adb tools
to user data directory to avoid git upload size limits.
"""

import os
import sys
import zipfile
import platform
from pathlib import Path
from typing import Dict, Optional


class ScrcpyInitializer:
    """Initialize scrcpy and adb in user data directory"""

    def __init__(self):
        self.system = platform.system().lower()
        self.user_data_dir = self._get_user_data_dir()
        self.scrcpy_dir = self.user_data_dir / "scrcpy"
        self.project_root = Path(__file__).parent.parent.parent

    def _get_user_data_dir(self) -> Path:
        """Get user data directory based on OS"""
        if self.system == "windows":
            # Windows: C:\Users\<username>\.core_node
            base_dir = Path.home() / ".core_node"
        elif self.system == "linux":
            # Linux: /var/_core_node
            base_dir = Path("/var/_core_node")
            # If /var/_core_node not accessible, fallback to home
            if not os.access("/var", os.W_OK):
                base_dir = Path.home() / ".core_node"
        elif self.system == "darwin":
            # macOS: ~/.core_node
            base_dir = Path.home() / ".core_node"
        else:
            # Unknown OS, use home
            base_dir = Path.home() / ".core_node"

        base_dir.mkdir(parents=True, exist_ok=True)
        return base_dir

    def _get_package_path(self) -> Optional[Path]:
        """Get the .pyp package path from project resources"""
        resources_dir = self.project_root / "pyapps" / "matrix" / "resources"

        # Look for scrcpy package
        package_patterns = [
            "scrcpy-win64-v*.pyp",
            "scrcpy-linux-v*.pyp",
            "scrcpy-macos-v*.pyp",
        ]

        for pattern in package_patterns:
            matches = list(resources_dir.glob(pattern))
            if matches:
                # Return the first (newest) match
                return matches[0]

        return None

    def is_initialized(self) -> bool:
        """Check if scrcpy is already initialized"""
        if not self.scrcpy_dir.exists():
            return False

        # Check for key files based on OS
        if self.system == "windows":
            adb_exe = self.scrcpy_dir / "adb.exe"
            scrcpy_exe = self.scrcpy_dir / "scrcpy.exe"
            return adb_exe.exists() and scrcpy_exe.exists()
        else:
            adb_bin = self.scrcpy_dir / "adb"
            scrcpy_bin = self.scrcpy_dir / "scrcpy"
            return adb_bin.exists() and scrcpy_bin.exists()

    def extract_package(self) -> bool:
        """Extract scrcpy package to user data directory"""
        package_path = self._get_package_path()

        if not package_path:
            print(f"[ScrcpyInit] ERROR: No scrcpy package found in resources")
            print(f"[ScrcpyInit] Please download scrcpy from:")
            print(f"[ScrcpyInit]   https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-win64-v3.3.3.zip")
            print(f"[ScrcpyInit] Rename it to 'scrcpy-win64-v3.3.3.pyp' and place in:")
            print(f"[ScrcpyInit]   {self.project_root / 'pyapps' / 'matrix' / 'resources'}")
            return False

        if not package_path.exists():
            print(f"[ScrcpyInit] ERROR: Package not found: {package_path}")
            return False

        print(f"[ScrcpyInit] Extracting {package_path.name}...")
        print(f"[ScrcpyInit] Target directory: {self.scrcpy_dir}")

        try:
            # Create target directory
            self.scrcpy_dir.mkdir(parents=True, exist_ok=True)

            # Extract zip
            with zipfile.ZipFile(package_path, 'r') as zip_ref:
                # Get the root folder name in zip (e.g., "scrcpy-win64-v3.3.3")
                namelist = zip_ref.namelist()
                root_folder = namelist[0].split('/')[0] if namelist else None

                # Extract all files
                zip_ref.extractall(self.user_data_dir)

                # If extracted to a subfolder, move contents up
                if root_folder:
                    extracted_dir = self.user_data_dir / root_folder
                    if extracted_dir.exists() and extracted_dir != self.scrcpy_dir:
                        # Move all files from extracted_dir to scrcpy_dir
                        if self.scrcpy_dir.exists():
                            import shutil
                            shutil.rmtree(self.scrcpy_dir)
                        extracted_dir.rename(self.scrcpy_dir)

            print(f"[ScrcpyInit] Extraction completed")

            # Set executable permissions on Linux/macOS
            if self.system in ["linux", "darwin"]:
                self._set_executable_permissions()

            return True

        except Exception as e:
            print(f"[ScrcpyInit] ERROR: Failed to extract package: {e}")
            return False

    def _set_executable_permissions(self):
        """Set executable permissions on binaries (Linux/macOS)"""
        executables = ["adb", "scrcpy"]

        for exe_name in executables:
            exe_path = self.scrcpy_dir / exe_name
            if exe_path.exists():
                exe_path.chmod(0o755)
                print(f"[ScrcpyInit] Set executable: {exe_name}")

    def get_adb_path(self) -> Optional[Path]:
        """Get absolute path to adb executable"""
        if not self.is_initialized():
            if not self.extract_package():
                return None

        if self.system == "windows":
            adb_path = self.scrcpy_dir / "adb.exe"
        else:
            adb_path = self.scrcpy_dir / "adb"

        return adb_path if adb_path.exists() else None

    def get_scrcpy_path(self) -> Optional[Path]:
        """Get absolute path to scrcpy executable"""
        if not self.is_initialized():
            if not self.extract_package():
                return None

        if self.system == "windows":
            scrcpy_path = self.scrcpy_dir / "scrcpy.exe"
        else:
            scrcpy_path = self.scrcpy_dir / "scrcpy"

        return scrcpy_path if scrcpy_path.exists() else None

    def get_paths(self) -> Dict[str, Optional[Path]]:
        """Get all tool paths"""
        return {
            "adb": self.get_adb_path(),
            "scrcpy": self.get_scrcpy_path(),
            "scrcpy_dir": self.scrcpy_dir if self.is_initialized() else None,
        }

    def initialize(self) -> bool:
        """Initialize scrcpy (extract if needed)"""
        if self.is_initialized():
            print(f"[ScrcpyInit] Already initialized at: {self.scrcpy_dir}")
            return True

        print(f"[ScrcpyInit] Initializing scrcpy...")
        return self.extract_package()


# Global singleton instance
_initializer_instance = None


def get_initializer() -> ScrcpyInitializer:
    """Get global ScrcpyInitializer instance"""
    global _initializer_instance
    if _initializer_instance is None:
        _initializer_instance = ScrcpyInitializer()
    return _initializer_instance


# Convenience functions
def initialize_scrcpy() -> bool:
    """Initialize scrcpy (convenience function)"""
    return get_initializer().initialize()


def get_adb_path() -> Optional[Path]:
    """Get adb path (convenience function)"""
    return get_initializer().get_adb_path()


def get_scrcpy_path() -> Optional[Path]:
    """Get scrcpy path (convenience function)"""
    return get_initializer().get_scrcpy_path()


if __name__ == "__main__":
    # Test initialization
    print("=" * 70)
    print("Scrcpy Initializer Test")
    print("=" * 70)

    initializer = get_initializer()

    print(f"\nSystem: {initializer.system}")
    print(f"User data dir: {initializer.user_data_dir}")
    print(f"Scrcpy dir: {initializer.scrcpy_dir}")

    print(f"\nInitialized: {initializer.is_initialized()}")

    if not initializer.is_initialized():
        print("\nInitializing...")
        success = initializer.initialize()
        print(f"Initialization result: {success}")

    print("\nPaths:")
    paths = initializer.get_paths()
    for name, path in paths.items():
        print(f"  {name}: {path}")

    print("\n" + "=" * 70)
