"""Thread-safe JSON storage utilities with file lock coordination."""

from __future__ import annotations

import json
import os
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Dict, Optional


JsonData = Dict[str, Any]


class ThreadSafeJsonStore:
    """Utility for safe JSON read/write operations across processes."""

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
        self._lock_path = self.path.with_suffix(self.path.suffix + '.lck')
        self._thread_lock = threading.RLock()

    def ensure_file(self) -> None:
        """Ensure the JSON file exists with default content."""
        with self._thread_lock:
            with self._file_lock():
                if self.path.exists():
                    return
                data = self._create_default()
                self._write_json_to_disk(data)

    def read(self) -> JsonData:
        """Read the JSON file with exclusive file locking. Retries indefinitely."""
        while True:
            with self._thread_lock:
                try:
                    with self._file_lock():
                        return self._load_json_from_disk()
                except Exception:
                    pass

            time.sleep(self.retry_delay)

    def write(self, data: JsonData) -> bool:
        """Write data to the JSON file atomically with file lock coordination. Retries indefinitely."""
        while True:
            with self._thread_lock:
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
                with self._thread_lock:
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
                with self._thread_lock:
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
                return json.load(fh)
            except Exception:
                data = self._create_default()
                self._write_json_to_disk(data)
                return data

    def _write_json_to_disk(self, data: JsonData) -> None:
        tmp_path = self.path.with_suffix(self.path.suffix + '.tmp')
        tmp_path.parent.mkdir(parents=True, exist_ok=True)

        with tmp_path.open('w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=self.indent)
            fh.flush()
            os.fsync(fh.fileno())

        tmp_path.replace(self.path)

    @contextmanager
    def _file_lock(self):
        self._acquire_file_lock()
        try:
            yield
        finally:
            self._release_file_lock()

    def _acquire_file_lock(self) -> None:
        deadline = None if self.lock_timeout is None else time.time() + self.lock_timeout
        zombie_lock_threshold = 300  # 5 minutes in seconds

        while True:
            try:
                self._lock_path.parent.mkdir(parents=True, exist_ok=True)
                with self._lock_path.open('x', encoding='utf-8') as lock_file:
                    lock_file.write(f"pid={os.getpid()} time={time.time():.0f}")
                return
            except FileExistsError:
                # Check if lock file is a zombie (process crashed, lock file remained)
                try:
                    if self._lock_path.exists():
                        # Read lock file timestamp
                        with self._lock_path.open('r', encoding='utf-8') as lock_file:
                            content = lock_file.read()
                            # Parse time from content: "pid=12345 time=1730812800"
                            for part in content.split():
                                if part.startswith('time='):
                                    lock_time = float(part.split('=')[1])
                                    elapsed = time.time() - lock_time
                                    if elapsed > zombie_lock_threshold:
                                        # Zombie lock detected - remove it
                                        self._lock_path.unlink(missing_ok=True)
                                        continue  # Retry immediately
                                    break
                except (OSError, ValueError, IndexError):
                    # If we can't read the lock file, treat it as potentially valid
                    pass

                if deadline is not None and time.time() >= deadline:
                    raise TimeoutError(f"Timed out acquiring lock for {self.path}")
                time.sleep(self.lock_wait)

    def _release_file_lock(self) -> None:
        try:
            self._lock_path.unlink(missing_ok=True)
        except OSError:
            pass
