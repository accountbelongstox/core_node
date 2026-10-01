# -*- coding: utf-8 -*-
"""
Shared AI usage log: every AI / capability call (text, vision, image, tts,
stt). Cross-runtime: the Laravel side mirrors this contract in
``App\\Services\\AiGateway\\AiUsageLog`` and appends to the same file.

Layout: ``<AI state dir>/ai_usage_records.json`` - newest-last ring + rollups.

Record: { id, ts, iso, runtime, kind, provider, model, source, success,
          latency_ms, error, error_code, provider_reached, quota_counted,
          context, prompt?, response? }
Rollups: stats[provider][kind] = {calls, ok, failed} (+ last_ts, last_model);
source_stats via ``usage_rollup``.
"""

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyctl.ai.ai_state import ai_state_dir
from pycore.pyctl.ai.ai_text_log import RUNTIME, log_ai_call
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.json_index_store import JsonIndexStore
from pycore.pyutils.common.keyset_cursor import KeysetKey, keyset_page
from pycore.pyutils.common.usage_rollup import usage_rollup

MAX_ENTRIES = 5000
KINDS = ("text", "vision", "probe", "image", "tts", "stt")
DEFAULT_KIND = "text"
DETAIL_CAP = 12000


def _rollup_defaults() -> Dict[str, Any]:
    return {"stats": {}, "source_stats": {}}


usage_store = JsonIndexStore(
    "ai_usage_records.json", ai_state_dir, MAX_ENTRIES, "ai_usage_log", extra_defaults=_rollup_defaults,
)


class AiCallTracker:
    """In-flight AI calls (in memory only, never persisted)."""

    def __init__(self) -> None:
        self._calls: Dict[str, Dict[str, Any]] = {}
        init_serialized_owner(self, "pyctl.ai.usage_log.in_flight", "AiCallTracker")

    @serialized_method
    def begin(self, info: Dict[str, Any]) -> str:
        call_id = uuid.uuid4().hex
        started = time.time()
        self._calls[call_id] = {
            **dict(info or {}),
            "id": call_id,
            "started_ts": started,
            "iso": datetime.fromtimestamp(started, timezone.utc).isoformat(timespec="seconds"),
        }
        return call_id

    @serialized_method
    def end(self, call_id: str) -> None:
        self._calls.pop(str(call_id or ""), None)

    @serialized_method
    def rows(self) -> List[Dict[str, Any]]:
        now = time.time()
        rows = [
            {**entry, "elapsed_ms": round((now - float(entry.get("started_ts") or now)) * 1000, 1)}
            for entry in self._calls.values()
        ]
        rows.sort(key=lambda item: float(item.get("started_ts") or 0.0))
        return rows


ai_call_tracker = AiCallTracker()


def _publish_changed() -> None:
    event_journal.publish_topic(BusSignals.AI_USAGE_CHANGED, {"revision": usage_store.revision()})


def begin_call(info: Dict[str, Any]) -> str:
    call_id = ai_call_tracker.begin(info)
    _publish_changed()
    return call_id


def end_call(call_id: str) -> None:
    ai_call_tracker.end(call_id)
    _publish_changed()


def in_flight_calls() -> List[Dict[str, Any]]:
    return ai_call_tracker.rows()


def _cap_detail(value: Any) -> Optional[str]:
    return None if value is None else str(value)[:DETAIL_CAP]


def _append_usage(doc: Dict[str, Any], entry: Dict[str, Any]) -> None:
    if not doc["source_stats"] and doc["entries"]:
        doc["source_stats"] = usage_rollup.rebuild(doc["entries"])
    doc["entries"].append(entry)
    provider_stats = doc["stats"].setdefault(entry["provider"], {})
    bucket = provider_stats.setdefault(entry["kind"], {"calls": 0, "ok": 0, "failed": 0})
    bucket["calls"] += 1
    bucket["ok" if entry["success"] else "failed"] += 1
    provider_stats["last_ts"] = entry["ts"]
    provider_stats["last_model"] = entry["model"]
    usage_rollup.update(doc["source_stats"], entry)


