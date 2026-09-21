# -*- coding: utf-8 -*-
"""pycore.database package.

The database_manager singleton is exported LAZILY (PEP 562): importing any
lightweight submodule (e.g. adapters.sqlite_readonly, which only needs stdlib
sqlite3) must not pull in the SQLAlchemy-backed manager -- otherwise a
read-only scan helper triggers the full third-party dependency chain (and its
pip auto-install) at import time.
"""

__all__ = ['database_manager']


def __getattr__(name):
    if name == 'database_manager':
        import sys
        from pycore.database.database_manager import database_manager
        # Importing the submodule above binds the MODULE as this package's
        # "database_manager" attribute; rebind it to the singleton so
        # `from pycore.database import database_manager` keeps returning the
        # manager instance exactly like the former eager import did.
        setattr(sys.modules[__name__], name, database_manager)
        return database_manager
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
