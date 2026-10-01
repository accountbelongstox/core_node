# Archived: obsolete, not maintained or refactored.
"""
Scrcpy Server Manager

Centralized management for scrcpy-server.jar lifecycle:
- Resolve the local jar (configured path or the shell-installed scrcpy bundle)
- Check jar exists on device
- Push jar to device (with optimization)
- Hash verification

Decouples jar management from VideoStreamService and ConnectionManager.
"""

import hashlib
import subprocess
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    await_bus_task,
    call_serialized,
    init_serialized_owner,
    map_bus_tasks,
    serialized_method,
)
from pycore.pyutils.common.prerequisite_steps import PREREQ_SCRCPY, report_missing
from pycore.pyutils.device.scrcpy_init import SCRCPY_VERSION, scrcpy_initializer

# Process-wide owner for jar validation.
_DOWNLOAD_QUEUE = 'pyutils.device.scrcpy_server.jar'
_DOWNLOAD_WORKER = SerializedWorkerThread(
    _DOWNLOAD_QUEUE,
    'ScrcpyServerJarThread',
)
_DOWNLOAD_WORKER.start()
# Mutated only on the jar owner thread.
_DOWNLOAD_STATE = {
    'jar_initialized': False,
}

# Device-side jar path. Shell strings need no '//' prefix; the push target
# argument does (prevents Git Bash path translation on Windows).
DEVICE_JAR_PATH = "/data/local/tmp/scrcpy-server"
DEVICE_JAR_PUSH_TARGET = "//data/local/tmp/scrcpy-server"
ADB_SHELL_TIMEOUT = 3
ADB_PUSH_TIMEOUT = 10


def _run_adb(adb_path: str, serial: str, args: Sequence[str], timeout: float) -> Optional[subprocess.CompletedProcess]:
    """Run ``adb -s serial <args>``; None (reported) when the process cannot run or times out."""
    command = [adb_path, "-s", serial, *args]
    try:
        return subprocess.run(command, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.SubprocessError) as exc:
        ColorPrint.red(f"[ScrcpyServerManager] adb command failed {command}: {exc}")
        return None


def _jar_exists_on_device(adb_path: str, serial: str) -> bool:
    result = _run_adb(adb_path, serial, ["shell", f"test -f {DEVICE_JAR_PATH} && echo exists"], ADB_SHELL_TIMEOUT)
    return bool(result and result.returncode == 0 and "exists" in result.stdout)


def _device_jar_hash(adb_path: str, serial: str) -> Optional[str]:
    result = _run_adb(adb_path, serial, ["shell", f"md5sum {DEVICE_JAR_PATH}"], ADB_SHELL_TIMEOUT)
    if not result or result.returncode != 0:
        return None
    return result.stdout.split()[0] if result.stdout else ""


def _replace_jar_on_device(adb_path: str, serial: str, jar_path: Path) -> Tuple[bool, Optional[str]]:
    """Remove the old jar, push ``jar_path`` and verify; (success, error)."""
    removed = _run_adb(adb_path, serial, ["shell", f"rm -f {DEVICE_JAR_PATH}"], ADB_SHELL_TIMEOUT)
    if removed is not None and removed.returncode != 0:
        ColorPrint.yellow(f"[ScrcpyServerManager] [{serial}] Remove old jar failed (non-fatal): {removed.stderr}")
    pushed = _run_adb(adb_path, serial, ["push", str(jar_path), DEVICE_JAR_PUSH_TARGET], ADB_PUSH_TIMEOUT)
    if pushed is None:
        return False, "Push command could not run"
    if pushed.returncode != 0:
        return False, f"Push failed: {pushed.stderr}"
    if not _jar_exists_on_device(adb_path, serial):
        return False, "Verification failed - file not found after push"
    return True, None


