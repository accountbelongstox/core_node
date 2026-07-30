#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrcpy initialization module

Handles automatic extraction and initialization of scrcpy and adb tools
to user data directory. Supports local .pyp extraction and automatic download.
"""

import os
import sys
import zipfile
import tarfile
import platform
from pathlib import Path
from typing import Dict, Optional, Callable

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.robust_downloader import RobustDownloader
from pycore.pyfoundations.system_paths import get_system_cache_dir
from pycore.pyfoundations.serialized_worker import SerializedSingletonProvider

import shutil


# Download URLs for scrcpy packages
# Source: https://github.com/Genymobile/scrcpy/releases
SCRCPY_VERSION = "3.3.4"
SCRCPY_DOWNLOAD_URLS = {
    "windows": f"https://github.com/Genymobile/scrcpy/releases/download/v{SCRCPY_VERSION}/scrcpy-win64-v{SCRCPY_VERSION}.zip",
    "linux": f"https://github.com/Genymobile/scrcpy/releases/download/v{SCRCPY_VERSION}/scrcpy-linux-x86_64-v{SCRCPY_VERSION}.tar.gz",
    "darwin": f"https://github.com/Genymobile/scrcpy/releases/download/v{SCRCPY_VERSION}/scrcpy-macos-v{SCRCPY_VERSION}.zip",
}


class ScrcpyInitializer:
    """Initialize scrcpy and adb in user data directory"""

    def __init__(self):
        self.system = platform.system().lower()
        self.user_data_dir = self._get_user_data_dir()
        self.scrcpy_dir = self.user_data_dir / "scrcpy"
        self.project_root = Path(__file__).parent.parent.parent

        # Use RobustDownloader with retry support
        self._downloader = RobustDownloader(
            max_retries=5,
            timeout=90,
            chunk_size=8192,
            retry_delay=2.0,
            max_retry_delay=30.0
        )

    def _get_user_data_dir(self) -> Path:
        """Get user data directory based on OS (centralized via system_paths).

        Windows: D:\\programing\\Users\\<user>\\.core_node
        Linux:   /var/_core_node (else ~/.core_node)
        macOS:   ~/.core_node
        """
        # Centralized per-user state dir (see system_paths.get_system_cache_dir);
        # it already handles per-OS resolution + idempotent creation.
        return get_system_cache_dir()

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

    def _download_package(self) -> Optional[Path]:
        """
        Download scrcpy package to user data directory

        Returns:
            Path to downloaded package, or None if download failed
        """
        download_url = SCRCPY_DOWNLOAD_URLS.get(self.system)
        if not download_url:
            ColorPrint.plain(f"[ScrcpyInit] ERROR: No download URL for system: {self.system}")
            return None

        # Determine file extension
        if self.system == "linux":
            filename = f"scrcpy-linux-v{SCRCPY_VERSION}.tar.gz"
        else:
            filename = f"scrcpy-{self.system}-v{SCRCPY_VERSION}.zip"

        download_path = self.user_data_dir / filename

        if download_path.exists():
            ColorPrint.plain(f"[ScrcpyInit] Package already downloaded: {download_path}")
            return download_path

        ColorPrint.plain(f"[ScrcpyInit] Downloading scrcpy from: {download_url}")
        ColorPrint.plain(f"[ScrcpyInit] Destination: {download_path}")

        def progress_callback(downloaded: int, total: int, attempt: int):
            if total > 0:
                percent = (downloaded / total) * 100
                mb_downloaded = downloaded / 1024 / 1024
                mb_total = total / 1024 / 1024
                ColorPrint.plain(f"\r[ScrcpyInit] Attempt {attempt}/5: {percent:.1f}% ({mb_downloaded:.1f}/{mb_total:.1f} MB)", end='')

        success = self._downloader.download(download_url, download_path, progress_callback)

        if success:
            ColorPrint.plain(f"\n[ScrcpyInit] Download completed: {download_path.name}")
            return download_path
        else:
            ColorPrint.plain(f"\n[ScrcpyInit] ERROR: Download failed")
            return None

    def extract_package(self) -> bool:
        """Extract scrcpy package to user data directory"""
        package_path = None

        # Windows: Try local .pyp first, then download
        if self.system == "windows":
            package_path = self._get_package_path()
            if package_path and package_path.exists():
                ColorPrint.plain(f"[ScrcpyInit] Using local package: {package_path.name}")
            else:
                ColorPrint.plain(f"[ScrcpyInit] No local .pyp package found, downloading...")
                package_path = self._download_package()
        else:
            # Linux/macOS: Download directly
            ColorPrint.plain(f"[ScrcpyInit] Downloading package...")
            package_path = self._download_package()

        if not package_path:
            ColorPrint.plain(f"[ScrcpyInit] ERROR: Failed to obtain scrcpy package")
            return False

        if not package_path.exists():
            ColorPrint.plain(f"[ScrcpyInit] ERROR: Package not found: {package_path}")
            return False

        ColorPrint.plain(f"[ScrcpyInit] Extracting {package_path.name}...")
        ColorPrint.plain(f"[ScrcpyInit] Target directory: {self.scrcpy_dir}")

        try:
            # Create target directory
            self.scrcpy_dir.mkdir(parents=True, exist_ok=True)

            # Determine archive type and extract
            if package_path.suffix == '.gz' and package_path.stem.endswith('.tar'):
                # Extract tar.gz (Linux)
                with tarfile.open(package_path, 'r:gz') as tar_ref:
                    # Get root folder name
                    members = tar_ref.getmembers()
                    root_folder = members[0].name.split('/')[0] if members else None

                    # Extract all files (safe extraction; filter= added in Py 3.12, falls back on older)
                    try:
                        tar_ref.extractall(self.user_data_dir, filter='data')
                    except TypeError:
                        tar_ref.extractall(self.user_data_dir)

                    # If extracted to a subfolder, move contents up
                    if root_folder:
                        extracted_dir = self.user_data_dir / root_folder
                        if extracted_dir.exists() and extracted_dir != self.scrcpy_dir:
                            if self.scrcpy_dir.exists():
                                shutil.rmtree(self.scrcpy_dir)
                            extracted_dir.rename(self.scrcpy_dir)
            else:
                # Extract zip (Windows/macOS)
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
                                shutil.rmtree(self.scrcpy_dir)
                            extracted_dir.rename(self.scrcpy_dir)

            ColorPrint.plain(f"[ScrcpyInit] Extraction completed")

            # Set executable permissions on Linux/macOS
            if self.system in ["linux", "darwin"]:
                self._set_executable_permissions()

            return True

        except Exception as e:
            ColorPrint.plain(f"[ScrcpyInit] ERROR: Failed to extract package: {e}")
            return False

    def _set_executable_permissions(self):
        """Set executable permissions on binaries (Linux/macOS)"""
        executables = ["adb", "scrcpy"]

        for exe_name in executables:
            exe_path = self.scrcpy_dir / exe_name
            if exe_path.exists():
                exe_path.chmod(0o755)
                ColorPrint.plain(f"[ScrcpyInit] Set executable: {exe_name}")

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
            ColorPrint.plain(f"[ScrcpyInit] Already initialized at: {self.scrcpy_dir}")
            return True

        ColorPrint.plain(f"[ScrcpyInit] Initializing scrcpy...")
        return self.extract_package()


_INITIALIZER_PROVIDER = SerializedSingletonProvider(
    ScrcpyInitializer,
    "scrcpy.initializer.provider",
    "ScrcpyInitializerProvider",
)


def get_initializer() -> ScrcpyInitializer:
    """Get global ScrcpyInitializer instance"""
    return _INITIALIZER_PROVIDER.get()


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
    ColorPrint.plain("=" * 70)
    ColorPrint.plain("Scrcpy Initializer Test")
    ColorPrint.plain("=" * 70)

    initializer = get_initializer()

    ColorPrint.plain(f"\nSystem: {initializer.system}")
    ColorPrint.plain(f"User data dir: {initializer.user_data_dir}")
    ColorPrint.plain(f"Scrcpy dir: {initializer.scrcpy_dir}")

    ColorPrint.plain(f"\nInitialized: {initializer.is_initialized()}")

    if not initializer.is_initialized():
        ColorPrint.plain("\nInitializing...")
        success = initializer.initialize()
        ColorPrint.plain(f"Initialization result: {success}")

    ColorPrint.plain("\nPaths:")
    paths = initializer.get_paths()
    for name, path in paths.items():
        ColorPrint.plain(f"  {name}: {path}")

    ColorPrint.plain("\n" + "=" * 70)
