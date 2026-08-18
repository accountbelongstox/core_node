# -*- coding: utf-8 -*-
"""
Persistent task history in user_data (survives restart, keyword/date query).
"""

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.task_history_repository import TaskHistoryRepository
from pycore.pyutils.common.task_type_contract import match_task_type
from pycore.pyutils.common.task_type_contract import normalize_task_type

_MAX_ENTRIES = 2000


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class _TaskHistoryState:
    """Serialize history read-modify-write operations through THREAD_BUS."""

    def __init__(self) -> None:
        self._repository = TaskHistoryRepository()
        init_serialized_owner(self, "task_history.state", "TaskHistoryState")

    @serialized_method
    def append(self, record: Dict[str, Any]) -> None:
        row = dict(record)
        if row.get("task_type") is not None:
            row["task_type"] = normalize_task_type(row.get("task_type"))
        row.setdefault("ts", _now_iso())
        self._repository.append(row, _MAX_ENTRIES)

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
        entries: List[Dict[str, Any]] = self._repository.list_records()
        stored = len(entries)
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
            "stored": stored,
            "max": _MAX_ENTRIES,
        }

    @serialized_method
    def clear(self) -> int:
        return self._repository.clear()


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
