#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Lock Manager
Provides multi-process file locking with cross-platform cache directory support

IMPORTANT: Multi-Process Architecture
======================================
This module is designed for coordination between MULTIPLE INDEPENDENT PROCESSES,
not threads within a single Python process.

Each client process:
- Runs as a separate Python interpreter instance
- Has its own memory space
- Cannot share threading.Lock or other in-process synchronization
- Must rely on file system operations for coordination

Example scenario:
  Terminal 1: python client_a.py  (PID 1234)
  Terminal 2: python client_b.py  (PID 5678)
  Terminal 3: python client_c.py  (PID 9012)

All three processes access the same data file and use FileLockManager
to coordinate exclusive access through file system locks.

Split out of the former file_lock_manager module.
"""

import errno
import json
import os
import sys
import time
import hashlib
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Dict, Iterator, Optional

if os.name == "nt":
    import msvcrt
else:
    import fcntl

from pycore.pyfoundations.atomic_json_store import atomic_write_json
from pycore.pyfoundations.data_owner import adopt_path, ensure_owned_dir
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_system_cache_dir


JsonData = Dict[str, Any]


# ---------------------------------------------------------------------------
# Lock configuration (module-level constants, re-exported by the facade).
# Also mirrored as FileLockManager class attributes below for backwards
# compatibility with ``FileLockManager.LOCK_TIMEOUT_SECONDS`` access.
# ---------------------------------------------------------------------------
LOCK_TIMEOUT_SECONDS = 300  # 5 minutes
LOCK_RETRY_INTERVAL = 1.0   # 1 second
# One OS-locked file per target: the kernel gives mutual exclusion between
# processes and between threads (each acquire opens its own descriptor) and
# drops the lock when its holder dies, so no stale-lock detection is needed.
LOCK_FILE_NAME = "file.lock"
LOCK_BYTES = 1
# Non-blocking lock attempt on a held lock: flock EAGAIN/EWOULDBLOCK, msvcrt EACCES/EDEADLOCK.
_LOCK_BUSY_ERRNOS = frozenset({errno.EAGAIN, errno.EWOULDBLOCK, errno.EACCES, errno.EDEADLK})


class FileLockManager:
    """
    Multi-Process File Lock Manager

    Features:
    - Cross-platform cache directory support (Windows/Linux)
    - MD5-based lock directory isolation
    - One OS-locked file per target (fcntl.flock / msvcrt.locking): exclusive
      between processes and threads, released by the kernel when the holder dies
    - Automatic retry on lock contention (1 second interval)
    - JSON read/write/update operations
    - Process-safe atomic operations

    Lock Structure:
        Windows: D:\\www\\core_node\\_lck\\{md5}\\file.lock
        Linux:   <core_node_data_dir>/_lck/{md5}/file.lock

    Usage:
        # Create manager for a file
        manager = FileLockManager('/path/to/data.json')

        # Read JSON
        data = manager.read_json()

        # Write JSON
        manager.write_json({'key': 'value'})

        # Update JSON atomically
        def mutator(data):
            data['counter'] = data.get('counter', 0) + 1
        manager.update_json(mutator)

        # Manual lock control
        with manager.lock():
            # ... exclusive access to file ...
            pass
    """

    # Lock configuration (class attrs, preserved for FileLockManager.LOCK_TIMEOUT_SECONDS)
    LOCK_TIMEOUT_SECONDS = LOCK_TIMEOUT_SECONDS
    LOCK_RETRY_INTERVAL = LOCK_RETRY_INTERVAL

    def __init__(
        self,
        file_path: str | Path,
        default_factory: Optional[Callable[[], JsonData]] = None,
        *,
        json_indent: int = 2,
        lock_timeout: int = LOCK_TIMEOUT_SECONDS,
        retry_interval: float = LOCK_RETRY_INTERVAL,
        verbose: bool = True,
    ):
        """
        Initialize FileLockManager

        Args:
            file_path: Path to the file to manage
            default_factory: Factory function for creating default JSON content
            json_indent: JSON indentation for pretty printing
            lock_timeout: Lock timeout in seconds (default: 300 = 5 minutes)
            retry_interval: Retry interval in seconds (default: 1.0)
            verbose: Enable verbose logging (default: True)
        """
        self.file_path = Path(file_path).resolve()
        self.default_factory = default_factory or (lambda: {})

        self.json_indent = json_indent
        self.lock_timeout = lock_timeout
        self.retry_interval = retry_interval
        self.verbose = verbose

        # Calculate MD5 hash of file path for lock directory isolation
        self._path_hash = self._calculate_path_hash(str(self.file_path))

        # Determine cache directory based on platform
        self._cache_base = self._get_cache_directory()

        # Lock directory: {cache_base}/_lck/{md5_hash}/
        self._lock_dir = self._cache_base / '_lck' / self._path_hash

        self._log(f"FileLockManager initialized")
        self._log(f"  Target file: {self.file_path}")
        self._log(f"  Lock directory: {self._lock_dir}")
        self._log(f"  Lock timeout: {self.lock_timeout}s")

    def _log(self, message: str):
        """Print log message if verbose mode is enabled"""
        if self.verbose:
            ColorPrint.plain(f"[FileLockManager] {message}", flush=True)

    @staticmethod
    def _get_cache_directory() -> Path:
        """
        Get the unified runtime data root (delegates to
        system_paths.get_system_cache_dir -> core_node_dirs):
            Windows: D:\\www\\core_node
            Linux:   /www/www/core_node (NTFS dual-boot) or /www/core_node
        """
        return get_system_cache_dir()

    @staticmethod
    def _calculate_path_hash(path: str) -> str:
        """
        Calculate MD5 hash of file path for lock directory isolation

        Args:
            path: File path string

        Returns:
            MD5 hash (32 hex characters)
        """
        md5 = hashlib.md5()
        md5.update(path.encode('utf-8'))
        return md5.hexdigest()

    @property
    def _lock_file(self) -> Path:
        return self._lock_dir / LOCK_FILE_NAME

    @staticmethod
    def _try_lock(descriptor: int) -> bool:
        """Non-blocking exclusive OS lock on one open descriptor."""
        try:
            if os.name == "nt":
                msvcrt.locking(descriptor, msvcrt.LK_NBLCK, LOCK_BYTES)
            else:
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            if exc.errno not in _LOCK_BUSY_ERRNOS:
                ColorPrint.red(f"[FileLock] lock descriptor {descriptor} failed: {exc}")
            return False
        return True

    @staticmethod
    def _unlock(descriptor: int) -> None:
        if os.name == "nt":
            os.lseek(descriptor, 0, os.SEEK_SET)
            msvcrt.locking(descriptor, msvcrt.LK_UNLCK, LOCK_BYTES)
        else:
            fcntl.flock(descriptor, fcntl.LOCK_UN)

    @contextmanager
    def lock(self) -> Iterator[None]:
        """
        Context manager for acquiring exclusive file lock

        Usage:
            with manager.lock():
                # ... exclusive access ...
                pass
        """
        descriptor = self._acquire_lock()
        try:
            yield
        finally:
            self._release_lock(descriptor)

    def _acquire_lock(self) -> int:
        """Block until this call holds the OS lock; returns its descriptor.

        The descriptor is per call (never stored on the instance), so threads
        sharing one manager each wait for their own exclusive hold.
        """
        ensure_owned_dir(self._lock_dir)
        descriptor = os.open(str(self._lock_file), os.O_RDWR | os.O_CREAT, 0o600)
        adopt_path(self._lock_file)
        waited = False
        while not self._try_lock(descriptor):
            if not waited:
                self._log(f"Waiting for lock on {self.file_path.name} (PID {os.getpid()})...")
                waited = True
            time.sleep(self.retry_interval)
        self._log(f"Lock acquired: {self.file_path.name}")
        return descriptor

    def _release_lock(self, descriptor: int) -> None:
        self._unlock(descriptor)
        os.close(descriptor)
        self._log(f"Lock released: {self.file_path.name}")

    def ensure_file_exists(self):
        """Ensure target file exists with default content"""
        with self.lock():
            if not self.file_path.exists():
                self._log("Creating default file...")
                self._write_json_to_disk(self.default_factory())

    def read_json(self) -> JsonData:
        """
        Read JSON file with exclusive lock

        Returns:
            Parsed JSON data (dict)
        """
        ColorPrint.plain(f"[FileLockManager] read_json() called for {self.file_path.name}", flush=True)
        with self.lock():
            ColorPrint.plain(f"[FileLockManager] Lock acquired, loading from disk...", flush=True)
            result = self._load_json_from_disk()
            ColorPrint.plain(f"[FileLockManager] Loaded {len(str(result))} bytes", flush=True)
            return result

    def write_json(self, data: JsonData):
        """
        Write JSON file with exclusive lock

        Args:
            data: JSON data to write
        """
        with self.lock():
            self._write_json_to_disk(data)

    def update_json(self, mutator: Callable[[JsonData], Any]):
        """
        Update JSON file atomically with exclusive lock

        Args:
            mutator: Function that modifies the data in-place
                    Example: lambda data: data.update({'key': 'value'})
        """
        ColorPrint.plain(f"[FileLockManager] update_json() called for {self.file_path.name}", flush=True)
        with self.lock():
            ColorPrint.plain(f"[FileLockManager] Lock acquired for update, loading...", flush=True)
            data = self._load_json_from_disk()
            ColorPrint.plain(f"[FileLockManager] Applying mutator...", flush=True)
            mutator(data)
            ColorPrint.plain(f"[FileLockManager] Writing updated data...", flush=True)
            self._write_json_to_disk(data)
            ColorPrint.plain(f"[FileLockManager] Update complete", flush=True)

    def _load_json_from_disk(self) -> JsonData:
        """
        Load JSON from disk (must be called within lock context)

        Returns:
            Parsed JSON data
        """
        if not self.file_path.exists():
            self._log("File not found, creating default...")
            data = self.default_factory()
            self._write_json_to_disk(data)
            return data

        # Check if file is readable
        if not os.access(self.file_path, os.R_OK):
            self._log(f"Warning: File not readable, creating default...")
            data = self.default_factory()
            self._write_json_to_disk(data)
            return data

        # Read and parse JSON - let errors expose naturally
        with self.file_path.open('r', encoding='utf-8') as f:
            data = json.load(f)
        self._log(f"Loaded JSON: {len(str(data))} bytes")
        return data

    def _write_json_to_disk(self, data: JsonData):
        """
        Write JSON to disk atomically (must be called within lock context)

        Uses tmp file + atomic replace to prevent data loss

        Args:
            data: JSON data to write
        """
        atomic_write_json(self.file_path, data, indent=self.json_indent)
        self._log(f"Wrote JSON: {len(str(data))} bytes")

    def get_lock_status(self) -> Dict[str, Any]:
        """
        Get current lock status (for debugging)

        Returns:
            Dictionary with lock information
        """
        ensure_owned_dir(self._lock_dir)
        descriptor = os.open(str(self._lock_file), os.O_RDWR | os.O_CREAT, 0o600)
        adopt_path(self._lock_file)
        free = self._try_lock(descriptor)
        if free:
            self._unlock(descriptor)
        os.close(descriptor)
        return {
            'file_path': str(self.file_path),
            'lock_dir': str(self._lock_dir),
            'lock_file': str(self._lock_file),
            'path_hash': self._path_hash,
            'locked': not free,
        }
