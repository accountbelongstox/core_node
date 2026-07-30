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
import hashlib
import shutil
import subprocess
import zipfile
from contextlib import nullcontext
from pathlib import Path
from typing import Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.robust_downloader import RobustDownloader
from pycore.pyutils.device.scrcpy_init import get_initializer
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    SerializedWorkerThread,
    await_bus_task,
    call_serialized,
    map_bus_tasks,
)

import traceback



# Process-wide owner for jar validation and downloads.
_DOWNLOAD_QUEUE = 'pyutils.device.scrcpy_server.download'
_DOWNLOAD_WORKER = SerializedWorkerThread(
    _DOWNLOAD_QUEUE,
    'ScrcpyServerDownloadThread',
)
_DOWNLOAD_WORKER.start()
_DOWNLOAD_STATE = {
    'downloading': False,
    'jar_initialized': False,
}


def _push_jar_to_device(payload: Dict[str, object]) -> Dict[str, object]:
    """Push one jar; request and result are delivered through THREAD_BUS."""
    serial = str(payload["serial"])
    adb_path = str(payload["adb_path"])
    jar_path = Path(payload["jar_path"])
    local_hash = str(payload["local_hash"])
    result: Dict[str, object] = {
        "serial": serial,
        "success": False,
        "error": None,
        "skipped": False,
    }
    try:
        ColorPrint.blue(f"[JarPushThread] [{serial}] Starting jar push check...")
        check_result = subprocess.run(
            [adb_path, "-s", serial, "shell", "test -f /data/local/tmp/scrcpy-server && echo exists"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if check_result.returncode == 0 and "exists" in check_result.stdout:
            hash_result = subprocess.run(
                [adb_path, "-s", serial, "shell", "md5sum /data/local/tmp/scrcpy-server"],
                capture_output=True,
                text=True,
                timeout=3,
            )
            if hash_result.returncode == 0:
                device_hash = hash_result.stdout.split()[0] if hash_result.stdout else ""
                if device_hash == local_hash:
                    ColorPrint.green(
                        f"[JarPushThread] [{serial}] Jar correct "
                        f"(hash: {device_hash[:8]}), skipping push"
                    )
                    result["success"] = True
                    result["skipped"] = True
                    return result

        ColorPrint.blue(f"[JarPushThread] [{serial}] Removing old jar...")
        subprocess.run(
            [adb_path, "-s", serial, "shell", "rm -f /data/local/tmp/scrcpy-server"],
            capture_output=True,
            timeout=3,
        )
        ColorPrint.blue(f"[JarPushThread] [{serial}] Pushing jar...")
        push_result = subprocess.run(
            [adb_path, "-s", serial, "push", str(jar_path), "//data/local/tmp/scrcpy-server"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if push_result.returncode != 0:
            result["error"] = f"Push failed: {push_result.stderr}"
            ColorPrint.red(f"[JarPushThread] [{serial}] {result['error']}")
            return result
        verify_result = subprocess.run(
            [adb_path, "-s", serial, "shell", "test -f /data/local/tmp/scrcpy-server && echo exists"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if verify_result.returncode == 0 and "exists" in verify_result.stdout:
            ColorPrint.green(f"[JarPushThread] [{serial}] Jar pushed and verified")
            result["success"] = True
        else:
            result["error"] = "Verification failed - file not found after push"
            ColorPrint.red(f"[JarPushThread] [{serial}] {result['error']}")
    except Exception as exc:  # noqa: BLE001
        result["error"] = f"Exception: {exc}"
        ColorPrint.red(f"[JarPushThread] [{serial}] {result['error']}")
    return result


class ScrcpyServerManager:
    """
    Centralized scrcpy-server.jar manager

    Responsibilities:
    - Ensure local jar file exists
    - Check if jar exists on device
    - Push jar to device with optimization
    - Hash-based verification
    """

    # Expected file size for scrcpy-server.jar (typically 50KB-200KB)
    # Note: This is the standalone jar, NOT the full scrcpy package (~7MB)
    EXPECTED_MIN_SIZE = 30 * 1024  # 30KB minimum
    EXPECTED_MAX_SIZE = 500 * 1024  # 500KB maximum (to detect wrong file)
    SCRCPY_VERSION = "3.3.4"  # CRITICAL: Must match version in scrcpy_device.py startup command
    # Download full package to extract scrcpy-server (standalone file on GitHub is broken)
    GITHUB_PACKAGE_URL = f"https://github.com/Genymobile/scrcpy/releases/download/v{SCRCPY_VERSION}/scrcpy-win64-v{SCRCPY_VERSION}.zip"

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

        # Cache for correct jar path (avoid re-validation)
        self._validated_jar_path: Optional[Path] = None

    def _is_jar_valid(self, jar_path: Path) -> bool:
        """
        Validate jar file (check size and format)

        Args:
            jar_path: Path to jar file

        Returns:
            True if jar is valid
        """
        if not jar_path.exists():
            return False

        file_size = jar_path.stat().st_size

        # Check size range (scrcpy-server.jar should be 50KB-200KB typically)
        if file_size < self.EXPECTED_MIN_SIZE:
            ColorPrint.yellow(f"[ScrcpyServerManager] Jar too small: {file_size} bytes (expected >={self.EXPECTED_MIN_SIZE/1024:.0f}KB)")
            return False

        if file_size > self.EXPECTED_MAX_SIZE:
            ColorPrint.yellow(f"[ScrcpyServerManager] Jar too large: {file_size} bytes (expected <={self.EXPECTED_MAX_SIZE/1024:.0f}KB)")
            ColorPrint.yellow(f"[ScrcpyServerManager] Hint: This might be the full scrcpy package instead of scrcpy-server.jar")
            return False

        # Check file header (should be ZIP/JAR format: PK\x03\x04)
        try:
            with open(jar_path, 'rb') as f:
                header = f.read(4)
                if header != b'PK\x03\x04':
                    ColorPrint.yellow(f"[ScrcpyServerManager] Invalid jar format (not a ZIP/JAR file)")
                    return False
        except Exception as e:
            ColorPrint.yellow(f"[ScrcpyServerManager] Error reading jar: {e}")
            return False

        # Additional validation: Check for classes.dex (key content of scrcpy-server.jar)
        try:
            with zipfile.ZipFile(jar_path, 'r') as zf:
                namelist = zf.namelist()
                if 'classes.dex' not in namelist:
                    ColorPrint.yellow(f"[ScrcpyServerManager] Invalid jar content: classes.dex not found")
                    ColorPrint.yellow(f"[ScrcpyServerManager] Files in jar: {namelist[:5]}")
                    return False
        except Exception as e:
            ColorPrint.yellow(f"[ScrcpyServerManager] Error validating jar content: {e}")
            return False

        return True

    def _download_jar_from_github(self, dest_path: Path) -> bool:
        """
        Download scrcpy package from GitHub and extract scrcpy-server

        The standalone scrcpy-server file on GitHub is broken (only 88KB).
        We need to download the full package and extract the correct file.

        Args:
            dest_path: Destination path for extracted scrcpy-server.jar

        Returns:
            True if download and extraction successful
        """
        try:
            ColorPrint.blue(f"[ScrcpyServerManager] Downloading scrcpy package v{self.SCRCPY_VERSION} from GitHub...")
            ColorPrint.blue(f"[ScrcpyServerManager] URL: {self.GITHUB_PACKAGE_URL}")

            # Create parent directory
            dest_path.parent.mkdir(parents=True, exist_ok=True)

            # Download zip package using robust downloader
            temp_zip_path = dest_path.parent / f"scrcpy-win64-v{self.SCRCPY_VERSION}.zip"

            downloader = RobustDownloader(
                max_retries=5,
                timeout=60,
                retry_delay=2.0,
                max_retry_delay=30.0
            )

            def progress_callback(downloaded: int, total: int, attempt: int):
                if total > 0:
                    percent = (downloaded / total) * 100
                    mb_downloaded = downloaded / 1024 / 1024
                    mb_total = total / 1024 / 1024
                    ColorPrint.plain(f"\r[ScrcpyServerManager] Attempt {attempt}/5: {percent:.1f}% ({mb_downloaded:.1f}/{mb_total:.1f} MB)", end='')

            # Download with retry
            if not downloader.download(self.GITHUB_PACKAGE_URL, temp_zip_path, progress_callback):
                ColorPrint.red(f"[ScrcpyServerManager] Failed to download package after retries")
                return False

            ColorPrint.plain()  # New line after progress

            # Extract scrcpy-server from zip
            ColorPrint.blue(f"[ScrcpyServerManager] Extracting scrcpy-server from package...")

            temp_extracted_path = dest_path.with_suffix('.tmp')

            with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
                # Find scrcpy-server in zip (usually in scrcpy-win64-v3.3.4/scrcpy-server)
                server_filename = None
                for name in zip_ref.namelist():
                    if name.endswith('scrcpy-server') and not name.endswith('/'):
                        server_filename = name
                        break

                if not server_filename:
                    ColorPrint.red(f"[ScrcpyServerManager] scrcpy-server not found in package!")
                    temp_zip_path.unlink()
                    return False

                ColorPrint.blue(f"[ScrcpyServerManager] Found: {server_filename}")

                # Extract to temp path
                with zip_ref.open(server_filename) as source:
                    with open(temp_extracted_path, 'wb') as target:
                        target.write(source.read())

            # Clean up zip file
            temp_zip_path.unlink()

            # Validate extracted file
            if not self._is_jar_valid(temp_extracted_path):
                ColorPrint.red(f"[ScrcpyServerManager] Extracted file is invalid!")
                temp_extracted_path.unlink()
                return False

            # Move temp to final destination
            if dest_path.exists():
                dest_path.unlink()
            temp_extracted_path.rename(dest_path)

            ColorPrint.green(f"[ScrcpyServerManager] ✓ Extracted scrcpy-server.jar ({dest_path.stat().st_size} bytes)")
            return True

        except Exception as e:
            ColorPrint.red(f"[ScrcpyServerManager] Download/extraction failed: {e}")
            traceback.print_exc()
            return False

    def _ensure_local_jar(self, auto_download: bool = True) -> bool:
        """
        Ensure scrcpy-server.jar is available on the serialized download owner.

        ✅ MODULE-LEVEL SINGLETON PATTERN:
        - First call (in matrix_main.py): Download/validate jar, set _jar_initialized=True
        - Subsequent calls: Return immediately if _jar_initialized=True
        - This prevents redundant checks when multiple devices connect

        Strategy:
        1. Check module-level initialization flag (fastest path)
        2. Check if already validated and cached (fast path, no lock)
        3. Continue on the process-wide serialized download owner
        4. Check configured jar_path
        5. Check scrcpy_init directory
        6. Download from GitHub if not found or invalid

        Args:
            auto_download: Auto-download if not exists (default: True)

        Returns:
            True if jar exists and is valid
        """
        # ========== FASTEST PATH: Module-level initialization complete ==========
        if _DOWNLOAD_STATE['jar_initialized']:
            return True

        # ========== FAST PATH: Use cached path if validated (no lock needed) ==========
        if self._validated_jar_path and self._validated_jar_path.exists():
            # Quick validation without re-reading file
            try:
                file_size = self._validated_jar_path.stat().st_size
                if file_size >= self.EXPECTED_MIN_SIZE:
                    _DOWNLOAD_STATE['jar_initialized'] = True
                    return True
            except:
                pass

            # Full validation if quick check failed
            if self._is_jar_valid(self._validated_jar_path):
                _DOWNLOAD_STATE['jar_initialized'] = True
                return True
            else:
                ColorPrint.yellow(f"[ScrcpyServerManager] Cached jar became invalid, re-validating...")
                self._validated_jar_path = None

        # ========== SLOW PATH: Need to check/download on the owner ==============
        with _download_scope:
            # Double-check after acquiring lock (another thread may have downloaded)
            if self._validated_jar_path and self._validated_jar_path.exists():
                if self._is_jar_valid(self._validated_jar_path):
                    ColorPrint.blue("[ScrcpyServerManager] ✓ Jar validated by another thread")
                    return True

            # Check if another thread is currently downloading
            if _DOWNLOAD_STATE['downloading']:
                ColorPrint.yellow("[ScrcpyServerManager] Download in progress by another thread, waiting...")
                # Release lock and wait for download to complete
                # The downloading thread will set _downloading=False when done

            # Check configured jar_path
            if self.jar_path.exists():
                if self._is_jar_valid(self.jar_path):
                    ColorPrint.green(f"[ScrcpyServerManager] ✓ Valid jar found at: {self.jar_path}")
                    self._validated_jar_path = self.jar_path
                    self._local_hash_cache = None  # Reset hash cache
                    _DOWNLOAD_STATE['jar_initialized'] = True
                    return True
                else:
                    ColorPrint.yellow(f"[ScrcpyServerManager] Invalid jar at {self.jar_path}, will download new one")

            # Check scrcpy_init directory
            try:
                initializer = get_initializer()
                scrcpy_init_jar = initializer.scrcpy_dir / "scrcpy-server"

                if scrcpy_init_jar.exists() and self._is_jar_valid(scrcpy_init_jar):
                    ColorPrint.green(f"[ScrcpyServerManager] ✓ Valid jar found in scrcpy_init: {scrcpy_init_jar}")

                    # Copy to configured location
                    self.jar_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(scrcpy_init_jar, self.jar_path)

                    self._validated_jar_path = self.jar_path
                    self._local_hash_cache = None
                    _DOWNLOAD_STATE['jar_initialized'] = True
                    return True
            except Exception as e:
                ColorPrint.yellow(f"[ScrcpyServerManager] Could not check scrcpy_init: {e}")

            # Need to download
            if not auto_download:
                ColorPrint.red(f"[ScrcpyServerManager] No valid jar found and auto_download=False")
                return False

            # Set downloading flag to prevent other threads from downloading
            _DOWNLOAD_STATE['downloading'] = True
            ColorPrint.blue("[ScrcpyServerManager] Starting serialized download")

            try:
                # Download from GitHub
                if self._download_jar_from_github(self.jar_path):
                    self._validated_jar_path = self.jar_path
                    self._local_hash_cache = None
                    _DOWNLOAD_STATE['jar_initialized'] = True
                    ColorPrint.green("[ScrcpyServerManager] ✓ Download complete, jar initialized globally")
                    return True
                else:
                    ColorPrint.red("[ScrcpyServerManager] ✗ Failed to download jar")
                    return False
            finally:
                # Always release downloading flag
                _DOWNLOAD_STATE['downloading'] = False

    def ensure_local_jar(self, auto_download: bool = True) -> bool:
        """Ensure the jar through the process-wide download owner thread."""
        return call_serialized(
            _DOWNLOAD_QUEUE,
            self._ensure_local_jar,
            auto_download,
            timeout=600.0,
        )

    def get_local_hash(self) -> Optional[str]:
        """
        Get MD5 hash of local jar file (with caching)

        Returns:
            MD5 hash string, or None if error
        """
        # Use validated path if available
        jar_to_hash = self._validated_jar_path if self._validated_jar_path else self.jar_path

        if not jar_to_hash.exists():
            return None

        # Return cached hash if available
        if self._local_hash_cache:
            return self._local_hash_cache

        try:
            with open(jar_to_hash, 'rb') as f:
                local_hash = hashlib.md5(f.read()).hexdigest()

            # Cache for future use
            self._local_hash_cache = local_hash
            return local_hash

        except Exception as e:
            ColorPrint.yellow(f"[ScrcpyServerManager] Error calculating local hash: {e}")
            return None

    def batch_push_jars(self, serials: List[str]) -> Dict[str, bool]:
        """
        Push jars to multiple devices through THREAD_BUS-backed worker threads.

        Args:
            serials: List of device serial numbers

        Returns:
            Dict mapping serial to success status
        """
        # Ensure local jar is valid
        if not self.ensure_local_jar(auto_download=True):
            ColorPrint.red("[ScrcpyServerManager] Cannot ensure local jar for batch push")
            return {serial: False for serial in serials}

        # Get jar path and hash
        jar_to_push = self._validated_jar_path if self._validated_jar_path else self.jar_path
        local_hash = self.get_local_hash()

        if not local_hash:
            ColorPrint.red("[ScrcpyServerManager] Cannot get local jar hash for batch push")
            return {serial: False for serial in serials}

        ColorPrint.blue(f"[ScrcpyServerManager] Starting batch push for {len(serials)} devices (parallel threads)...")

        payloads = [
            {
                "serial": serial,
                "adb_path": self.adb_path,
                "jar_path": jar_to_push,
                "local_hash": local_hash,
            }
            for serial in serials
        ]
        lane_results = map_bus_tasks(
            _push_jar_to_device,
            payloads,
            max_workers=max(1, len(payloads)),
            thread_prefix="JarPush",
            timeout=30.0,
        )
        results = {}
        skipped_count = 0
        pushed_count = 0
        failed_count = 0

        for lane_result in lane_results:
            serial = str(lane_result.get("serial") or "")
            success = bool(lane_result.get("success"))
            results[serial] = success
            if success:
                if lane_result.get("skipped"):
                    skipped_count += 1
                else:
                    pushed_count += 1
            else:
                failed_count += 1
                if lane_result.get("error"):
                    ColorPrint.red(
                        f"[ScrcpyServerManager] {serial}: {lane_result['error']}"
                    )

        ColorPrint.green(
            f"[ScrcpyServerManager] Batch push complete: "
            f"{pushed_count} pushed, {skipped_count} skipped, {failed_count} failed"
        )

        return results

    async def check_jar_on_device(self, serial: str) -> bool:
        """
        Check if scrcpy-server.jar exists on device with correct hash

        Args:
            serial: Device serial number

        Returns:
            True if jar exists and hash matches, False otherwise
        """
        try:
            # Check if jar exists on device
            # NOTE: Shell commands don't need // prefix because the path is inside a shell string
            # Git Bash only translates paths that are separate command arguments
            # CRITICAL: Filename must be 'scrcpy-server' (no .jar extension) to match official scrcpy
            check_result = await await_bus_task(
                lambda: subprocess.run(
                    [self.adb_path, "-s", serial, "shell", "test -f /data/local/tmp/scrcpy-server && echo exists"],
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
            hash_result = await await_bus_task(
                lambda: subprocess.run(
                    [self.adb_path, "-s", serial, "shell", "md5sum /data/local/tmp/scrcpy-server"],
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
        Push scrcpy-server.jar to device (idempotent self-healing approach)

        IDEMPOTENT STRATEGY (always execute all steps, never skip):
        1. ALWAYS ensure local jar is valid (download if needed)
        2. ALWAYS remove old jar from device (cleanup stale versions)
        3. ALWAYS push new jar to device (ensure correct version)
        4. ALWAYS verify push success (final validation)

        This ensures version consistency and self-healing on every run,
        regardless of previous state or cached checks.

        Args:
            serial: Device serial number
            force: Ignored (kept for API compatibility, always force push)

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.blue(f"[ScrcpyServerManager] Starting idempotent push for {serial}...")

        # ========== STEP 1: ALWAYS ensure local jar is valid ==========
        if not self.ensure_local_jar(auto_download=True):
            ColorPrint.red(f"[ScrcpyServerManager] [STEP 1/4 FAILED] Cannot ensure local jar")
            return False
        ColorPrint.green(f"[ScrcpyServerManager] [STEP 1/4 OK] Local jar validated")

        # Use validated path
        jar_to_push = self._validated_jar_path if self._validated_jar_path else self.jar_path

        # ========== STEP 2: ALWAYS remove old jar from device ==========
        # CRITICAL: Always remove to prevent version mismatch (e.g., old 3.3.4 vs new 3.3.3)
        # Do NOT skip this step even if hash check passes - file may be corrupted
        ColorPrint.blue(f"[ScrcpyServerManager] [STEP 2/4] Removing old jar on {serial}...")
        try:
            remove_result = await await_bus_task(
                lambda: subprocess.run(
                    [self.adb_path, "-s", serial, "shell", "rm -f /data/local/tmp/scrcpy-server"],
                    capture_output=True,
                    text=True,
                    timeout=3
                )
            )
            if remove_result.returncode == 0:
                ColorPrint.green(f"[ScrcpyServerManager] [STEP 2/4 OK] Old jar removed")
            else:
                ColorPrint.yellow(f"[ScrcpyServerManager] [STEP 2/4 WARN] Remove failed (non-fatal): {remove_result.stderr}")
        except Exception as e:
            ColorPrint.yellow(f"[ScrcpyServerManager] [STEP 2/4 WARN] Remove exception (non-fatal): {e}")

        # ========== STEP 3: ALWAYS push new jar to device ==========
        ColorPrint.blue(f"[ScrcpyServerManager] [STEP 3/4] Pushing jar to {serial}...")
        try:
            # CRITICAL FIX: Use //data/local/tmp/ to prevent Git Bash path translation on Windows
            # Git Bash automatically translates /data/local/tmp/ to Windows path (e.g., D:/Git/data/local/tmp/)
            # Double slash prevents this translation and ensures ADB pushes to Android device path
            # CRITICAL: Filename must be 'scrcpy-server' (no .jar extension) to match official scrcpy
            push_result = await await_bus_task(
                lambda: subprocess.run(
                    [self.adb_path, "-s", serial, "push", str(jar_to_push), "//data/local/tmp/scrcpy-server"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
            )

            if push_result.returncode != 0:
                ColorPrint.red(f"[ScrcpyServerManager] [STEP 3/4 FAILED] Push failed: {push_result.stderr}")
                return False

            ColorPrint.green(f"[ScrcpyServerManager] [STEP 3/4 OK] Jar pushed successfully")

        except Exception as e:
            ColorPrint.red(f"[ScrcpyServerManager] [STEP 3/4 FAILED] Push exception: {e}")
            return False

        # ========== STEP 4: ALWAYS verify push success (final validation) ==========
        ColorPrint.blue(f"[ScrcpyServerManager] [STEP 4/4] Verifying push...")
        try:
            # Verify file exists on device
            verify_result = await await_bus_task(
                lambda: subprocess.run(
                    [self.adb_path, "-s", serial, "shell", "test -f /data/local/tmp/scrcpy-server && echo exists"],
                    capture_output=True,
                    text=True,
                    timeout=3
                )
            )

            if verify_result.returncode == 0 and "exists" in verify_result.stdout:
                ColorPrint.green(f"[ScrcpyServerManager] [STEP 4/4 OK] Push verified successfully")
                ColorPrint.green(f"[ScrcpyServerManager] ✓ Idempotent push completed for {serial}")
                return True
            else:
                ColorPrint.red(f"[ScrcpyServerManager] [STEP 4/4 FAILED] Verification failed - file not found on device")
                return False

        except Exception as e:
            ColorPrint.red(f"[ScrcpyServerManager] [STEP 4/4 FAILED] Verification exception: {e}")
            return False


# ✅ 创建全局唯一实例（延迟初始化，需要从Config获取路径）
# 注意：此实例在第一次访问时才初始化（通过 get_scrcpy_server_manager()）
_SCRCPY_SERVER_MANAGER_PROVIDER = SerializedSingletonProvider(
    ScrcpyServerManager,
    "scrcpy.server_manager.provider",
    "ScrcpyServerManagerProvider",
    timeout=300.0,
)

def get_scrcpy_server_manager(adb_path: str = "adb", jar_path: str = "") -> ScrcpyServerManager:
    """
    获取全局ScrcpyServerManager实例

    Args:
        adb_path: ADB路径（首次调用时需要）
        jar_path: scrcpy-server.jar路径（首次调用时需要）

    Returns:
        ScrcpyServerManager全局实例
    """
    return _SCRCPY_SERVER_MANAGER_PROVIDER.get(adb_path, jar_path)

__all__ = ['ScrcpyServerManager', 'get_scrcpy_server_manager']
