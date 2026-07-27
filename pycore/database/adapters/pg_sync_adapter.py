# -*- coding: utf-8 -*-
"""
PostgreSQL Sync Adapter — canonical location: database/adapters/pg_sync_adapter.py

Moved from pyfoundations.pg_sync_adapter (FIX V10).
pyfoundations.pg_sync_adapter now shims to this module.
"""

# Re-export everything from the source implementation
from pycore.pyfoundations.pg_sync_adapter import *  # noqa: F401, F403

try:
    from pycore.pyfoundations.pg_sync_adapter import __all__
except ImportError:
    pass
