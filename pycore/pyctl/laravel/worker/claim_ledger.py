# -*- coding: utf-8 -*-
"""Bounded task_id -> (task_type, Laravel base URL) ledger of claimed tasks."""

from typing import Any, Dict, List, Tuple

CLAIM_LEDGER_LIMIT = 1000


class ClaimLedger:
    """Typed result routes need the task type and the dispatching server at
    result time; every accepted dispatch is recorded here (oldest evicted)."""

    def __init__(self, limit: int = CLAIM_LEDGER_LIMIT) -> None:
        self._limit = max(1, int(limit))
        self._entries: Dict[str, Tuple[str, str]] = {}

    def remember(self, tasks: List[Dict[str, Any]], base_url: str) -> None:
        for task in tasks:
            task_id = str(task.get("task_id") or "")
            task_type = str(task.get("task_type") or "")
            if task_id and task_type:
                # Re-insert so a task about to run is never evicted behind
                # already completed backlog rows.
                self._entries.pop(task_id, None)
                self._entries[task_id] = (task_type, str(base_url or "").rstrip("/"))
        while len(self._entries) > self._limit:
            self._entries.pop(next(iter(self._entries)))

    def holds(self, task_id: Any) -> bool:
        return str(task_id) in self._entries

    def task_type(self, task_id: Any) -> str:
        return (self._entries.get(str(task_id)) or ("", ""))[0]

    def base_url(self, task_id: Any, default: str) -> str:
        return (self._entries.get(str(task_id)) or ("", ""))[1] or default

    def forget(self, task_id: Any) -> None:
        self._entries.pop(str(task_id), None)
