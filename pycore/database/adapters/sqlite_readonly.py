# -*- coding: utf-8 -*-
"""
Read-only SQLite access for external databases (FIX V4/V10).
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Any, Generator, Iterable, Optional, Tuple


@contextmanager
def open_readonly_db(db_path: str) -> Generator[sqlite3.Connection, None, None]:
    uri = f"file:{db_path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.execute("PRAGMA query_only = 1")
    try:
        yield conn
    finally:
        conn.close()


def query_rows(
    db_path: str,
    sql: str,
    params: Optional[Iterable[Any]] = None,
) -> Tuple[Tuple, ...]:
    with open_readonly_db(db_path) as conn:
        cursor = conn.execute(sql, tuple(params or ()))
        return tuple(cursor.fetchall())


__all__ = ["open_readonly_db", "query_rows"]
