# -*- coding: utf-8 -*-
"""
Shared image-search history (SerpApi Google-Images queries + result metadata).

Stores metadata only (no image bytes) under ``<core_node>/.data/.ai_state``.
The UI lists thumbnails via the result URLs SerpApi returned.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR, get_core_node_root

_SHARED_STATE_DIR = get_core_node_root() / ".data" / ".ai_state"
_OLD_SHARED_DIR = get_core_node_root() / ".ai_state"
_LEGACY_DIR = APP_DATA_DIR / "ai_state"
_INDEX_NAME = "image_search_history.json"
_MAX_ENTRIES = 200
_lock = threading.Lock()


def _migrate_old_state() -> None:
    try:
        if not _OLD_SHARED_DIR.exists() or _OLD_SHARED_DIR.resolve() == _SHARED_STATE_DIR.resolve():
            return
        for item in _OLD_SHARED_DIR.iterdir():
            dest = _SHARED_STATE_DIR / item.name
            if not dest.exists():
                os.replace(str(item), str(dest))
    except Exception:
        pass


def _state_dir():
    try:
        _SHARED_STATE_DIR.mkdir(parents=True, exist_ok=True)
        _migrate_old_state()
        return _SHARED_STATE_DIR
    except Exception:
        _LEGACY_DIR.mkdir(parents=True, exist_ok=True)
        return _LEGACY_DIR


def _index_file():
    return _state_dir() / _INDEX_NAME


def _load_index() -> Dict[str, Any]:
    path = _index_file()
    try:
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("entries"), list):
                return data
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[image_search_history] index unreadable ({exc}); starting fresh")
    return {"version": 1, "saved_at": 0.0, "entries": []}


def _save_index(doc: Dict[str, Any]) -> None:
    doc["saved_at"] = time.time()
    path = _index_file()
    tmp = path.with_suffix(".json.tmp")
    try:
        tmp.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[image_search_history] index write failed: {exc}")
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass


def _trim(doc: Dict[str, Any]) -> None:
    entries = doc.get("entries") or []
    if len(entries) <= _MAX_ENTRIES:
        return
    doc["entries"] = entries[len(entries) - _MAX_ENTRIES:]


def record_search(
    *,
    query: str,
    engine: str,
    results: List[Dict[str, Any]],
    country: Optional[str] = None,
    ai: Optional[Dict[str, Any]] = None,
    origin: str = "pycore",
) -> Optional[str]:
    """Append one search record. Returns the new entry id or None."""
    clean = (query or "").strip()
    if not clean:
        return None
    ts = time.time()
    entry_id = hashlib.sha1(f"{ts}:{clean}:{uuid.uuid4().hex}".encode("utf-8")).hexdigest()[:16]
    entry = {
        "id": entry_id,
        "ts": ts,
        "iso": datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds"),
        "query": clean,
        "engine": engine or "google_images",
        "country": country or None,
        "result_count": len(results or []),
        "results": results or [],
        "ai": ai,
        "origin": origin or "pycore",
    }
    with _lock:
        doc = _load_index()
        doc.setdefault("entries", []).append(entry)
        _trim(doc)
        _save_index(doc)
    return entry_id


def list_history(limit: int = 50) -> List[Dict[str, Any]]:
    lim = max(1, min(int(limit or 50), _MAX_ENTRIES))
    with _lock:
        entries = list(_load_index().get("entries") or [])
    entries.reverse()
    return entries[:lim]


def delete_entry(entry_id: str) -> bool:
    if not entry_id:
        return False
    with _lock:
        doc = _load_index()
        before = len(doc.get("entries") or [])
        doc["entries"] = [e for e in (doc.get("entries") or []) if e.get("id") != entry_id]
        if len(doc["entries"]) == before:
            return False
        _save_index(doc)
    return True


def clear_history() -> int:
    with _lock:
        doc = _load_index()
        removed = len(doc.get("entries") or [])
        doc["entries"] = []
        _save_index(doc)
    return removed


def history_count() -> int:
    with _lock:
        return len(_load_index().get("entries") or [])
