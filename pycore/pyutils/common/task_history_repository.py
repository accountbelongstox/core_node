# -*- coding: utf-8 -*-
"""Durable task-history repository backed by the shared user-data store."""

from datetime import datetime, timezone
import time
from typing import Any, Dict, List

from pycore.pyutils.common.user_data_store import user_data_store


TASK_HISTORY_SECTION = "task_history"
DEFAULT_MAX_ENTRIES = 2000


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskHistoryRepository:
    """Own durable reads and writes for completed task records."""

    def append(
        self,
        record: Dict[str, Any],
        max_entries: int = DEFAULT_MAX_ENTRIES,
    ) -> None:
        section = user_data_store.get_section(TASK_HISTORY_SECTION) or {}
        entries = list(section.get("entries") or [])
        row = dict(record)
        row.setdefault("at", int(time.time()))
        entries.insert(0, row)
        user_data_store.set_section(
            TASK_HISTORY_SECTION,
            {
                "entries": entries[:max(1, int(max_entries))],
                "updated_at": _now_iso(),
            },
        )

    def list_records(self) -> List[Dict[str, Any]]:
        section = user_data_store.get_section(TASK_HISTORY_SECTION) or {}
        return [dict(entry) for entry in section.get("entries") or []]

    def clear(self) -> int:
        entries = self.list_records()
        user_data_store.set_section(
            TASK_HISTORY_SECTION,
            {"entries": [], "updated_at": _now_iso()},
        )
        return len(entries)
