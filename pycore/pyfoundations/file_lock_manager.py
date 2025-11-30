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
"""

import json
import os
import sys
import time
import hashlib
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Dict, Optional


JsonData = Dict[str, Any]


class FileLockManager:
    """
    Multi-Process File Lock Manager

    Features:
    - Cross-platform cache directory support (Windows/Linux)
    - MD5-based lock directory isolation
    - Timestamp-based lock files (no content reading needed)
    - 5-minute zombie lock detection
    - Automatic retry on lock contention (1 second interval)
    - JSON read/write/update operations
    - Process-safe atomic operations

    Lock Structure:
        Windows: C:\\Users\\{username}\\.core_node\\.cache\\_lck\\{md5}\\{timestamp}.{pid}.lck
        Linux:   /var/_core_node/_cache/_lck/{md5}/{timestamp}.{pid}.lck

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

    # Lock configuration
    LOCK_TIMEOUT_SECONDS = 300  # 5 minutes
    LOCK_RETRY_INTERVAL = 1.0   # 1 second

    def __init__(
        self,
        file_path: str | Path,
        default_factory: Optional[Callable[[], JsonData]] = None,
        *,
        json_indent: int = 2,
        indent: int = None,  # Compatibility alias for json_indent
        lock_timeout: int = LOCK_TIMEOUT_SECONDS,
        retry_interval: float = LOCK_RETRY_INTERVAL,
        retry_delay: float = None,  # Compatibility alias for retry_interval
        max_retries: int = None,  # For compatibility (not used, always retries indefinitely)
        verbose: bool = True,
    ):
        """
        Initialize FileLockManager

        Args:
            file_path: Path to the file to manage
            default_factory: Factory function for creating default JSON content
            json_indent: JSON indentation for pretty printing
            indent: Alias for json_indent (ThreadSafeJsonStore compatibility)
            lock_timeout: Lock timeout in seconds (default: 300 = 5 minutes)
            retry_interval: Retry interval in seconds (default: 1.0)
            retry_delay: Alias for retry_interval (ThreadSafeJsonStore compatibility)
            max_retries: For compatibility only (ignored, always retries indefinitely)
            verbose: Enable verbose logging (default: True)
        """
        self.file_path = Path(file_path).resolve()
        self.default_factory = default_factory or (lambda: {})

        # Handle compatibility aliases
        if indent is not None:
            json_indent = indent
        if retry_delay is not None:
            retry_interval = retry_delay

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

        # Current lock file (set when lock is acquired)
        self._current_lock_file: Optional[Path] = None

        self._log(f"FileLockManager initialized")
        self._log(f"  Target file: {self.file_path}")
        self._log(f"  Lock directory: {self._lock_dir}")
        self._log(f"  Lock timeout: {self.lock_timeout}s")

    def _log(self, message: str):
        """Print log message if verbose mode is enabled"""
        if self.verbose:
            print(f"[FileLockManager] {message}", flush=True)

    @staticmethod
    def _get_cache_directory() -> Path:
        """
        Get platform-specific cache directory

        Returns:
            Windows: C:\\Users\\{username}\\.core_node\\.cache
            Linux:   /var/_core_node/_cache
        """
        if sys.platform == 'win32':
            # Windows: C:\Users\{username}\.core_node\.cache
            user_home = Path.home()
            cache_dir = user_home / '.core_node' / '.cache'
        else:
            # Linux/Unix: /var/_core_node/_cache
            cache_dir = Path('/var/_core_node/_cache')

        return cache_dir

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

    def _get_lock_files(self) -> list[Path]:
        """
        Get all lock files in lock directory

        Returns:
            List of lock file paths (sorted by timestamp, newest first)
        """
        if not self._lock_dir.exists():
            return []

        # Find all .lck files matching pattern: *.*.lck
        lock_files = list(self._lock_dir.glob('*.*.lck'))

        # Sort by creation time (newest first), safely handling deleted files
        def safe_ctime(f: Path) -> float:
            try:
                return f.stat().st_ctime
            except OSError:
                # File was deleted between glob and stat, treat as oldest
                return 0.0

        lock_files.sort(key=safe_ctime, reverse=True)

        # Filter out files that no longer exist
        lock_files = [f for f in lock_files if f.exists()]

        return lock_files

    def _is_lock_stale(self, lock_file: Path) -> bool:
        """
        Check if lock file is stale (zombie lock from crashed process)

        Args:
            lock_file: Lock file path

        Returns:
            True if lock is older than timeout threshold
        """
        try:
            stat = lock_file.stat()
            # Use creation time on Windows, modification time on Unix
            created_at = getattr(stat, 'st_ctime', stat.st_mtime)
            age = time.time() - created_at
            return age > self.lock_timeout
        except OSError:
            # Can't stat file, treat as stale
            return True

    def _cleanup_stale_locks(self):
        """Remove all stale lock files"""
        lock_files = self._get_lock_files()

        for lock_file in lock_files:
            if self._is_lock_stale(lock_file):
                try:
                    lock_file.unlink(missing_ok=True)
                    self._log(f"  Removed stale lock: {lock_file.name}")
                except OSError:
                    pass

    def _check_self_deadlock(self, lock_file: Path) -> bool:
        """
        Check if lock file belongs to current process (self-deadlock prevention)

        Args:
            lock_file: Lock file path

        Returns:
            True if lock belongs to current process
        """
        try:
            # Lock filename format: {timestamp}.{pid}.lck
            parts = lock_file.stem.split('.')
            if len(parts) >= 2:
                lock_pid = int(parts[-1])
                return lock_pid == os.getpid()
        except (ValueError, IndexError):
            pass

        return False

    @contextmanager
    def lock(self):
        """
        Context manager for acquiring exclusive file lock

        Usage:
            with manager.lock():
                # ... exclusive access ...
                pass
        """
        self._acquire_lock()
        try:
            yield
        finally:
            self._release_lock()

    def _acquire_lock(self):
        """
        Acquire exclusive lock (blocks until lock is available)

        Lock acquisition steps:
        1. Create lock directory if needed
        2. Scan for existing lock files
        3. Clean up stale locks (older than timeout)
        4. Check for self-deadlock (own PID)
        5. If active locks exist, wait and retry
        6. Create new lock file with timestamp + PID
        """
        current_pid = os.getpid()

        print(f"[FileLockManager] Acquiring lock for {self.file_path.name} (PID {current_pid})...", flush=True)

        while True:
            # Ensure lock directory exists
            self._lock_dir.mkdir(parents=True, exist_ok=True)

            # Get all existing lock files
            print(f"[FileLockManager] Scanning lock directory: {self._lock_dir}", flush=True)
            lock_files = self._get_lock_files()
            print(f"[FileLockManager] Found {len(lock_files)} lock files", flush=True)

            # Clean up stale locks and check for self-deadlock
            active_locks = []
            for lock_file in lock_files:
                if self._is_lock_stale(lock_file):
                    try:
                        lock_file.unlink(missing_ok=True)
                        self._log(f"  Removed stale lock: {lock_file.name}")
                    except OSError:
                        pass
                elif self._check_self_deadlock(lock_file):
                    # Own stale lock, remove it
                    try:
                        lock_file.unlink(missing_ok=True)
                        self._log(f"  Removed self-deadlock: {lock_file.name}")
                    except OSError:
                        pass
                else:
                    # Active lock held by another process
                    active_locks.append(lock_file)

            # If no active locks, try to acquire
            if not active_locks:
                print(f"[FileLockManager] No active locks, attempting to acquire...", flush=True)
                try:
                    # Create lock file: {timestamp}.{pid}.lck
                    timestamp = int(time.time() * 1000000)  # microseconds
                    lock_filename = f"{timestamp}.{current_pid}.lck"
                    self._current_lock_file = self._lock_dir / lock_filename

                    # Create empty lock file (exclusive creation)
                    with self._current_lock_file.open('x') as f:
                        pass  # Empty file

                    print(f"[FileLockManager] Lock acquired: {lock_filename}", flush=True)
                    return  # Lock acquired successfully

                except FileExistsError:
                    # Another process created lock between scan and create, retry
                    print(f"[FileLockManager] Race condition, retrying...", flush=True)
                    self._current_lock_file = None
                    pass
            else:
                # Active locks exist, show waiting message
                active_pids = [f.stem.split('.')[-1] for f in active_locks]
                print(f"[FileLockManager] Waiting for lock (held by PID {active_pids})...", flush=True)

            # Wait before retry
            time.sleep(self.retry_interval)

    def _release_lock(self):
        """
        Release the acquired lock

        After releasing the lock, sleeps for 0.5 seconds to give other processes
        a fair chance to acquire the lock (prevents one process from monopolizing).
        """
        if self._current_lock_file is not None:
            try:
                self._current_lock_file.unlink(missing_ok=True)
                self._log(f"Lock released: {self._current_lock_file.name}")
            except OSError as e:
                self._log(f"Warning: Failed to release lock: {e}")
            finally:
                self._current_lock_file = None

                # Sleep to give other processes a chance to acquire the lock
                # This prevents one process from monopolizing lock acquisition
                time.sleep(0.5)

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
        print(f"[FileLockManager] read_json() called for {self.file_path.name}", flush=True)
        with self.lock():
            print(f"[FileLockManager] Lock acquired, loading from disk...", flush=True)
            result = self._load_json_from_disk()
            print(f"[FileLockManager] Loaded {len(str(result))} bytes", flush=True)
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
        print(f"[FileLockManager] update_json() called for {self.file_path.name}", flush=True)
        with self.lock():
            print(f"[FileLockManager] Lock acquired for update, loading...", flush=True)
            data = self._load_json_from_disk()
            print(f"[FileLockManager] Applying mutator...", flush=True)
            mutator(data)
            print(f"[FileLockManager] Writing updated data...", flush=True)
            self._write_json_to_disk(data)
            print(f"[FileLockManager] Update complete", flush=True)

    # Compatibility aliases for ThreadSafeJsonStore API
    def ensure_file(self):
        """Alias for ensure_file_exists() (ThreadSafeJsonStore compatibility)"""
        return self.ensure_file_exists()

    def read(self) -> JsonData:
        """Alias for read_json() (ThreadSafeJsonStore compatibility)"""
        return self.read_json()

    def write(self, data: JsonData):
        """Alias for write_json() (ThreadSafeJsonStore compatibility)"""
        return self.write_json(data)

    def update(
        self,
        mutator: Callable[[JsonData], Any],
        *,
        max_retries: Optional[int] = None,
        retry_delay: Optional[float] = None,
    ):
        """
        Alias for update_json() (ThreadSafeJsonStore compatibility)

        Note: max_retries and retry_delay are accepted for compatibility but ignored.
        FileLockManager always retries indefinitely with the configured retry_interval.
        """
        return self.update_json(mutator)

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

        try:
            with self.file_path.open('r', encoding='utf-8') as f:
                data = json.load(f)
            self._log(f"Loaded JSON: {len(str(data))} bytes")
            return data
        except json.JSONDecodeError as e:
            self._log(f"Warning: JSON corrupted ({e}), recreating...")
            data = self.default_factory()
            self._write_json_to_disk(data)
            return data
        except Exception as e:
            self._log(f"Error reading file: {e}")
            raise

    def _write_json_to_disk(self, data: JsonData):
        """
        Write JSON to disk atomically (must be called within lock context)

        Uses tmp file + atomic replace to prevent data loss

        Args:
            data: JSON data to write
        """
        # Ensure parent directory exists
        self.file_path.parent.mkdir(parents=True, exist_ok=True)

        # Use PID + timestamp for unique tmp file name
        pid = os.getpid()
        timestamp = int(time.time() * 1000000)
        tmp_path = self.file_path.parent / f".{self.file_path.name}.tmp.{pid}.{timestamp}"

        try:
            # Write to tmp file
            with tmp_path.open('w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=self.json_indent)
                f.flush()
                os.fsync(f.fileno())

            # Atomic replace
            tmp_path.replace(self.file_path)
            self._log(f"Wrote JSON: {len(str(data))} bytes")

        except Exception as e:
            # Clean up tmp file on error
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except:
                    pass
            raise e

    def get_lock_status(self) -> Dict[str, Any]:
        """
        Get current lock status (for debugging)

        Returns:
            Dictionary with lock information
        """
        lock_files = self._get_lock_files()

        status = {
            'file_path': str(self.file_path),
            'lock_dir': str(self._lock_dir),
            'path_hash': self._path_hash,
            'lock_count': len(lock_files),
            'locks': [],
        }

        for lock_file in lock_files:
            try:
                stat = lock_file.stat()
                created_at = getattr(stat, 'st_ctime', stat.st_mtime)
                age = time.time() - created_at

                # Parse PID from filename
                parts = lock_file.stem.split('.')
                pid = int(parts[-1]) if len(parts) >= 2 else None

                status['locks'].append({
                    'filename': lock_file.name,
                    'pid': pid,
                    'age_seconds': round(age, 2),
                    'is_stale': age > self.lock_timeout,
                })
            except Exception:
                pass

        return status


def main():
    """Test function for FileLockManager"""
    print("=" * 60)
    print("FileLockManager Test")
    print("=" * 60)
    print()

    # Test file path
    test_file = Path.home() / '.core_node' / 'test_data.json'

    print(f"Test file: {test_file}")
    print()

    # Create manager
    manager = FileLockManager(
        test_file,
        default_factory=lambda: {'counter': 0, 'items': []},
        verbose=True
    )

    # Test 1: Write JSON
    print("\n--- Test 1: Write JSON ---")
    manager.write_json({'counter': 1, 'items': ['test1', 'test2']})

    # Test 2: Read JSON
    print("\n--- Test 2: Read JSON ---")
    data = manager.read_json()
    print(f"Read data: {data}")

    # Test 3: Update JSON
    print("\n--- Test 3: Update JSON ---")
    def increment_counter(data):
        data['counter'] = data.get('counter', 0) + 1
        data['items'].append(f'item_{data["counter"]}')

    manager.update_json(increment_counter)

    # Verify update
    data = manager.read_json()
    print(f"After update: {data}")

    # Test 4: Lock status
    print("\n--- Test 4: Lock Status ---")
    status = manager.get_lock_status()
    print(f"Lock directory: {status['lock_dir']}")
    print(f"Path hash: {status['path_hash']}")
    print(f"Active locks: {status['lock_count']}")

    # Test 5: Manual lock control
    print("\n--- Test 5: Manual Lock Control ---")
    with manager.lock():
        print("Lock acquired manually")
        time.sleep(1)
        print("Performing operations...")
    print("Lock released")

    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
