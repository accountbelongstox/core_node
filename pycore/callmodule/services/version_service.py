# -*- coding: utf-8 -*-
"""Version snapshots used by the native RPC v2 UI route."""

import os
import time
from typing import Any, Dict

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.callmodule.services.sync.laravel_endpoint_manager import get_laravel_endpoint_manager
from pycore.callmodule.services.sync.laravel_client import get_laravel_client

_PYCORE_CACHE = "callmodule.version.native_pycore"
_BACKEND_CACHE = "callmodule.version.native_backend"
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
    if cached.get("data") and now - float(cached.get("timestamp") or 0) < _TTL:
        return dict(cached["data"])
    data = _scan()
    THREAD_BUS.signal(_PYCORE_CACHE, {"data": data, "timestamp": now})
    return data


def _backend_snapshot() -> Dict[str, Any]:
    now = time.time()
    cached = THREAD_BUS.get_signal(_BACKEND_CACHE, {}) or {}
    if cached.get("data") and now - float(cached.get("timestamp") or 0) < _TTL:
        return dict(cached["data"])
    base = get_laravel_endpoint_manager().get_active_base_url() or ""
    data: Dict[str, Any] = {"base_url": base, "reachable": False, "last_modified_unix": 0,
                            "last_modified_at": "", "latest_file": ""}
    if base:
        try:
            response = get_laravel_client().get("/api/dashboard/code-last-modified", base_url=base, timeout=6)
            body = response.json() if response.status_code == 200 else {}
            payload = body.get("data") if isinstance(body, dict) else None
            if isinstance(payload, dict):
                data.update({"reachable": True, "last_modified_unix": int(payload.get("last_modified_unix") or 0),
                             "last_modified_at": str(payload.get("last_modified_at") or ""),
                             "latest_file": str(payload.get("latest_file") or "")})
        except Exception:
            pass
    THREAD_BUS.signal(_BACKEND_CACHE, {"data": data, "timestamp": now})
    return data


def get_version() -> Dict[str, Any]:
    backend = _backend_snapshot()
    return {"success": True, "backend_configured": bool(backend.get("base_url")),
            "pycore": _pycore_snapshot(), "backend": backend}


__all__ = ["get_version"]
