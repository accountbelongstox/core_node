# -*- coding: utf-8 -*-
"""
SQLite State Store — DEPRECATED shim.

.. deprecated::
    ``pycore.pyfoundations.state_store`` is a legacy location.
    Import from ``pycore.database`` instead::

        from pycore.database import (
            Operation, OperationItem, OperationEvent,
            UiSnapshot, ConsumerOffset, RemoteCursor, StateRepository,
        )

    This shim re-exports from the canonical database layer for backward
    compatibility. It will be removed once all callers are migrated (FIX V4).
"""

from pycore.database import (  # noqa: F401 — re-export shim
    ConsumerOffset,
    Operation,
    OperationEvent,
    OperationItem,
    RemoteCursor,
    StateRepository,
    SystemEvent,
    UiSnapshot,
)

__all__ = [
    "Operation",
    "OperationItem",
    "OperationEvent",
    "UiSnapshot",
    "ConsumerOffset",
    "RemoteCursor",
    "StateRepository",
    "SystemEvent",
]
