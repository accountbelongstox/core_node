# -*- coding: utf-8 -*-
"""Translate history ring (Google / AI translate UI records)."""

from __future__ import annotations

import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR, get_local_data_dir
from pycore.pyfoundations.serialized_worker import call_serialized

_SHARED_STATE_DIR = get_local_data_dir() / ".ai_state"
_LEGACY_DIR = APP_DATA_DIR / "ai_state"
_INDEX_NAME = "translate_history.json"
_MAX_ENTRIES = 200
_WORK_QUEUE = "pyctl.ai.translate_history.operations"


def _state_dir():
    try:
        _SHARED_STATE_DIR.mkdir(parents=True, exist_ok=True)
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
        ColorPrint.yellow(f"[translate_history] index unreadable ({exc}); starting fresh")
    return {"version": 1, "saved_at": 0.0, "entries": []}


def _save_index(doc: Dict[str, Any]) -> None:
    doc["saved_at"] = time.time()
    path = _index_file()
    tmp = path.with_suffix(".json.tmp")
    try:
        tmp.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[translate_history] index write failed: {exc}")
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass


def _trim(doc: Dict[str, Any]) -> None:
    entries = doc.get("entries") or []
    if len(entries) > _MAX_ENTRIES:
        doc["entries"] = entries[len(entries) - _MAX_ENTRIES:]


def _record(
    *,
    source: str,
    target: str,
    text: str,
    engine: str,
    result: str,
    origin: str = "ui",
) -> Optional[Dict[str, Any]]:
    now = time.time()
    entry = {
        "id": uuid.uuid4().hex[:12],
        "ts": now,
        "iso": datetime.fromtimestamp(now, tz=timezone.utc).isoformat(),
        "source": source,
        "target": target,
        "text": text,
        "engine": engine,
        "result": result,
        "origin": origin,
    }
    doc = _load_index()
    doc.setdefault("entries", []).append(entry)
    _trim(doc)
    _save_index(doc)
    return entry


def _list_history(limit: int = 50) -> List[Dict[str, Any]]:
    lim = max(1, min(int(limit or 50), 200))
    entries = list((_load_index().get("entries") or []))
    entries.reverse()
    return entries[:lim]


def _delete_entry(entry_id: str) -> bool:
    doc = _load_index()
    before = len(doc.get("entries") or [])
    doc["entries"] = [e for e in (doc.get("entries") or []) if str(e.get("id")) != str(entry_id)]
    if len(doc["entries"]) == before:
        return False
    _save_index(doc)
    return True


def _clear_history() -> int:
    doc = _load_index()
    n = len(doc.get("entries") or [])
    doc["entries"] = []
    _save_index(doc)
    return n


def _history_count() -> int:
    return len((_load_index().get("entries") or []))


def record(**kwargs: Any) -> Optional[Dict[str, Any]]:
    return call_serialized(_WORK_QUEUE, _record, **kwargs)


def list_history(limit: int = 50) -> List[Dict[str, Any]]:
    return call_serialized(_WORK_QUEUE, _list_history, limit)


def delete_entry(entry_id: str) -> bool:
    return call_serialized(_WORK_QUEUE, _delete_entry, entry_id)


def clear_history() -> int:
    return call_serialized(_WORK_QUEUE, _clear_history)


def history_count() -> int:
    return call_serialized(_WORK_QUEUE, _history_count)


__all__ = [
    "record",
    "list_history",
    "delete_entry",
    "clear_history",
    "history_count",
]
