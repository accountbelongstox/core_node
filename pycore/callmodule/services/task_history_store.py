# -*- coding: utf-8 -*-
"""
Persistent task history in user_data (survives restart, keyword/date query).
"""

import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.callmodule.services.task_type_contract import match_task_type
from pycore.callmodule.services.task_type_contract import normalize_task_type

_SECTION = "task_history"
_MAX_ENTRIES = 2000


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class _TaskHistoryState:
    """Serialize history read-modify-write operations through THREAD_BUS."""

    def __init__(self) -> None:
        init_serialized_owner(self, "task_history.state", "TaskHistoryState")

    @serialized_method
    def append(self, record: Dict[str, Any]) -> None:
        store = get_user_data_store()
        section = store.get_section(_SECTION) or {}
        entries = list(section.get("entries") or [])
        row = dict(record)
        if row.get("task_type") is not None:
            row["task_type"] = normalize_task_type(row.get("task_type"))
        row.setdefault("ts", _now_iso())
        row.setdefault("at", int(time.time()))
        entries.insert(0, row)
        if len(entries) > _MAX_ENTRIES:
            entries = entries[:_MAX_ENTRIES]
        store.set_section(_SECTION, {"entries": entries, "updated_at": _now_iso()})

    @serialized_method
    def query(
        self,
        limit: int,
        q: Optional[str],
        date_from: Optional[str],
        date_to: Optional[str],
        task_type: Optional[str],
        worker: Optional[str],
    ) -> Dict[str, Any]:
        section = get_user_data_store().get_section(_SECTION) or {}
        entries: List[Dict[str, Any]] = list(section.get("entries") or [])
        needle = (q or "").strip().lower()
        if needle:
            pat = re.compile(re.escape(needle), re.IGNORECASE)
            entries = [
                entry for entry in entries
                if pat.search(str(entry.get("title") or ""))
                or pat.search(str(entry.get("content") or ""))
                or pat.search(str(entry.get("task_type") or ""))
                or pat.search(str(entry.get("error") or ""))
            ]
        if task_type:
            entries = [
                entry for entry in entries
                if match_task_type(entry.get("task_type"), task_type)
            ]
        if worker:
            entries = [
                entry for entry in entries
                if str(entry.get("worker") or "") == worker
            ]
        if date_from:
            entries = [entry for entry in entries if str(entry.get("ts") or "") >= date_from]
        if date_to:
            entries = [entry for entry in entries if str(entry.get("ts") or "") <= date_to]
        result_limit = max(1, min(int(limit or 200), 1000))
        return {
            "entries": entries[:result_limit],
            "total": len(entries),
            "stored": len(section.get("entries") or []),
            "max": _MAX_ENTRIES,
        }

    @serialized_method
    def clear(self) -> int:
        store = get_user_data_store()
        section = store.get_section(_SECTION) or {}
        count = len(section.get("entries") or [])
        store.set_section(_SECTION, {"entries": [], "updated_at": _now_iso()})
        return count


_task_history_state = _TaskHistoryState()


def append_record(record: Dict[str, Any]) -> None:
    """Append one finished task unit (best-effort, capped ring)."""
    _task_history_state.append(record)


def query_records(
    limit: int = 200,
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    task_type: Optional[str] = None,
    worker: Optional[str] = None,
) -> Dict[str, Any]:
    return _task_history_state.query(limit, q, date_from, date_to, task_type, worker)


def clear_records() -> int:
    return _task_history_state.clear()
