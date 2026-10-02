# -*- coding: utf-8 -*-
"""Claimed-task staging and remote diff cursors of the typed Laravel pull.

Only tasks the node claimed one by one through the typed pull are staged
(bounded by its pull capacity); the work-lease lanes never come through here.
Persistence is an indexed SQLite store written row by row."""

import json
from typing import Any, Dict, List, Optional

from pycore.database.repositories.queue_diff_repository import QueueDiffRepository
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyutils.common.queue_center_contract import (
    QUEUE_CENTER_DIFF_DELIVERY,
    QUEUE_CENTER_WORK_LEASES,
    task_order_key,
)


STORE_FILE_NAME = "queue_diff.sqlite3"
LEGACY_JSON_FILE_NAME = "queue_center_segments.json"
LEGACY_DATA_NAMESPACE = "queue_diff_data_segments"
LEGACY_CURSOR_NAMESPACE = "queue_diff_cursors"
STAGED_TASK_LIMIT = int(QUEUE_CENTER_DIFF_DELIVERY["id_limit"])
DATA_LIMIT = int(QUEUE_CENTER_DIFF_DELIVERY["data_segment_limit"])
LEASE_LANES = frozenset(str(lane) for lane in QUEUE_CENTER_WORK_LEASES["lanes"])


class _DiffTaskSegmentCenter:
    """Own the staged claimed tasks through one shared serialized instance."""

    def __init__(self) -> None:
        self._delivered: set[str] = set()
        self._repo: Optional[QueueDiffRepository] = None
        init_serialized_owner(
            self,
            "queue_center.diff_segments",
            "DiffTaskSegmentCenter",
        )

    def _repository(self) -> QueueDiffRepository:
        if self._repo is None:
            self._repo = QueueDiffRepository(APP_CONFIG_DIR / STORE_FILE_NAME)
            self._migrate_legacy_json(self._repo)
        return self._repo

    @staticmethod
    def _migrate_legacy_json(repository: QueueDiffRepository) -> None:
        """One shot: the former JSON mirror (every lease-lane row and cursor
        of every worker id and server, rewritten whole on each change) is
        dropped; only claimed rows and cursors of non-lease task types move
        into the store. Its leaked temp files go with it."""
        legacy_path = APP_CONFIG_DIR / LEGACY_JSON_FILE_NAME
        leaked = [
            *APP_CONFIG_DIR.glob(f"{LEGACY_JSON_FILE_NAME}.tmp.*"),
            *APP_CONFIG_DIR.glob(f".{LEGACY_JSON_FILE_NAME}.tmp.*"),
        ]
        if not legacy_path.is_file() and not leaked:
            return
        kept = dropped = 0
        if legacy_path.is_file():
            try:
                legacy = json.loads(legacy_path.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                ColorPrint.yellow(f"[DiffTaskSegments] legacy {legacy_path} unreadable ({exc}); dropped")
                legacy = {}
            for scope, rows in dict(legacy.get(LEGACY_DATA_NAMESPACE) or {}).items():
                tasks = [task for task in dict(rows or {}).values() if isinstance(task, dict) and task.get("task_id")]
                live = [task for task in tasks if str(task.get("task_type") or "") not in LEASE_LANES]
                kept += len(repository.insert_new(str(scope), live, STAGED_TASK_LIMIT))
                dropped += len(tasks) - len(live)
            for scope, cursor in dict(legacy.get(LEGACY_CURSOR_NAMESPACE) or {}).items():
                for task_type, revision in dict(dict(cursor or {}).get("remote_revisions") or {}).items():
                    if str(task_type) not in LEASE_LANES:
                        repository.set_remote_cursor(str(scope), str(task_type), int(revision or 0))
            legacy_path.unlink()
        for path in leaked:
            path.unlink(missing_ok=True)
        ColorPrint.cyan(
            f"[DiffTaskSegments] migrated {LEGACY_JSON_FILE_NAME}: kept {kept} claimed task(s), "
            f"dropped {dropped} lease-lane row(s), removed {len(leaked)} leaked temp file(s)"
        )

    @serialized_method
    def remote_cursor(self, scope: str, task_type: str) -> int:
        return self._repository().remote_cursor(scope, str(task_type))

    @serialized_method
    def set_remote_cursor(self, scope: str, task_type: str, revision: int) -> None:
        self._repository().set_remote_cursor(scope, str(task_type), revision)

    @serialized_method
    def forget_worker_scopes(self, worker_id: str) -> int:
        """Drop every row and cursor of one retired worker id; the new id
        re-syncs from Laravel."""
        return self._repository().forget_worker(worker_id)

    @serialized_method
    def stage(self, scope: str, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Persist newly claimed task payloads and return the new rows. They
        count as dispatched in this process: the caller dispatches them at
        once, so ``pending`` never redelivers them."""
        repository = self._repository()
        claimed = [
            task for task in tasks
            if str(task.get("task_id") or "") and str(task.get("task_type") or "") not in LEASE_LANES
        ]
        staged = repository.insert_new(scope, claimed, max(0, STAGED_TASK_LIMIT - repository.count(scope)))
        for task in staged:
            self._delivered.add(self._delivery_key(scope, task["task_id"]))
        return staged

    @serialized_method
    def pending(self, scope: str, task_types: List[str], limit: int = DATA_LIMIT) -> List[Dict[str, Any]]:
        """Staged tasks of ``task_types`` not yet dispatched in this process
        (recovery after a restart), in contract order; they count as
        dispatched once returned."""
        candidates = [
            task for task in self._repository().tasks(scope, self._pull_types(task_types))
            if self._delivery_key(scope, task["task_id"]) not in self._delivered
        ]
        candidates.sort(key=task_order_key)
        pending = candidates[:max(0, int(limit))]
        for task in pending:
            self._delivered.add(self._delivery_key(scope, task["task_id"]))
        return pending

    @serialized_method
    def has_pending(self, scope: str, task_types: List[str]) -> bool:
        return any(
            self._delivery_key(scope, task["task_id"]) not in self._delivered
            for task in self._repository().tasks(scope, self._pull_types(task_types))
        )

    @serialized_method
    def available_capacity(self, scope: str) -> int:
        """Free staging slots of one scope."""
        return max(0, STAGED_TASK_LIMIT - self._repository().count(scope))

    @serialized_method
    def consume(self, scope: str, task_id: Any) -> None:
        self.consume_many(scope, [task_id])

    @serialized_method
    def consume_many(self, scope: str, task_ids: List[Any]) -> None:
        task_keys = sorted({str(task_id or "") for task_id in task_ids if str(task_id or "")})
        if not task_keys:
            return
        self._repository().delete(scope, task_keys)
        for task_key in task_keys:
            self._delivered.discard(self._delivery_key(scope, task_key))

    @serialized_method
    def set_priority(self, scope: str, task_id: Any, priority: int, move_to_head: bool) -> None:
        task_key = str(task_id or "")
        repository = self._repository()
        task = repository.task(scope, task_key)
        if task is None:
            return
        task["priority"] = max(int(task.get("priority") or 0), int(priority)) if move_to_head else int(priority)
        repository.replace_body(scope, task_key, task)

    @staticmethod
    def _pull_types(task_types: List[str]) -> List[str]:
        return [str(task_type) for task_type in task_types if str(task_type) not in LEASE_LANES]

    @staticmethod
    def _delivery_key(scope: str, task_id: Any) -> str:
        return f"{scope}:{task_id}"


diff_task_segment_store = _DiffTaskSegmentCenter()


__all__ = ["diff_task_segment_store"]
