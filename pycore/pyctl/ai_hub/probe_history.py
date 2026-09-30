# -*- coding: utf-8 -*-
"""Hub test history: one durable record stream for every model test.

Records live in the shared user-data store (section ``ai_hub_history``, atomic
writes, corrupt-file backup, newest first, capped). Audio and image bytes stay in
their own stores (speech_history, ai_image_history); a hub record only links to
them through ``result_ref``.
"""

import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.user_data_store import (
    USER_DATA_SECTION_AI_HUB_HISTORY,
    user_data_store,
)
from pycore.pyutils.rpc_v2.delivery import http_event_delivery_service

HISTORY_MAX_ENTRIES = 300
HISTORY_DEFAULT_LIMIT = 50
HISTORY_MAX_LIMIT = 200
PARAM_TEXT_MAX_CHARS = 300
SUMMARY_MAX_CHARS = 160
ERROR_MAX_CHARS = 400
EXCLUDED_PARAM_KEYS = frozenset({"image_data", "image_base64", "force", "audio_data"})


def sanitize_params(params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Scalar, bounded copy of the test params (no blobs, no nested objects)."""
    clean: Dict[str, Any] = {}
    for name, value in (params or {}).items():
        if name in EXCLUDED_PARAM_KEYS or value is None or value == "":
            continue
        if isinstance(value, bool) or isinstance(value, (int, float)):
            clean[name] = value
        elif isinstance(value, str):
            clean[name] = value[:PARAM_TEXT_MAX_CHARS]
        elif isinstance(value, list) and all(isinstance(item, str) for item in value):
            clean[name] = [item[:PARAM_TEXT_MAX_CHARS] for item in value[:16]]
    return clean


def clip_text(value: Any, limit: int) -> str:
    return str(value or "").strip().replace("\r", " ").replace("\n", " ")[:limit]


class AiHubHistoryStore:
    """Read-modify-write owner of the hub history section."""

    def __init__(self) -> None:
        self._revision = 0
        init_serialized_owner(self, "pyctl.ai_hub.history.state", "AiHubHistoryState")

    def _entries(self) -> List[Dict[str, Any]]:
        section = user_data_store.get_section(USER_DATA_SECTION_AI_HUB_HISTORY) or {}
        return [dict(entry) for entry in section.get("entries") or []]

    def _save(self, entries: List[Dict[str, Any]]) -> None:
        self._revision += 1
        user_data_store.set_section(
            USER_DATA_SECTION_AI_HUB_HISTORY,
            {
                "entries": entries[:HISTORY_MAX_ENTRIES],
                "updated_at": time.time(),
                "revision": self._revision,
            },
        )

    @serialized_method
    def append(self, record: Dict[str, Any]) -> Dict[str, Any]:
        entry = dict(record)
        entry["record_id"] = f"hub_{uuid.uuid4().hex[:12]}"
        entry.setdefault("created_at", time.time())
        entries = self._entries()
        entries.insert(0, entry)
        self._save(entries)
        return entry

    @serialized_method
    def query(
        self,
        match: Optional[str],
        category: Optional[str],
        limit: int,
        before: Optional[float],
    ) -> Tuple[List[Dict[str, Any]], int]:
        rows = [
            entry for entry in self._entries()
            if (not match or match in (entry.get("key"), entry.get("id")))
            and (not category or entry.get("category") == category)
        ]
        total = len(rows)
        if before is not None:
            rows = [entry for entry in rows if float(entry.get("created_at") or 0) < before]
        return rows[:limit], total

    @serialized_method
    def remove(self, record_id: str) -> Optional[Dict[str, Any]]:
        entries = self._entries()
        removed = next(
            (entry for entry in entries if entry.get("record_id") == record_id),
            None,
        )
        if removed is None:
            return None
        self._save([entry for entry in entries if entry.get("record_id") != record_id])
        return removed

    @serialized_method
    def wipe(self, match: Optional[str], category: Optional[str]) -> int:
        entries = self._entries()
        keep = [
            entry for entry in entries
            if (match and match not in (entry.get("key"), entry.get("id")))
            or (category and entry.get("category") != category)
        ]
        removed = len(entries) - len(keep)
        if removed:
            self._save(keep)
        return removed


history_store = AiHubHistoryStore()


def _publish(change: str, key: str, category: str, record_id: str) -> None:
    payload = {
        "change": change,
        "key": key,
        "category": category,
        "record_id": record_id,
    }
    http_event_delivery_service.publish_topic(
        BusSignals.AI_HUB_HISTORY_CHANGED,
        payload,
        audience="*",
        event_id=f"ai-hub-history-{change}-{record_id or key or 'all'}-{time.time_ns()}",
        entity_type="ai_hub_history",
        entity_id=record_id or key or "all",
        revision=int(time.time() * 1000),
    )


def record(
    *,
    key: str,
    entry_id: str,
    category: str,
    ok: bool,
    elapsed_ms: int,
    summary: Any,
    params: Optional[Dict[str, Any]] = None,
    result_ref: Optional[Dict[str, Any]] = None,
    error: Any = None,
) -> Dict[str, Any]:
    """Persist one test record and announce it; returns the stored record."""
    stored = history_store.append({
        "key": key,
        "id": entry_id,
        "category": category,
        "ok": bool(ok),
        "elapsed_ms": int(elapsed_ms),
        "summary": clip_text(summary, SUMMARY_MAX_CHARS),
        "params": sanitize_params(params),
        "result_ref": result_ref or None,
        "error": clip_text(error, ERROR_MAX_CHARS) or None,
    })
    _publish("added", key, category, stored["record_id"])
    return stored


def list_records(
    match: Optional[str] = None,
    category: Optional[str] = None,
    limit: Any = None,
    before: Any = None,
) -> Dict[str, Any]:
    bounded = max(1, min(HISTORY_MAX_LIMIT, int(limit or HISTORY_DEFAULT_LIMIT)))
    cursor = float(before) if before not in (None, "") else None
    rows, total = history_store.query(match or None, category or None, bounded, cursor)
    return {"records": rows, "total": total}


def delete_record(record_id: str) -> bool:
    removed = history_store.remove(str(record_id or ""))
    if removed is None:
        return False
    _publish("deleted", str(removed.get("key") or ""), str(removed.get("category") or ""), str(record_id))
    return True


def clear_records(match: Optional[str] = None, category: Optional[str] = None) -> int:
    removed = history_store.wipe(match or None, category or None)
    if removed:
        _publish("cleared", match or "", category or "", "")
    return removed


__all__ = [
    "AiHubHistoryStore",
    "HISTORY_MAX_ENTRIES",
    "clear_records",
    "clip_text",
    "delete_record",
    "history_store",
    "list_records",
    "record",
    "sanitize_params",
]
