#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrcpy Server JAR Downloader

Ensures scrcpy-server.jar is available for video streaming.
Downloads from GitHub if not found locally.
"""

import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Callable

from pycore import ColorPrint


class ScrcpyServerDownloader:
    """Download and ensure scrcpy-server.jar availability"""

    # Scrcpy server version (must match VideoStreamService requirements)
    SCRCPY_VERSION = "3.3.3"

    # GitHub download URL for scrcpy-server.jar
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
            from pycore.pyutils.scrcpy_init import get_initializer

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

    def download(self, progress_callback: Optional[Callable[[int, int], None]] = None) -> bool:
        """
        Download scrcpy-server.jar from GitHub

        Args:
            progress_callback: Optional callback(downloaded_bytes, total_bytes)

        Returns:
            True if download successful, False otherwise
        """
        import sys
        import time

        try:
            ColorPrint.blue("=" * 80)
            ColorPrint.blue("[ScrcpyServerDownloader] Downloading scrcpy-server.jar")
            ColorPrint.blue("=" * 80)
            ColorPrint.cyan(f"[ScrcpyServerDownloader] Version: {self.SCRCPY_VERSION}")
            ColorPrint.cyan(f"[ScrcpyServerDownloader] URL: {self.SCRCPY_SERVER_URL}")
            ColorPrint.cyan(f"[ScrcpyServerDownloader] Target: {self.target_path}")

            # Create target directory
            self.target_path.parent.mkdir(parents=True, exist_ok=True)

            # Download with real-time progress
            with urllib.request.urlopen(self.SCRCPY_SERVER_URL) as response:
                total_size = int(response.headers.get('Content-Length', 0))
                downloaded = 0

                ColorPrint.blue(f"[ScrcpyServerDownloader] File size: {total_size / 1024 / 1024:.2f} MB")
                print()  # Blank line before progress bar

                # Use temporary file during download
                temp_path = self.target_path.with_suffix('.tmp')

                # Track download speed
                start_time = time.time()
                last_update_time = start_time
                last_downloaded = 0

                with open(temp_path, 'wb') as f:
                    chunk_size = 8192
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break

                        f.write(chunk)
                        downloaded += len(chunk)

                        # Update progress (throttle to ~10 updates per second)
                        current_time = time.time()
                        if current_time - last_update_time >= 0.1 or downloaded == total_size:
                            if progress_callback and total_size > 0:
                                progress_callback(downloaded, total_size)
                            elif total_size > 0:
                                # Calculate download speed
                                elapsed = current_time - start_time
                                if elapsed > 0:
                                    speed_bps = downloaded / elapsed
                                    speed_mbps = speed_bps / 1024 / 1024
                                else:
                                    speed_mbps = 0

                                # Calculate ETA
                                if speed_bps > 0:
                                    remaining_bytes = total_size - downloaded
                                    eta_seconds = remaining_bytes / speed_bps
                                    eta_mins = int(eta_seconds // 60)
                                    eta_secs = int(eta_seconds % 60)
                                    eta_str = f"{eta_mins}m {eta_secs}s" if eta_mins > 0 else f"{eta_secs}s"
                                else:
                                    eta_str = "calculating..."

                                # Progress bar
                                percent = (downloaded / total_size) * 100
                                mb_downloaded = downloaded / 1024 / 1024
                                mb_total = total_size / 1024 / 1024

                                # Create progress bar (50 characters wide)
                                bar_width = 50
                                filled = int(bar_width * downloaded / total_size)
                                bar = '█' * filled + '░' * (bar_width - filled)

                                # Real-time progress output with \r to overwrite same line
                                print(f"\r[INFO] [{bar}] {percent:.1f}% | {mb_downloaded:.2f}/{mb_total:.2f} MB | {speed_mbps:.2f} MB/s | ETA: {eta_str}", end='', flush=True)

                            last_update_time = current_time
                            last_downloaded = downloaded

                # Move temp file to final location
                temp_path.rename(self.target_path)

                print()  # New line after progress bar
                print()  # Extra blank line
                ColorPrint.green("=" * 80)
                ColorPrint.green(f"[ScrcpyServerDownloader] ✓ Download completed successfully")
                ColorPrint.green(f"[ScrcpyServerDownloader] ✓ Saved to: {self.target_path}")
                ColorPrint.green("=" * 80)

                return True

        except urllib.error.URLError as e:
            print()  # New line before error
            ColorPrint.red("=" * 80)
            ColorPrint.red(f"[ScrcpyServerDownloader] ✗ Download failed: {e}")
            ColorPrint.red("=" * 80)
            return False
        except Exception as e:
            print()  # New line before error
            ColorPrint.red("=" * 80)
            ColorPrint.red(f"[ScrcpyServerDownloader] ✗ Unexpected error: {e}")
            ColorPrint.red("=" * 80)
            return False

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
