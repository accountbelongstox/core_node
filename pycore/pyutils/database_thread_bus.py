# -*- coding: utf-8 -*-
"""
DatabaseBase (SQLite thread-bus wrapper) — canonical location: pyutils/database_thread_bus.py

Moved from pyfoundations.database_base (FIX V10).  The class wraps a SQLite
connection inside a DatabaseWorkerThread and communicates via THREAD_BUS.
It is distinct from ``database.BaseModel`` (SQLAlchemy-based ORM base).

pyfoundations.database_base still holds the implementation and continues to
work; this module makes the canonical new path importable for future callers.
"""

from pycore.pyfoundations.database_base import DatabaseBase, DatabaseWorkerThread  # noqa: F401

__all__ = ["DatabaseBase", "DatabaseWorkerThread"]
