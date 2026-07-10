#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Lock Manager (facade)
==========================
Thin re-export facade preserving the public import path
``pyfoundations.file_lock_manager`` / ``pycore.pyfoundations.file_lock_manager``.

The implementation was split (in-place) into two focused modules:
    - file_lock.py          -> FileLockManager + JsonData + lock constants
    - split_file_store.py   -> SplitFileStore

This module re-exports the public names so NO existing importer breaks:
    from pyfoundations.file_lock_manager import SplitFileStore as ThreadSafeJsonStore
    from pycore.pyfoundations.file_lock_manager import FileLockManager, SplitFileStore

Relative imports bind to whichever package form the caller used, avoiding the
dual-module-identity trap (pyfoundations.X vs pycore.pyfoundations.X).

Known importer: scripts/pytools/media_compressor/compressor.py
  (imports SplitFileStore as ThreadSafeJsonStore).
"""

# Public API re-export (relative -> package-form-agnostic).
from .file_lock import (
    FileLockManager,
    JsonData,
    LOCK_TIMEOUT_SECONDS,
    LOCK_RETRY_INTERVAL,
)
from .split_file_store import SplitFileStore

__all__ = [
    'FileLockManager',
    'SplitFileStore',
    'JsonData',
    'LOCK_TIMEOUT_SECONDS',
    'LOCK_RETRY_INTERVAL',
]
