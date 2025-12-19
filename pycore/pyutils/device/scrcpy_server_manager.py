"""
Scrcpy Server Manager

Centralized management for scrcpy-server.jar lifecycle:
- Ensure local jar exists (auto-download if needed)
- Check jar exists on device
- Push jar to device (with optimization)
- Hash verification

Decouples jar management from VideoStreamService and ConnectionManager.
"""

import asyncio
import subprocess
import hashlib
from pathlib import Path
from typing import Optional

from pycore import ColorPrint


class ScrcpyServerManager:
    """
    Centralized scrcpy-server.jar manager

    Responsibilities:
    - Ensure local jar file exists
    - Check if jar exists on device
    - Push jar to device with optimization
    - Hash-based verification
    """

    def __init__(self, adb_path: str, jar_path: str):
        """
        Initialize scrcpy server manager

        Args:
            adb_path: Path to ADB executable
            jar_path: Path to local scrcpy-server.jar
        """
        self.adb_path = adb_path
        self.jar_path = Path(jar_path)

        # Cache for local jar hash (avoid recalculating)
        self._local_hash_cache: Optional[str] = None

    def ensure_local_jar(self, auto_download: bool = True) -> bool:
        """
        Ensure scrcpy-server.jar exists locally

        Args:
            auto_download: Auto-download if not exists (default: True)

        Returns:
            True if jar exists, False otherwise
        """
        # Quick check - if exists, return immediately
        if self.jar_path.exists():
            return True

        if not auto_download:
            ColorPrint.red(f"[ScrcpyServerManager] jar not found at {self.jar_path}")
            return False

        # Auto-download logic
        ColorPrint.yellow(f"[ScrcpyServerManager] jar not found, attempting auto-download...")

        try:
            from pyapps.matrix.matrix_config.scrcpy_server_downloader import ensure_scrcpy_server_jar
            success = ensure_scrcpy_server_jar(self.jar_path, auto_download=True)

            if success:
                ColorPrint.green("[ScrcpyServerManager] ✓ jar is now available")
                # Invalidate hash cache
                self._local_hash_cache = None
                return True
            else:
                ColorPrint.red("[ScrcpyServerManager] ✗ Failed to download jar")
                return False

        except Exception as e:
            ColorPrint.red(f"[ScrcpyServerManager] ✗ Error ensuring jar: {e}")
            import traceback
            traceback.print_exc()
            return False

    def get_local_hash(self) -> Optional[str]:
        """
        Get MD5 hash of local jar file (with caching)

        Returns:
            MD5 hash string, or None if error
        """
        if not self.jar_path.exists():
            return None

        # Return cached hash if available
        if self._local_hash_cache:
            return self._local_hash_cache

        try:
            with open(self.jar_path, 'rb') as f:
                local_hash = hashlib.md5(f.read()).hexdigest()

            # Cache for future use
            self._local_hash_cache = local_hash
            return local_hash

        except Exception as e:
            ColorPrint.yellow(f"[ScrcpyServerManager] Error calculating local hash: {e}")
            return None

    async def check_jar_on_device(self, serial: str) -> bool:
        """
        Check if scrcpy-server.jar exists on device with correct hash

        Args:
            serial: Device serial number

        Returns:
            True if jar exists and hash matches, False otherwise
        """
        try:
            loop = asyncio.get_event_loop()

            # Check if jar exists on device
            check_result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    [self.adb_path, "-s", serial, "shell", "test -f /data/local/tmp/scrcpy-server.jar && echo exists"],
                    capture_output=True,
                    text=True,
                    timeout=3
                )
            )

            if check_result.returncode != 0 or "exists" not in check_result.stdout:
                ColorPrint.yellow(f"[ScrcpyServerManager] jar not found on {serial}")
                return False

            # Get local jar hash
            local_hash = self.get_local_hash()
            if not local_hash:
                ColorPrint.yellow(f"[ScrcpyServerManager] Cannot get local hash")
                return False

            # Get device jar hash
            hash_result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    [self.adb_path, "-s", serial, "shell", "md5sum /data/local/tmp/scrcpy-server.jar"],
                    capture_output=True,
                    text=True,
                    timeout=3
                )
            )

            if hash_result.returncode != 0:
                ColorPrint.yellow(f"[ScrcpyServerManager] Failed to get device jar hash for {serial}")
                return False

            # Parse md5sum output (format: "hash filename")
            device_hash = hash_result.stdout.split()[0] if hash_result.stdout else ""

            if local_hash == device_hash:
                ColorPrint.green(f"[ScrcpyServerManager] ✓ jar on {serial} (hash match: {local_hash[:8]})")
                return True
            else:
                ColorPrint.yellow(f"[ScrcpyServerManager] jar hash mismatch on {serial} (local:{local_hash[:8]} device:{device_hash[:8]})")
                return False

        except Exception as e:
            ColorPrint.yellow(f"[ScrcpyServerManager] Error checking jar on {serial}: {e}")
            return False

    async def push_jar_to_device(self, serial: str, force: bool = False) -> bool:
        """
        Push scrcpy-server.jar to device (with smart optimization)

        Optimization strategy:
        1. Check if jar exists on device
        2. Verify hash matches local jar
        3. Only push if not exists or hash mismatch

        Args:
            serial: Device serial number
            force: Force push even if jar exists (default: False)

        Returns:
            True if successful, False otherwise
        """
        if not self.jar_path.exists():
            ColorPrint.red(f"[ScrcpyServerManager] jar not found at {self.jar_path}")
            return False

        # Optimization: Check if jar already exists with correct hash
        if not force and await self.check_jar_on_device(serial):
            ColorPrint.blue(f"[ScrcpyServerManager] Skipping push for {serial} (jar already exists)")
            return True

        # Need to push jar
        ColorPrint.blue(f"[ScrcpyServerManager] Pushing jar to {serial}...")

        try:
            loop = asyncio.get_event_loop()
            push_result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    [self.adb_path, "-s", serial, "push", str(self.jar_path), "/data/local/tmp/scrcpy-server.jar"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
            )

            if push_result.returncode != 0:
                ColorPrint.red(f"[ScrcpyServerManager] Failed to push jar: {push_result.stderr}")
                return False

            ColorPrint.green(f"[ScrcpyServerManager] ✓ jar pushed to {serial}")
            return True

        except Exception as e:
            ColorPrint.red(f"[ScrcpyServerManager] Exception pushing jar: {e}")
            return False


__all__ = ['ScrcpyServerManager']
