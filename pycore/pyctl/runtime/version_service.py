# -*- coding: utf-8 -*-
"""Runtime version snapshots for application consumers."""

import os
import time
from typing import Any, Dict

from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.system_paths import get_core_node_root

_PYCORE_CACHE = "callmodule.version.native_pycore"
_PYCORE_SCAN_RUNNING = "callmodule.version.native_pycore.scan_running"
_TTL = 15.0
_SKIP_DIRS = frozenset({".git", "__pycache__", "node_modules", ".data", ".cache", ".ruff_cache", "bak"})
_EXTENSIONS = (".py", ".ts", ".tsx", ".js", ".sh", ".ps1")


def _scan() -> Dict[str, Any]:
    root = get_core_node_root()
    scan_root = root / "pycore"
    newest = 0.0
    latest = ""
    started = time.time()
    for directory, names, files in os.walk(scan_root):
        names[:] = [name for name in names if name not in _SKIP_DIRS]
        for name in files:
            if not name.endswith(_EXTENSIONS):
                continue
            path = os.path.join(directory, name)
            try:
                modified = os.path.getmtime(path)
            except OSError:
                continue
            if modified > newest:
                newest = modified
                latest = os.path.relpath(path, root).replace("\\", "/")
    return {"last_modified_unix": int(newest),
            "last_modified_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(newest)) if newest else "",
            "latest_file": latest, "scan_ms": int((time.time() - started) * 1000)}


def _pycore_snapshot() -> Dict[str, Any]:
    now = time.time()
    cached = THREAD_BUS.get_signal(_PYCORE_CACHE, {}) or {}
    data = cached.get("data") if isinstance(cached.get("data"), dict) else None
    fresh = data and now - float(cached.get("timestamp") or 0) < _TTL
    if fresh:
        return dict(data)
    if not THREAD_BUS.get_signal(_PYCORE_SCAN_RUNNING, False):
        THREAD_BUS.signal(_PYCORE_SCAN_RUNNING, True)
        start_bus_task(_refresh_pycore_snapshot, thread_name="pycore-version-scan")
    if data:
        return dict(data)
    return {
        "last_modified_unix": 0,
        "last_modified_at": "",
        "latest_file": "",
        "scan_ms": 0,
        "refreshing": True,
    }


def _refresh_pycore_snapshot() -> None:
    data = _scan()
    THREAD_BUS.signal(_PYCORE_CACHE, {"data": data, "timestamp": time.time()})
    THREAD_BUS.clear_signal(_PYCORE_SCAN_RUNNING)


def get_version() -> Dict[str, Any]:
    return {"success": True, "pycore": _pycore_snapshot()}


__all__ = ["get_version"]
