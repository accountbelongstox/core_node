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
) -> sqlite3.Connection:
    conn = sqlite3.connect(
        str(db_path),
        timeout=timeout,
        uri=uri,
        check_same_thread=check_same_thread,
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
    conn = sqlite3.connect(str(db_path), timeout=timeout)
    if row_factory is not None:
        conn.row_factory = row_factory
    try:
        yield conn
    finally:
        conn.close()


__all__ = ["Row", "Error", "connect_writable", "open_writable_db"]
