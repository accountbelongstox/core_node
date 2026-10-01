# -*- coding: utf-8 -*-
"""Hub test history: the one durable record stream for every model test,
including the AI provider availability probes.

Records live in a bounded JSON index store under the AI state dir. Audio and
image bytes stay in their own stores (speech_history, ai_image_history); a hub
record only links to them through ``result_ref``.
"""

import time
import uuid
from typing import Any, Dict, List, Optional

from pycore.pyctl.ai.ai_state import ai_state_dir
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.common.json_index_store import JsonIndexStore
from pycore.pyutils.common.keyset_cursor import KeysetKey
from pycore.pyutils.common.user_data_store import (
    USER_DATA_SECTION_AI_HUB_HISTORY,
    user_data_store,
)
from pycore.pyfoundations.event_journal import event_journal

HISTORY_MAX_ENTRIES = 300
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


def _legacy_entries() -> List[Dict[str, Any]]:
    """One-shot migration source: the user-data section (newest first) that held
    the history before."""
    section = user_data_store.get_section(USER_DATA_SECTION_AI_HUB_HISTORY) or {}
    return list(reversed([dict(entry) for entry in section.get("entries") or []]))


def _drop_legacy_section() -> None:
    user_data_store.delete(USER_DATA_SECTION_AI_HUB_HISTORY)


history_store = JsonIndexStore(
    "ai_hub_history.json",
    ai_state_dir,
    HISTORY_MAX_ENTRIES,
    "ai_hub_history",
    id_key="record_id",
    seed=_legacy_entries,
    seed_done=_drop_legacy_section,
)


def _matches(entry: Dict[str, Any], match: Optional[str], category: Optional[str]) -> bool:
    return (not match or match in (entry.get("key"), entry.get("id"))) and (
        not category or entry.get("category") == category
    )


def _publish(change: str, key: str, category: str, record_id: str) -> None:
    payload = {
        "change": change,
        "key": key,
        "category": category,
        "record_id": record_id,
    }
    event_journal.publish_topic(
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
        "record_id": f"hub_{uuid.uuid4().hex[:12]}",
        "created_at": time.time(),
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
    after: Optional[KeysetKey],
    limit: int,
    match: Optional[str] = None,
    category: Optional[str] = None,
) -> Dict[str, Any]:
    """One newest-first keyset page ``{items, next_cursor, has_more, total}`` of
    the matching records, keyed by ``(created_at, record_id)``."""
    return history_store.page(
        after, limit, sort_field="created_at",
        keep=lambda entry: _matches(entry, match or None, category or None),
    )


def delete_record(record_id: str) -> bool:
    removed = history_store.delete(str(record_id or ""))
    if removed is None:
        return False
    _publish("deleted", str(removed.get("key") or ""), str(removed.get("category") or ""), str(record_id))
    return True


def _wipe(doc: Dict[str, Any], match: Optional[str], category: Optional[str]) -> int:
    keep = [entry for entry in doc["entries"] if not _matches(entry, match, category)]
    removed = len(doc["entries"]) - len(keep)
    doc["entries"] = keep
    return removed


def clear_records(match: Optional[str] = None, category: Optional[str] = None) -> int:
    removed = history_store.mutate(lambda doc: _wipe(doc, match or None, category or None))
    if removed:
        _publish("cleared", match or "", category or "", "")
    return removed


__all__ = [
    "HISTORY_MAX_ENTRIES",
    "clear_records",
    "clip_text",
    "delete_record",
    "history_store",
    "list_records",
    "record",
    "sanitize_params",
]
