# -*- coding: utf-8 -*-
"""
Local SQLite adapter for non-core feature stores.

Keeps driver ownership in pycore.database.
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Optional


Row = sqlite3.Row
Error = sqlite3.Error


def connect_writable(
    db_path: str | Path,
    *,
    row_factory: Optional[object] = None,
    timeout: float = 5.0,
    uri: bool = False,
    check_same_thread: bool = True,
    isolation_level: Optional[str] = "",
) -> sqlite3.Connection:
    conn = sqlite3.connect(
        str(db_path),
        timeout=timeout,
        uri=uri,
        check_same_thread=check_same_thread,
        isolation_level=isolation_level,
    )
    if row_factory is not None:
        conn.row_factory = row_factory
    return conn


@contextmanager
def open_writable_db(
    db_path: str | Path,
    *,
    row_factory: Optional[object] = None,
    timeout: float = 5.0,
) -> Generator[sqlite3.Connection, None, None]:
    conn = connect_writable(db_path, row_factory=row_factory, timeout=timeout)
    try:
        yield conn
    finally:
        conn.close()


SQLITE_BUSY_TIMEOUT_MS = 30000


def open_wal_connection(
    db_path: str | Path,
    *,
    synchronous: Optional[str] = None,
    foreign_keys: bool = False,
    row_factory: Optional[object] = None,
    isolation_level: Optional[str] = "",
    check_same_thread: bool = False,
) -> sqlite3.Connection:
    """Open a writable SQLite connection with WAL, busy timeout, and optional pragmas."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = connect_writable(
        path.resolve(),
        row_factory=row_factory,
        timeout=SQLITE_BUSY_TIMEOUT_MS / 1000,
        check_same_thread=check_same_thread,
        isolation_level=isolation_level,
    )
    conn.execute(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}")
    conn.execute("PRAGMA journal_mode=WAL")
    if synchronous:
        conn.execute(f"PRAGMA synchronous={synchronous}")
    if foreign_keys:
        conn.execute("PRAGMA foreign_keys=ON")
    return conn


__all__ = ["Row", "Error", "SQLITE_BUSY_TIMEOUT_MS", "connect_writable", "open_wal_connection", "open_writable_db"]