def record_usage(
    kind: str,
    provider: str,
    model: str = "",
    success: bool = False,
    latency_ms: Optional[float] = None,
    source: str = "",
    error: Optional[str] = None,
    runtime: str = RUNTIME,
    error_code: str = "",
    provider_reached: Optional[bool] = None,
    quota_counted: Optional[bool] = None,
    context: Optional[Dict[str, Any]] = None,
    prompt: Optional[str] = None,
    response: Optional[str] = None,
) -> None:
    """Append one usage record and mirror it to the flat operator log."""
    kind = (kind or "").strip().lower()
    if kind not in KINDS:
        kind = DEFAULT_KIND
    ts = time.time()
    entry: Dict[str, Any] = {
        "id": uuid.uuid4().hex,
        "ts": ts,
        "iso": datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds"),
        "runtime": runtime or RUNTIME,
        "kind": kind,
        "provider": (provider or "").strip(),
        "model": model or "",
        "source": source or "",
        "success": bool(success),
        "latency_ms": latency_ms,
        "error": error,
        "error_code": error_code or None,
        "provider_reached": provider_reached,
        "quota_counted": quota_counted,
        "context": dict(context or {}),
    }
    for name, value in (("prompt", _cap_detail(prompt)), ("response", _cap_detail(response))):
        if value is not None:
            entry[name] = value
    usage_store.mutate(lambda doc: _append_usage(doc, entry))
    _publish_changed()
    log_ai_call(
        kind, entry["provider"], model=entry["model"], source=source,
        success=bool(success), latency_ms=latency_ms, error=error, runtime=runtime or RUNTIME,
    )


def _filtered_records(
    doc: Dict[str, Any],
    kind: Optional[str],
    provider: Optional[str],
    sources: Optional[List[str]],
    day: str,
) -> List[Dict[str, Any]]:
    """Newest-first records matching ``kind`` / ``provider`` / ``sources`` /
    ``day`` (YYYY-MM-DD)."""
    kind = (kind or "").strip().lower() or None
    provider = (provider or "").strip().lower() or None
    day = str(day or "").strip()
    source_set = {str(source) for source in (sources or []) if str(source)}
    records = list(reversed(doc["entries"]))
    if kind:
        records = [r for r in records if r.get("kind") == kind]
    if provider:
        records = [r for r in records if str(r.get("provider") or "").lower() == provider]
    if source_set:
        records = [r for r in records if str(r.get("source") or "") in source_set]
    if day:
        records = [r for r in records if str(r.get("iso") or "").startswith(day)]
    return records


def _rollups(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "storage_path": str(usage_store.path()),
        "stats": dict(doc["stats"]),
        "source_stats": dict(doc["source_stats"]) or usage_rollup.rebuild(doc["entries"]),
        "in_flight": in_flight_calls(),
    }


def usage_log(
    after: Optional[KeysetKey],
    limit: int,
    kind: Optional[str] = None,
    provider: Optional[str] = None,
    sources: Optional[List[str]] = None,
    day: str = "",
) -> Dict[str, Any]:
    """One newest-first keyset page of records (+ whole-store rollups) for the
    UI: ``{success, items, next_cursor, has_more, total, storage_path, stats,
    source_stats, in_flight}``, keyed by ``(ts, id)``."""
    doc = usage_store.document()
    records = _filtered_records(doc, kind, provider, sources, day)
    page = keyset_page(records, after, limit, _usage_key)
    return {"success": True, **_rollups(doc), **page, "total": len(records)}


def usage_snapshot(
    limit: int,
    kind: Optional[str] = None,
    provider: Optional[str] = None,
    sources: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """The newest ``limit`` matching records plus the rollups, for in-process
    summaries (not a list route)."""
    doc = usage_store.document()
    records = _filtered_records(doc, kind, provider, sources, "")
    return {**_rollups(doc), "entries": records[:max(1, int(limit))], "total": len(records)}


def _usage_key(record: Dict[str, Any]) -> KeysetKey:
    return float(record.get("ts") or 0), str(record.get("id") or "")


def usage_revision() -> str:
    return usage_store.revision()


def _reset_rollups(doc: Dict[str, Any]) -> None:
    doc.update(_rollup_defaults())


def clear_usage() -> int:
    """Delete ALL usage records + rollups. Returns the count removed."""
    removed = usage_store.clear(_reset_rollups)
    _publish_changed()
    return removed


__all__ = [
    "RUNTIME",
    "begin_call",
    "clear_usage",
    "end_call",
    "in_flight_calls",
    "record_usage",
    "usage_log",
    "usage_snapshot",
    "usage_revision",
    "usage_store",
]
