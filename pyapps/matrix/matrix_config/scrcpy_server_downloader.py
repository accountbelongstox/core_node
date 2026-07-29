#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrcpy Server JAR Downloader

Ensures scrcpy-server.jar is available for video streaming.
Downloads from GitHub if not found locally.

DEPRECATED: Use ScrcpyServerManager instead (pycore.pyutils.device.scrcpy_server_manager)
This file is kept for backward compatibility.
"""

from pathlib import Path
from typing import Optional, Callable

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.robust_downloader import RobustDownloader


class ScrcpyServerDownloader:
    """
    Download and ensure scrcpy-server.jar availability

    DEPRECATED: Use ScrcpyServerManager from pycore.pyutils.device.scrcpy_server_manager
    This class provides basic download functionality but lacks:
    - Jar validation (size check, header check)
    - Package extraction (GitHub standalone file is corrupted)
    - Path caching
    """

    # Scrcpy server version (must match VideoStreamService requirements)
    SCRCPY_VERSION = "3.3.4"

    # WARNING: Standalone scrcpy-server file on GitHub is CORRUPTED (88KB instead of 7MB+)
    # This URL will download a broken file. Use ScrcpyServerManager instead.
    # Source: https://github.com/Genymobile/scrcpy/releases
    SCRCPY_SERVER_URL = f"https://github.com/Genymobile/scrcpy/releases/download/v{SCRCPY_VERSION}/scrcpy-server-v{SCRCPY_VERSION}"

    def __init__(self, target_path: Path):
        """
        Initialize downloader

        Args:
            target_path: Target path for scrcpy-server.jar
        """
        self.target_path = Path(target_path)

    def is_available(self) -> bool:
        """Check if scrcpy-server.jar exists"""
        return self.target_path.exists() and self.target_path.is_file()

    def _try_copy_from_scrcpy_init(self) -> bool:
        """
        Try to copy scrcpy-server from scrcpy_init directory

        The scrcpy_init module downloads full scrcpy package to ~/.core_node/scrcpy/
        This includes scrcpy-server which we can copy to our resources directory.

        Returns:
            True if successfully copied, False otherwise
        """
        try:
            from pycore.pyutils.device.scrcpy_init import get_initializer

            initializer = get_initializer()

            # Check if scrcpy is initialized
            if not initializer.is_initialized():
                ColorPrint.yellow("[ScrcpyServerDownloader] Scrcpy not initialized, attempting to initialize...")
                if not initializer.initialize():
                    ColorPrint.red("[ScrcpyServerDownloader] Failed to initialize scrcpy")
                    return False

            # Look for scrcpy-server in the scrcpy directory
            scrcpy_dir = initializer.scrcpy_dir

            # scrcpy-server is in the scrcpy directory (no extension on all platforms)
            scrcpy_server_path = scrcpy_dir / "scrcpy-server"

            if scrcpy_server_path.exists():
                ColorPrint.green(f"[ScrcpyServerDownloader] Found scrcpy-server at: {scrcpy_server_path}")

                # Create target directory if needed
                self.target_path.parent.mkdir(parents=True, exist_ok=True)

                # Copy to target (rename to scrcpy-server.jar)
                import shutil
                shutil.copy2(scrcpy_server_path, self.target_path)

                ColorPrint.green(f"[ScrcpyServerDownloader] ✓ Copied scrcpy-server to: {self.target_path}")
                return True
            else:
                ColorPrint.yellow(f"[ScrcpyServerDownloader] scrcpy-server not found at: {scrcpy_server_path}")
                return False

        except Exception as e:
            ColorPrint.red(f"[ScrcpyServerDownloader] Error copying from scrcpy_init: {e}")
            return False

    def download(self, progress_callback: Optional[Callable[[int, int, int], None]] = None) -> bool:
        """
        Download scrcpy-server.jar from GitHub using RobustDownloader

        WARNING: GitHub's standalone scrcpy-server file is CORRUPTED (88KB instead of 7MB+)
        This method will download the broken file. Use ScrcpyServerManager instead.

        Args:
            progress_callback: Optional callback(downloaded_bytes, total_bytes, attempt)

        Returns:
            True if download successful, False otherwise
        """
        ColorPrint.blue("=" * 80)
        ColorPrint.red("[ScrcpyServerDownloader] WARNING: This downloader is DEPRECATED")
        ColorPrint.red("[ScrcpyServerDownloader] GitHub's standalone scrcpy-server file is CORRUPTED")
        ColorPrint.red("[ScrcpyServerDownloader] Use ScrcpyServerManager instead:")
        ColorPrint.yellow("[ScrcpyServerDownloader] from pycore.pyutils.device.scrcpy_server_manager import get_scrcpy_server_manager")
        ColorPrint.blue("=" * 80)
        ColorPrint.cyan(f"[ScrcpyServerDownloader] Version: {self.SCRCPY_VERSION}")
        ColorPrint.cyan(f"[ScrcpyServerDownloader] URL: {self.SCRCPY_SERVER_URL}")
        ColorPrint.cyan(f"[ScrcpyServerDownloader] Target: {self.target_path}")

        # Create target directory
        self.target_path.parent.mkdir(parents=True, exist_ok=True)

        # Use RobustDownloader with retry support
        downloader = RobustDownloader(
            max_retries=5,
            timeout=60,
            chunk_size=8192,
            retry_delay=2.0,
            max_retry_delay=30.0
        )

        def default_progress_callback(downloaded: int, total: int, attempt: int):
            if total > 0:
                percent = (downloaded / total) * 100
                mb_downloaded = downloaded / 1024 / 1024
                mb_total = total / 1024 / 1024
                print(f"\r[ScrcpyServerDownloader] Attempt {attempt}/5: {percent:.1f}% ({mb_downloaded:.2f}/{mb_total:.2f} MB)", end='')

        callback = progress_callback if progress_callback else default_progress_callback
        success = downloader.download(self.SCRCPY_SERVER_URL, self.target_path, callback)

        if success:
            print()  # New line after progress
            ColorPrint.green("=" * 80)
            ColorPrint.green(f"[ScrcpyServerDownloader] ✓ Download completed")
            ColorPrint.yellow(f"[ScrcpyServerDownloader] WARNING: File may be corrupted (check size)")
            ColorPrint.green(f"[ScrcpyServerDownloader] ✓ Saved to: {self.target_path}")
            ColorPrint.green("=" * 80)
        else:
            print()  # New line before error
            ColorPrint.red("=" * 80)
            ColorPrint.red(f"[ScrcpyServerDownloader] ✗ Download failed")
            ColorPrint.red("=" * 80)

        return success

    def ensure_available(self, auto_download: bool = True) -> bool:
        """
        Ensure scrcpy-server.jar is available

        Strategy:
        1. Check if already exists
        2. Try to copy from scrcpy_init directory
        3. Download from GitHub (if auto_download=True)

        Args:
            auto_download: Whether to auto-download if not found locally

        Returns:
            True if scrcpy-server.jar is available, False otherwise
        """
        # Step 1: Check if already exists
        if self.is_available():
            ColorPrint.green(f"[ScrcpyServerDownloader] ✓ scrcpy-server.jar already exists at: {self.target_path}")
            return True

        ColorPrint.yellow(f"[ScrcpyServerDownloader] scrcpy-server.jar not found at: {self.target_path}")

        # Step 2: Try to copy from scrcpy_init directory
        ColorPrint.blue("[ScrcpyServerDownloader] Attempting to copy from scrcpy_init directory...")
        if self._try_copy_from_scrcpy_init():
            return True

        # Step 3: Download from GitHub
        if auto_download:
            ColorPrint.blue("[ScrcpyServerDownloader] Attempting to download from GitHub...")
            return self.download()
        else:
            ColorPrint.red("[ScrcpyServerDownloader] ✗ Auto-download disabled")
            return False


def ensure_scrcpy_server_jar(target_path: Path, auto_download: bool = True) -> bool:
    """
    Convenience function to ensure scrcpy-server.jar is available

    Args:
        target_path: Target path for scrcpy-server.jar
        auto_download: Whether to auto-download if not found

    Returns:
        True if available, False otherwise
    """
    downloader = ScrcpyServerDownloader(target_path)
    return downloader.ensure_available(auto_download)


if __name__ == "__main__":
    # Test the downloader
    from pyapps.matrix.matrix_config import Config

    ColorPrint.blue("=" * 80)
    ColorPrint.blue("ScrcpyServerDownloader Test")
    ColorPrint.blue("=" * 80)

    target = Config.get_scrcpy_server_jar()
    ColorPrint.cyan(f"Target path: {target}")

    downloader = ScrcpyServerDownloader(target)

    ColorPrint.blue(f"\nCurrent status: {'Available' if downloader.is_available() else 'Not available'}")

    if not downloader.is_available():
        ColorPrint.blue("\nEnsuring scrcpy-server.jar is available...")
        success = downloader.ensure_available()

        if success:
            ColorPrint.green("\n✓ scrcpy-server.jar is now available")
        else:
            ColorPrint.red("\n✗ Failed to ensure scrcpy-server.jar availability")

    ColorPrint.blue("=" * 80)
