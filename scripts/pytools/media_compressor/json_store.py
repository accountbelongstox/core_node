"""Process-safe JSON storage utilities with file lock coordination."""

from __future__ import annotations

import json
import os
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Dict, Optional


JsonData = Dict[str, Any]


class ThreadSafeJsonStore:
    """Process-safe JSON storage using file locks in _lck directory.

    IMPORTANT: This is for multi-process coordination, not multi-threading.
    Each client runs as a separate Python process.
    File locks (in _lck directory) ensure only one process can access the JSON file at a time.
    """

    def __init__(
        self,
        path: Path | str,
        default_factory: Optional[Callable[[], JsonData]] = None,
        *,
        max_retries: int = 5,
        retry_delay: float = 1.0,
        indent: int = 2,
        lock_wait: float = 1.0,
        lock_timeout: Optional[float] = None,
    ) -> None:
        self.path = Path(path)
        self.default_factory = default_factory
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.indent = indent
        self.lock_wait = lock_wait
        self.lock_timeout = lock_timeout

        # Lock files stored in _lck subdirectory
        self._lock_dir = self.path.parent / '_lck'
        self._lock_base_name = self.path.name  # e.g., "compression_cache.db"
        self._current_lock_file = None  # Will be set when lock is acquired

        # NOTE: No threading.RLock - this is for multi-process, not multi-thread
        # File lock (in _lck dir) is sufficient for cross-process coordination

    def ensure_file(self) -> None:
        """Ensure the JSON file exists with default content."""
        with self._file_lock():
            if self.path.exists():
                return
            data = self._create_default()
            self._write_json_to_disk(data)

    def read(self) -> JsonData:
        """Read the JSON file with exclusive file locking. Retries indefinitely."""
        while True:
            try:
                with self._file_lock():
                    return self._load_json_from_disk()
            except Exception:
                pass

            time.sleep(self.retry_delay)

    def write(self, data: JsonData) -> bool:
        """Write data to the JSON file atomically with file lock coordination. Retries indefinitely."""
        while True:
            try:
                with self._file_lock():
                    self._write_json_to_disk(data)
                    return True
            except Exception:
                pass

            time.sleep(self.retry_delay)

    def update(
        self,
        mutator: Callable[[JsonData], Any],
        *,
        max_retries: Optional[int] = None,
        retry_delay: Optional[float] = None,
    ) -> bool:
        """Apply a mutator to the JSON data with retries and file locking.

        If max_retries is None, retries indefinitely. Otherwise uses the specified limit.
        """

        delay = self.retry_delay if retry_delay is None else retry_delay

        # If max_retries is None, retry indefinitely
        if max_retries is None:
            while True:
                try:
                    with self._file_lock():
                        data = self._load_json_from_disk()
                        mutator(data)
                        self._write_json_to_disk(data)
                        return True
                except Exception:
                    pass

                time.sleep(delay)
        else:
            # Use specified retry limit
            for attempt in range(max_retries):
                try:
                    with self._file_lock():
                        data = self._load_json_from_disk()
                        mutator(data)
                        self._write_json_to_disk(data)
                        return True
                except Exception:
                    pass

                if attempt < max_retries - 1:
                    time.sleep(delay)

            return False

    def _create_default(self) -> JsonData:
        if self.default_factory:
            return self.default_factory()
        return {}

    def _load_json_from_disk(self) -> JsonData:
        if not self.path.exists():
            data = self._create_default()
            self._write_json_to_disk(data)
            return data

        with self.path.open('r', encoding='utf-8') as fh:
            try:
                data = json.load(fh)
                return data
            except Exception as e:
                # JSON corrupted, recreate
                print(f"      Warning: JSON parsing failed ({e}), recreating cache", flush=True)
                data = self._create_default()
                self._write_json_to_disk(data)
                return data

    def _write_json_to_disk(self, data: JsonData) -> None:
        """Atomic write using process-unique temp file + replace.

        CRITICAL: Must use tmp file to avoid data loss.
        Direct write with open('w') immediately truncates file to 0 bytes,
        causing data loss if process crashes before write completes.
        """
        self.path.parent.mkdir(parents=True, exist_ok=True)

        # Use PID + timestamp for unique tmp file per process/write
        pid = os.getpid()
        timestamp = int(time.time() * 1000000)  # microseconds
        tmp_path = self.path.parent / f".{self.path.name}.tmp.{pid}.{timestamp}"

        try:
            # Write to tmp file
            with tmp_path.open('w', encoding='utf-8') as fh:
                json.dump(data, fh, ensure_ascii=False, indent=self.indent)
                fh.flush()
                os.fsync(fh.fileno())

            # Atomic replace (only after successful write)
            tmp_path.replace(self.path)

        except Exception as e:
            # Clean up tmp file on error
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except:
                    pass
            raise e  # Re-raise to caller

    @contextmanager
    def _file_lock(self):
        self._acquire_file_lock()
        try:
            yield
        finally:
            self._release_file_lock()

    def _acquire_file_lock(self) -> None:
        """Acquire file lock using timestamp-based lock files in _lck directory.

        Lock files are named: {base_name}.{timestamp}.{pid}.lck
        No file content is read - only filesystem metadata (creation time) is checked.
        """
        deadline = None if self.lock_timeout is None else time.time() + self.lock_timeout
        zombie_lock_threshold = 300  # 5 minutes in seconds
        current_pid = os.getpid()

        while True:
            # Ensure _lck directory exists
            self._lock_dir.mkdir(parents=True, exist_ok=True)

            # Scan for existing lock files matching our base name
            existing_locks = list(self._lock_dir.glob(f'{self._lock_base_name}.*.lck'))

            active_lock_found = False
            zombie_locks = []

            for lock_file in existing_locks:
                try:
                    # Check creation time via filesystem metadata (no file read)
                    stat = lock_file.stat()
                    created_at = getattr(stat, "st_ctime", stat.st_mtime)
                    age = time.time() - created_at

                    if age > zombie_lock_threshold:
                        # Zombie lock (process crashed)
                        zombie_locks.append(lock_file)
                    else:
                        # Check if this is our own lock (self-deadlock prevention)
                        # Lock filename format: {base}.{timestamp}.{pid}.lck
                        try:
                            parts = lock_file.stem.split('.')
                            if len(parts) >= 3:
                                lock_pid = int(parts[-1])
                                if lock_pid == current_pid:
                                    # Our own stale lock, remove it
                                    zombie_locks.append(lock_file)
                                    continue
                        except (ValueError, IndexError):
                            pass

                        # Active lock held by another process
                        active_lock_found = True

                except OSError:
                    # Can't stat file, treat as zombie
                    zombie_locks.append(lock_file)

            # Clean up zombie locks
            for zombie in zombie_locks:
                try:
                    zombie.unlink(missing_ok=True)
                except OSError:
                    pass

            # If no active locks, try to acquire
            if not active_lock_found:
                try:
                    # Create our lock file with timestamp and PID in filename
                    timestamp = int(time.time() * 1000000)  # microseconds for uniqueness
                    lock_filename = f'{self._lock_base_name}.{timestamp}.{current_pid}.lck'
                    self._current_lock_file = self._lock_dir / lock_filename

                    # Create empty lock file (no content written)
                    with self._current_lock_file.open('x') as f:
                        pass  # Empty file

                    return  # Lock acquired successfully

                except FileExistsError:
                    # Another process created lock between scan and create, retry
                    self._current_lock_file = None
                    pass

            # Check timeout
            if deadline is not None and time.time() >= deadline:
                raise TimeoutError(f"Timed out acquiring lock for {self.path}")

            # Wait before retry
            time.sleep(self.lock_wait)

    def _release_file_lock(self) -> None:
        """Release the file lock by removing our lock file from _lck directory."""
        if self._current_lock_file is not None:
            try:
                self._current_lock_file.unlink(missing_ok=True)
            except OSError:
                pass
            finally:
                self._current_lock_file = None
