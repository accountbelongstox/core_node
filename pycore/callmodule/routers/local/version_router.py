# -*- coding: utf-8 -*-
"""
Version router — pycore's own code version + the pointed-to laravel backend's.

GET /api/local/version -> {
  success, backend_configured,
  pycore:  { last_modified_unix, last_modified_at, latest_file, scan_ms },
  backend: { base_url, reachable, last_modified_unix, last_modified_at, latest_file }
}

Honors UI<->pycore<->laravel: the browser asks pycore, and pycore PROXIES the
laravel /api/dashboard/code-last-modified probe (the browser never calls laravel
directly). The pycore-manager top bar renders a "Code updated" chip for BOTH.

Both halves are TTL-cached so the ~10s FE poll never triggers a filesystem walk
or a laravel round-trip per tick. Never raises (no 500): a laravel miss degrades
to reachable:false while pycore's own version still returns.

pycore rules honored: imports at file top, logging only via ColorPrint,
English-only strings, laravel base peeked with ZERO network I/O.
"""

import os
import time
import threading
from typing import Any, Dict

import fastapi

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
# Unified pycore->Laravel HTTP gateway (times + logs + records every call).
from pycore.callmodule.services.sync.laravel_client import get_laravel_client

router = fastapi.APIRouter(prefix="/api/local", tags=["Local Processing - Version"])

# Laravel dashboard code-version probe (reused as-is).
_LARAVEL_CODE_UPDATED = "/api/dashboard/code-last-modified"
_LARAVEL_TIMEOUT = 6
# Newest-mtime scan is scoped to pycore source; skip caches/vendored/runtime trees
# so the "code updated" time reflects real source edits, not cache/runtime writes.
_SCAN_SUBDIR = "pycore"
_SCAN_EXTS = (".py", ".ts", ".tsx", ".js", ".sh", ".ps1")
_SKIP_DIRS = frozenset({
    ".git", "__pycache__", "node_modules", ".data", ".cache", ".ruff_cache",
    "bak", "static", "tts_install_assets",
})
# TTL caches so the FE poll never storms a filesystem walk / laravel call.
_PYCORE_TTL_S = 15.0
_BACKEND_TTL_S = 15.0
_pycore_cache: Dict[str, Any] = {}
_pycore_ts: float = 0.0
_backend_cache: Dict[str, Any] = {}
_backend_ts: float = 0.0
_lock = threading.Lock()


def _scan_pycore_version() -> Dict[str, Any]:
    """Newest source-file mtime under pycore/, cache/runtime trees excluded."""
    repo_root = get_core_node_root()
    scan_root = repo_root / _SCAN_SUBDIR
    newest_ts = 0.0
    newest_rel = ""
    started = time.time()
    for dirpath, dirnames, filenames in os.walk(scan_root):
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
        for name in filenames:
            if not name.endswith(_SCAN_EXTS):
                continue
            full = os.path.join(dirpath, name)
            try:
                mtime = os.path.getmtime(full)
            except OSError:
                # File vanished mid-walk (cache churn) — skip it, don't fail.
                continue
            if mtime > newest_ts:
                newest_ts = mtime
                newest_rel = os.path.relpath(full, repo_root).replace("\\", "/")
    return {
        "last_modified_unix": int(newest_ts),
        "last_modified_at": (
            time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(newest_ts)) if newest_ts else ""
        ),
        "latest_file": newest_rel,
        "scan_ms": int((time.time() - started) * 1000),
    }


def _pycore_version() -> Dict[str, Any]:
    global _pycore_cache, _pycore_ts
    now = time.time()
    with _lock:
        if _pycore_cache and (now - _pycore_ts) < _PYCORE_TTL_S:
            return dict(_pycore_cache)
    data = _scan_pycore_version()
    with _lock:
        _pycore_cache = dict(data)
        _pycore_ts = now
    return data


def _backend_base() -> str:
    """Currently-pointed laravel base URL — zero network I/O (peek, no probe)."""
    try:
        return get_laravel_endpoint_manager().get_active_base_url() or ""
    except Exception as exc:  # noqa: BLE001 - status endpoint must never break
        ColorPrint.yellow(f"[Version] laravel base peek failed: {exc}")
        return ""


def _backend_version() -> Dict[str, Any]:
    global _backend_cache, _backend_ts
    now = time.time()
    with _lock:
        if _backend_cache and (now - _backend_ts) < _BACKEND_TTL_S:
            return dict(_backend_cache)
    base = _backend_base()
    result: Dict[str, Any] = {
        "base_url": base,
        "reachable": False,
        "last_modified_unix": 0,
        "last_modified_at": "",
        "latest_file": "",
    }
    if base:
        try:
            resp = get_laravel_client().get(
                _LARAVEL_CODE_UPDATED, base_url=base, timeout=_LARAVEL_TIMEOUT
            )
            if resp.status_code == 200:
                body = resp.json()
                data = body.get("data") if isinstance(body, dict) else None
                if isinstance(data, dict):
                    result["reachable"] = True
                    result["last_modified_unix"] = int(data.get("last_modified_unix") or 0)
                    result["last_modified_at"] = str(data.get("last_modified_at") or "")
                    result["latest_file"] = str(data.get("latest_file") or "")
        except Exception as exc:  # noqa: BLE001 - never 500 on a down backend
            ColorPrint.yellow(f"[Version] laravel code-version fetch failed: {exc}")
    with _lock:
        _backend_cache = dict(result)
        _backend_ts = now
    return result


@router.get("/version")
def version():
    """pycore's own code version + the pointed-to laravel backend's (proxied)."""
    backend = _backend_version()
    return {
        "success": True,
        "backend_configured": bool(backend.get("base_url")),
        "pycore": _pycore_version(),
        "backend": backend,
    }
