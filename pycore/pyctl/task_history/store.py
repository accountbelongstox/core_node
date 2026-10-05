# -*- coding: utf-8 -*-
"""
Persistent task history in ``<local data>/task_history.sqlite3`` (survives
restart, keyword/date query). The earlier ``task_history`` section of
user_data.json is imported once (``user_data_imported`` meta key) and then
removed from the settings document.
"""

import re
import time
from typing import Any, Dict, List, Optional

from pycore.database.repositories.task_history_repository import TaskHistoryRepository
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import get_local_data_dir
from pycore.pyfoundations.time_utils import utc_now_iso
from pycore.pyutils.common.task_type_contract import match_task_type
from pycore.pyutils.common.task_type_contract import normalize_task_type
from pycore.pyutils.common.user_data_store import user_data_store

_MAX_ENTRIES = 2000
_DATABASE_FILE_NAME = "task_history.sqlite3"
_LEGACY_SECTION = "task_history"
_META_USER_DATA_IMPORTED = "user_data_imported"
_SEARCH_FIELDS = (
    "title",
    "content",
    "task_type",
    "task_id",
    "content_id",
    "language",
    "worker",
    "engine",
    "provider",
    "model",
    "audio_path",
    "error",
)


def _record_matches(entry: Dict[str, Any], pattern: re.Pattern[str]) -> bool:
    for field in _SEARCH_FIELDS:
        if pattern.search(str(entry.get(field) or "")):
            return True
    detail = entry.get("detail")
    if isinstance(detail, dict):
        for field in _SEARCH_FIELDS:
            if pattern.search(str(detail.get(field) or "")):
                return True
    return False


class _TaskHistoryState:
    """Serialize history read-modify-write operations through THREAD_BUS."""

    def __init__(self) -> None:
        self._repository: Optional[TaskHistoryRepository] = None
        init_serialized_owner(self, "task_history.state", "TaskHistoryState")

    def _repo(self) -> TaskHistoryRepository:
        if self._repository is None:
            repository = TaskHistoryRepository(get_local_data_dir() / _DATABASE_FILE_NAME)
            if not repository.meta(_META_USER_DATA_IMPORTED):
                entries = user_data_store.get_personalized_section(_LEGACY_SECTION).get("entries") or []
                rows = [dict(entry) for entry in reversed(entries) if isinstance(entry, dict)]
                repository.append_many(rows, _MAX_ENTRIES, {_META_USER_DATA_IMPORTED: utc_now_iso()})
                ColorPrint.blue(f"[TaskHistory] imported user_data task history count={len(rows)}")
            if user_data_store.get_personalized_section(_LEGACY_SECTION):
                user_data_store.delete(_LEGACY_SECTION)
            self._repository = repository
        return self._repository

    @serialized_method
    def append(self, record: Dict[str, Any]) -> None:
        row = dict(record)
        if row.get("task_type") is not None:
            row["task_type"] = normalize_task_type(row.get("task_type"))
        row.setdefault("ts", utc_now_iso())
        row.setdefault("at", int(time.time()))
        self._repo().append_many([row], _MAX_ENTRIES, {})

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
        entries: List[Dict[str, Any]] = self._repo().list_records()
        stored = len(entries)
        needle = (q or "").strip().lower()
        if needle:
            pat = re.compile(re.escape(needle), re.IGNORECASE)
            entries = [
                entry for entry in entries
                if _record_matches(entry, pat)
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
        return self._repo().clear()


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
