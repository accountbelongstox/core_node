"""Thread-safe SQLite storage for media compressor cache."""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, Optional


JsonData = Dict[str, Any]


class SqliteStore:
    """SQLite-backed storage with ACID guarantees and better concurrency."""

    def __init__(
        self,
        path: Path | str,
        default_factory: Optional[Callable[[], JsonData]] = None,
        *,
        timeout: float = 30.0,
    ) -> None:
        self.path = Path(path)
        self.default_factory = default_factory
        self.timeout = timeout
        self._thread_lock = threading.RLock()
        self._init_database()

    def _init_database(self) -> None:
        """Initialize SQLite database with schema."""
        self.path.parent.mkdir(parents=True, exist_ok=True)

        with self._get_connection() as conn:
            # Enable WAL mode for better concurrency
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")

            # Create tables
            conn.execute("""
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    file_key TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_files_updated
                ON files(updated_at)
            """)

            # Initialize metadata if needed
            cursor = conn.execute(
                "SELECT value FROM metadata WHERE key = 'version'"
            )
            if not cursor.fetchone():
                default_data = self._create_default()
                conn.execute(
                    "INSERT INTO metadata (key, value) VALUES (?, ?)",
                    ('version', default_data.get('version', '1.0'))
                )
                conn.execute(
                    "INSERT INTO metadata (key, value) VALUES (?, ?)",
                    ('last_update', datetime.now().isoformat())
                )

            conn.commit()

    @contextmanager
    def _get_connection(self):
        """Get a database connection with timeout."""
        conn = sqlite3.connect(
            str(self.path),
            timeout=self.timeout,
            check_same_thread=False,
            isolation_level='DEFERRED'
        )
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def ensure_file(self) -> None:
        """Ensure the database exists (already done in __init__)."""
        pass

    def read(self) -> JsonData:
        """Read all data from database and convert to JSON-compatible dict."""
        with self._thread_lock:
            with self._get_connection() as conn:
                # Read metadata
                result: JsonData = {}
                cursor = conn.execute("SELECT key, value FROM metadata")
                for row in cursor:
                    result[row['key']] = row['value']

                # Read all files
                files: Dict[str, Any] = {}
                cursor = conn.execute("SELECT file_key, data FROM files")
                for row in cursor:
                    try:
                        files[row['file_key']] = json.loads(row['data'])
                    except json.JSONDecodeError:
                        # Skip corrupted entries
                        continue

                result['files'] = files

                # Ensure stats block exists
                if 'stats' not in result:
                    result['stats'] = {}

                stats = result['stats']
                if isinstance(stats, str):
                    try:
                        stats = json.loads(stats)
                        result['stats'] = stats
                    except json.JSONDecodeError:
                        stats = {}
                        result['stats'] = stats

                stats.setdefault('total_files', len(files))
                stats.setdefault('compressed', 0)
                stats.setdefault('skipped', 0)
                stats.setdefault('failed', 0)

                return result

    def write(self, data: JsonData) -> bool:
        """Write complete data to database."""
        with self._thread_lock:
            try:
                with self._get_connection() as conn:
                    # Update metadata
                    data['last_update'] = datetime.now().isoformat()

                    for key, value in data.items():
                        if key == 'files':
                            continue

                        # Serialize non-string values
                        if isinstance(value, (dict, list)):
                            value = json.dumps(value, ensure_ascii=False)

                        conn.execute(
                            """
                            INSERT INTO metadata (key, value)
                            VALUES (?, ?)
                            ON CONFLICT(key) DO UPDATE SET value = excluded.value
                            """,
                            (key, str(value))
                        )

                    # Clear and write files
                    conn.execute("DELETE FROM files")
                    files = data.get('files', {})
                    for file_key, file_data in files.items():
                        conn.execute(
                            "INSERT INTO files (file_key, data) VALUES (?, ?)",
                            (file_key, json.dumps(file_data, ensure_ascii=False))
                        )

                    conn.commit()
                    return True
            except Exception as e:
                print(f"  SQLite write error: {e}")
                return False

    def update(
        self,
        mutator: Callable[[JsonData], Any],
        *,
        max_retries: Optional[int] = None,
        retry_delay: Optional[float] = None,
    ) -> bool:
        """Apply a mutator to the data with transaction support."""
        import time

        delay = 1.0 if retry_delay is None else retry_delay
        retries = 0

        while True:
            with self._thread_lock:
                try:
                    with self._get_connection() as conn:
                        # Start transaction
                        conn.execute("BEGIN IMMEDIATE")

                        try:
                            # Read current data
                            data = self._read_in_transaction(conn)

                            # Apply mutator
                            mutator(data)

                            # Write back
                            self._write_in_transaction(conn, data)

                            # Commit
                            conn.commit()
                            return True
                        except Exception as e:
                            conn.rollback()
                            raise e

                except sqlite3.OperationalError as e:
                    # Database locked, retry
                    if max_retries is not None:
                        retries += 1
                        if retries >= max_retries:
                            return False
                except Exception as e:
                    print(f"  SQLite update error: {e}")
                    if max_retries is not None:
                        retries += 1
                        if retries >= max_retries:
                            return False

            if max_retries is not None and retries >= max_retries:
                return False

            time.sleep(delay)

    def _read_in_transaction(self, conn: sqlite3.Connection) -> JsonData:
        """Read data within an active transaction."""
        result: JsonData = {}

        cursor = conn.execute("SELECT key, value FROM metadata")
        for row in cursor:
            key = row['key']
            value = row['value']

            # Try to parse JSON values
            if key in ('stats', 'integrity_check'):
                try:
                    result[key] = json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    result[key] = value
            else:
                result[key] = value

        files: Dict[str, Any] = {}
        cursor = conn.execute("SELECT file_key, data FROM files")
        for row in cursor:
            try:
                files[row['file_key']] = json.loads(row['data'])
            except json.JSONDecodeError:
                continue

        result['files'] = files
        result.setdefault('stats', {})

        return result

    def _write_in_transaction(self, conn: sqlite3.Connection, data: JsonData) -> None:
        """Write data within an active transaction."""
        data['last_update'] = datetime.now().isoformat()

        # Update metadata
        for key, value in data.items():
            if key == 'files':
                continue

            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False)

            conn.execute(
                """
                INSERT INTO metadata (key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, str(value))
            )

        # Update files (upsert individual entries)
        files = data.get('files', {})
        for file_key, file_data in files.items():
            conn.execute(
                """
                INSERT INTO files (file_key, data, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(file_key) DO UPDATE SET
                    data = excluded.data,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (file_key, json.dumps(file_data, ensure_ascii=False))
            )

    def _create_default(self) -> JsonData:
        """Create default data structure."""
        if self.default_factory:
            return self.default_factory()
        return {
            'version': '1.0',
            'last_update': datetime.now().isoformat(),
            'files': {},
            'stats': {
                'total_files': 0,
                'compressed': 0,
                'skipped': 0,
                'failed': 0,
            },
        }

    def get_file_entry(self, file_key: str) -> Optional[Dict[str, Any]]:
        """Get a single file entry efficiently without loading all data."""
        with self._thread_lock:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    "SELECT data FROM files WHERE file_key = ?",
                    (file_key,)
                )
                row = cursor.fetchone()
                if row:
                    try:
                        return json.loads(row['data'])
                    except json.JSONDecodeError:
                        return None
                return None

    def update_file_entry(self, file_key: str, data: Dict[str, Any]) -> bool:
        """Update a single file entry efficiently."""
        with self._thread_lock:
            try:
                with self._get_connection() as conn:
                    conn.execute(
                        """
                        INSERT INTO files (file_key, data, updated_at)
                        VALUES (?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(file_key) DO UPDATE SET
                            data = excluded.data,
                            updated_at = CURRENT_TIMESTAMP
                        """,
                        (file_key, json.dumps(data, ensure_ascii=False))
                    )
                    conn.commit()
                    return True
            except Exception as e:
                print(f"  SQLite update_file_entry error: {e}")
                return False

    def delete_file_entry(self, file_key: str) -> bool:
        """Delete a single file entry."""
        with self._thread_lock:
            try:
                with self._get_connection() as conn:
                    conn.execute(
                        "DELETE FROM files WHERE file_key = ?",
                        (file_key,)
                    )
                    conn.commit()
                    return True
            except Exception as e:
                print(f"  SQLite delete_file_entry error: {e}")
                return False
