# -*- coding: utf-8 -*-
"""
codesync — lightweight, stdlib-only Code Sync library.

Designed to run in TWO modes from ONE codebase:

* Standalone (`pyservice.sh codesync ...`): imported as the TOP-LEVEL name
  `codesync` (the bootstrap puts pycore/pyutils on sys.path), so pycore/__init__.py
  is never executed. Uses only the Python standard library — no `requests`, no
  FastAPI, no `third_party`, no pycore import.

* Inside full pycore: imported as `pycore.pyutils.codesync`. pycore calls
  `configure(...)` once at startup to inject its richer services (ColorPrint
  logging, THREAD_BUS event bus / shutdown, machine-id). The FastAPI router and
  the manager then share this exact implementation.

The package NEVER imports `pycore` at module level; all host services arrive via
`configure()`. See CODESYNC_LITE_DESIGN.md (in device_sync/docs/) for the architecture.
"""

from .runtime import configure
from .manager import get_manager, get_code_sync_manager
from . import cli, daemon

__all__ = [
    "configure",
    "get_manager",
    "get_code_sync_manager",
    "cli",
    "daemon",
]