def _push_jar_to_device(payload: Dict[str, object]) -> Dict[str, object]:
    """Push one jar unless the device copy already matches; delivered through THREAD_BUS."""
    serial = str(payload["serial"])
    adb_path = str(payload["adb_path"])
    jar_path = Path(payload["jar_path"])
    local_hash = str(payload["local_hash"])
    result: Dict[str, object] = {"serial": serial, "success": False, "error": None, "skipped": False}

    ColorPrint.blue(f"[JarPushThread] [{serial}] Starting jar push check...")
    if _jar_exists_on_device(adb_path, serial) and _device_jar_hash(adb_path, serial) == local_hash:
        ColorPrint.green(f"[JarPushThread] [{serial}] Jar correct (hash: {local_hash[:8]}), skipping push")
        result["success"] = True
        result["skipped"] = True
        return result

    success, error = _replace_jar_on_device(adb_path, serial, jar_path)
    result["success"] = success
    result["error"] = error
    if success:
        ColorPrint.green(f"[JarPushThread] [{serial}] Jar pushed and verified")
    else:
        ColorPrint.red(f"[JarPushThread] [{serial}] {error}")
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
    SCRCPY_VERSION = SCRCPY_VERSION  # versions.scrcpy in config/service_contract.json

    def __init__(self, adb_path: str, jar_path: str):
        self.adb_path = adb_path
        self.jar_path = Path(jar_path)
        # Cache for local jar hash (avoid recalculating)
        self._local_hash_cache: Optional[str] = None
        # Cache for correct jar path (avoid re-validation)
        self._validated_jar_path: Optional[Path] = None

    def _is_jar_valid(self, jar_path: Path) -> bool:
        """Validate jar size, ZIP header and classes.dex content."""
        if not jar_path.exists():
            return False

        file_size = jar_path.stat().st_size
        if file_size < self.EXPECTED_MIN_SIZE:
            ColorPrint.yellow(f"[ScrcpyServerManager] Jar too small: {file_size} bytes (expected >={self.EXPECTED_MIN_SIZE/1024:.0f}KB)")
            return False
        if file_size > self.EXPECTED_MAX_SIZE:
            ColorPrint.yellow(f"[ScrcpyServerManager] Jar too large: {file_size} bytes (expected <={self.EXPECTED_MAX_SIZE/1024:.0f}KB)")
            ColorPrint.yellow(f"[ScrcpyServerManager] Hint: This might be the full scrcpy package instead of scrcpy-server.jar")
            return False

        try:
            with open(jar_path, 'rb') as f:
                header = f.read(4)
            if header != b'PK\x03\x04':
                ColorPrint.yellow(f"[ScrcpyServerManager] Invalid jar format (not a ZIP/JAR file): {jar_path}")
                return False
            with zipfile.ZipFile(jar_path, 'r') as zf:
                namelist = zf.namelist()
        except (OSError, zipfile.BadZipFile) as e:
            ColorPrint.yellow(f"[ScrcpyServerManager] Error validating jar {jar_path}: {e}")
            return False
        if 'classes.dex' not in namelist:
            ColorPrint.yellow(f"[ScrcpyServerManager] Invalid jar content: classes.dex not found")
            ColorPrint.yellow(f"[ScrcpyServerManager] Files in jar: {namelist[:5]}")
            return False
        return True

    def _adopt_jar(self, jar_path: Path) -> bool:
        self._validated_jar_path = jar_path
        self._local_hash_cache = None
        _DOWNLOAD_STATE['jar_initialized'] = True
        return True

    def _ensure_local_jar(self) -> bool:
        """
        Resolve a valid scrcpy-server jar on the process-wide jar owner.

        Order: process flag -> validated cache -> configured jar_path ->
        shell-installed scrcpy bundle. Missing is reported with the installer step.
        """
        if _DOWNLOAD_STATE['jar_initialized']:
            return True

        if self._validated_jar_path and self._validated_jar_path.exists():
            if self._is_jar_valid(self._validated_jar_path):
                _DOWNLOAD_STATE['jar_initialized'] = True
                return True
            ColorPrint.yellow(f"[ScrcpyServerManager] Cached jar became invalid, re-validating...")
            self._validated_jar_path = None

        if self.jar_path.exists() and self._is_jar_valid(self.jar_path):
            ColorPrint.green(f"[ScrcpyServerManager] Valid jar found at: {self.jar_path}")
            return self._adopt_jar(self.jar_path)

        bundle_jar = scrcpy_initializer.get_server_path()
        if bundle_jar is not None and self._is_jar_valid(bundle_jar):
            ColorPrint.green(f"[ScrcpyServerManager] Valid jar found in scrcpy bundle: {bundle_jar}")
            return self._adopt_jar(bundle_jar)

        report_missing(PREREQ_SCRCPY, f"no valid scrcpy-server at {self.jar_path} or in {scrcpy_initializer.scrcpy_dir}")
        return False

    def ensure_local_jar(self) -> bool:
        """Resolve the jar through the process-wide jar owner thread."""
        return call_serialized(_DOWNLOAD_QUEUE, self._ensure_local_jar)

    def _jar_to_push(self) -> Path:
        return self._validated_jar_path if self._validated_jar_path else self.jar_path

    def get_local_hash(self) -> Optional[str]:
        """MD5 of the local jar (cached), or None when unreadable."""
        jar_to_hash = self._jar_to_push()
        if not jar_to_hash.exists():
            return None
        if self._local_hash_cache:
            return self._local_hash_cache
        try:
            self._local_hash_cache = hashlib.md5(jar_to_hash.read_bytes()).hexdigest()
        except OSError as e:
            ColorPrint.yellow(f"[ScrcpyServerManager] Error calculating local hash for {jar_to_hash}: {e}")
            return None
        return self._local_hash_cache

    def batch_push_jars(self, serials: List[str]) -> Dict[str, bool]:
        """Push jars to multiple devices through THREAD_BUS-backed worker threads."""
        if not self.ensure_local_jar():
            ColorPrint.red("[ScrcpyServerManager] Cannot ensure local jar for batch push")
            return {serial: False for serial in serials}

        jar_to_push = self._jar_to_push()
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
                    ColorPrint.red(f"[ScrcpyServerManager] {serial}: {lane_result['error']}")

        ColorPrint.green(
            f"[ScrcpyServerManager] Batch push complete: "
            f"{pushed_count} pushed, {skipped_count} skipped, {failed_count} failed"
        )
        return results

    async def check_jar_on_device(self, serial: str) -> bool:
        """True when the device jar exists and its hash matches the local jar."""
        exists = await await_bus_task(_jar_exists_on_device, self.adb_path, serial)
        if not exists:
            ColorPrint.yellow(f"[ScrcpyServerManager] jar not found on {serial}")
            return False

        local_hash = self.get_local_hash()
        if not local_hash:
            ColorPrint.yellow(f"[ScrcpyServerManager] Cannot get local hash")
            return False

        device_hash = await await_bus_task(_device_jar_hash, self.adb_path, serial)
        if device_hash is None:
            ColorPrint.yellow(f"[ScrcpyServerManager] Failed to get device jar hash for {serial}")
            return False
        if local_hash == device_hash:
            ColorPrint.green(f"[ScrcpyServerManager] ✓ jar on {serial} (hash match: {local_hash[:8]})")
            return True
        ColorPrint.yellow(f"[ScrcpyServerManager] jar hash mismatch on {serial} (local:{local_hash[:8]} device:{device_hash[:8]})")
        return False

    async def push_jar_to_device(self, serial: str) -> bool:
        """
        Idempotent self-healing push: ensure the local jar, remove the device
        copy, push, verify (every step runs on every call).
        """
        ColorPrint.blue(f"[ScrcpyServerManager] Starting idempotent push for {serial}...")
        if not self.ensure_local_jar():
            ColorPrint.red(f"[ScrcpyServerManager] Cannot ensure local jar")
            return False

        success, error = await await_bus_task(_replace_jar_on_device, self.adb_path, serial, self._jar_to_push())
        if not success:
            ColorPrint.red(f"[ScrcpyServerManager] Push to {serial} failed: {error}")
            return False
        ColorPrint.green(f"[ScrcpyServerManager] ✓ Idempotent push completed for {serial}")
        return True


class ScrcpyServerManagerRegistry:
    """Keyed owner: one ScrcpyServerManager per (adb_path, jar_path)."""

    def __init__(self):
        self._managers: Dict[Tuple[str, str], ScrcpyServerManager] = {}
        init_serialized_owner(self, "scrcpy.server_manager.registry", "ScrcpyServerManagerRegistry")

    @serialized_method
    def for_paths(self, adb_path: str, jar_path: str) -> ScrcpyServerManager:
        key = (str(adb_path), str(jar_path))
        manager = self._managers.get(key)
        if manager is None:
            manager = ScrcpyServerManager(*key)
            self._managers[key] = manager
        return manager


scrcpy_server_managers = ScrcpyServerManagerRegistry()


__all__ = ['ScrcpyServerManager', 'ScrcpyServerManagerRegistry', 'scrcpy_server_managers']
