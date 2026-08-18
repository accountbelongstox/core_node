# -*- coding: utf-8 -*-
"""Persistent DIFF cursor, ID-page, and lazy task-data segments."""

import time
from typing import Any, Dict, List

from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyutils.common.queue_center_contract import (
    QUEUE_CENTER_DIFF_DELIVERY,
    task_order_key,
)
from pycore.pyutils.common.user_data_store import UserDataStore


CURSOR_NAMESPACE = "queue_diff_cursors"
ID_PAGE_NAMESPACE = "queue_diff_id_pages"
DATA_SEGMENT_NAMESPACE = "queue_diff_data_segments"
STORE_FILE_NAME = "queue_center_segments.json"
STORE_DEFAULTS_DIR = APP_CONFIG_DIR / "queue_center_empty_defaults"
PAGE_LIMIT = int(QUEUE_CENTER_DIFF_DELIVERY["id_page_limit"])
ID_LIMIT = int(QUEUE_CENTER_DIFF_DELIVERY["id_limit"])
DATA_LIMIT = int(QUEUE_CENTER_DIFF_DELIVERY["data_segment_limit"])
RETRY_AFTER_KEY = "_segment_retry_after"


class _DiffTaskSegmentCenter:
    """Own all persistent DIFF segments through one shared serialized instance."""

    def __init__(self) -> None:
        self._delivered: set[str] = set()
        self._store = UserDataStore(
            file_name=STORE_FILE_NAME,
            defaults_dir=STORE_DEFAULTS_DIR,
        )
        init_serialized_owner(
            self,
            "queue_center.diff_segments",
            "DiffTaskSegmentCenter",
        )

    @serialized_method
    def remote_cursor(self, scope: str, task_type: str) -> int:
        cursors = self._store.get_section(CURSOR_NAMESPACE)
        cursor = dict(cursors.get(scope) or {})
        remote_revisions = dict(cursor.get("remote_revisions") or {})
        return max(0, int(remote_revisions.get(str(task_type)) or 0))

    @serialized_method
    def set_remote_cursor(self, scope: str, task_type: str, revision: int) -> None:
        cursors = self._store.get_section(CURSOR_NAMESPACE)
        cursor = dict(cursors.get(scope) or {})
        remote_revisions = dict(cursor.get("remote_revisions") or {})
        remote_revisions[str(task_type)] = max(0, int(revision))
        cursor["remote_revisions"] = remote_revisions
        cursor["updated_at"] = time.time()
        cursors[scope] = cursor
        self._store.set_section(CURSOR_NAMESPACE, cursors)

    @serialized_method
    def stage(self, scope: str, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        cursors = self._store.get_section(CURSOR_NAMESPACE)
        pages = self._store.get_section(ID_PAGE_NAMESPACE)
        segments = self._store.get_section(DATA_SEGMENT_NAMESPACE)
        scope_segments = dict(segments.get(scope) or {})
        new_tasks: List[Dict[str, Any]] = []
        ids: List[str] = []

        for task in tasks:
            task_id = str(task.get("task_id") or "")
            if not task_id or task_id in scope_segments:
                continue
            if len(scope_segments) >= DATA_LIMIT:
                break
            scope_segments[task_id] = dict(task)
            self._delivered.add(self._delivery_key(scope, task_id))
            ids.append(task_id)
            new_tasks.append(task)

        if not ids:
            return []

        cursor = dict(cursors.get(scope) or {})
        cursor["revision"] = int(cursor.get("revision") or 0) + 1
        cursor["last_id"] = ids[-1]
        cursor["updated_at"] = time.time()
        cursors[scope] = cursor

        scope_pages = list(pages.get(scope) or [])
        scope_pages.append({
            "page_id": cursor["revision"],
            "ids": ids,
            "state": "ready",
            "created_at": time.time(),
        })
        pages[scope] = self._trim_pages(scope_pages)
        segments[scope] = scope_segments
        self._store.set_sections({
            CURSOR_NAMESPACE: cursors,
            ID_PAGE_NAMESPACE: pages,
            DATA_SEGMENT_NAMESPACE: segments,
        })
        return new_tasks

    @serialized_method
    def pending(self, scope: str, limit: int = DATA_LIMIT) -> List[Dict[str, Any]]:
        segments = self._store.get_section(DATA_SEGMENT_NAMESPACE)
        scope_segments = dict(segments.get(scope) or {})
        candidates: List[Dict[str, Any]] = []
        now = time.time()
        for task_id, task in scope_segments.items():
            delivery_key = self._delivery_key(scope, task_id)
            if delivery_key in self._delivered or not isinstance(task, dict):
                continue
            if float(task.get(RETRY_AFTER_KEY) or 0) > now:
                continue
            item = dict(task)
            item.pop(RETRY_AFTER_KEY, None)
            candidates.append(item)
        candidates.sort(key=self._task_order)
        pending = candidates[:max(0, int(limit))]
        for task in pending:
            self._delivered.add(
                self._delivery_key(scope, str(task.get("task_id") or ""))
            )
        return pending

    @serialized_method
    def release(self, scope: str, task_ids: List[Any]) -> None:
        """Make staged payloads dispatchable again without dropping ownership data."""
        for task_id in task_ids:
            task_key = str(task_id or "")
            if task_key:
                self._delivered.discard(self._delivery_key(scope, task_key))

    @serialized_method
    def defer(self, scope: str, task_ids: List[Any], delay_seconds: float) -> None:
        """Persist a retry deadline and release staged payloads after a failure."""
        segments = self._store.get_section(DATA_SEGMENT_NAMESPACE)
        scope_segments = dict(segments.get(scope) or {})
        retry_after = time.time() + max(0.0, float(delay_seconds))
        changed = False
        for task_id in task_ids:
            task_key = str(task_id or "")
            task = scope_segments.get(task_key)
            if not task_key or not isinstance(task, dict):
                continue
            deferred = dict(task)
            deferred[RETRY_AFTER_KEY] = retry_after
            scope_segments[task_key] = deferred
            self._delivered.discard(self._delivery_key(scope, task_key))
            changed = True
        if changed:
            segments[scope] = scope_segments
            self._store.set_section(DATA_SEGMENT_NAMESPACE, segments)

    @serialized_method
    def available_capacity(self, scope: str) -> int:
        """Return free persistent payload slots without loading business rows."""
        segments = self._store.get_section(DATA_SEGMENT_NAMESPACE)
        scope_segments = segments.get(scope) or {}
        return max(0, DATA_LIMIT - len(scope_segments))

    @serialized_method
    def consume(self, scope: str, task_id: Any) -> None:
        self.consume_many(scope, [task_id])

    @serialized_method
    def consume_many(self, scope: str, task_ids: List[Any]) -> None:
        task_keys = {str(task_id or "") for task_id in task_ids if str(task_id or "")}
        if not task_keys:
            return
        pages = self._store.get_section(ID_PAGE_NAMESPACE)
        segments = self._store.get_section(DATA_SEGMENT_NAMESPACE)
        scope_segments = dict(segments.get(scope) or {})
        for task_key in task_keys:
            scope_segments.pop(task_key, None)
            self._delivered.discard(self._delivery_key(scope, task_key))

        scope_pages = list(pages.get(scope) or [])
        remaining = set(scope_segments)
        for page in scope_pages:
            ids = [str(value) for value in page.get("ids", [])]
            if task_keys.intersection(ids) and not any(value in remaining for value in ids):
                page["state"] = "consumed"
                page["consumed_at"] = time.time()

        pages[scope] = self._trim_pages(scope_pages)
        segments[scope] = scope_segments
        self._store.set_sections({
            ID_PAGE_NAMESPACE: pages,
            DATA_SEGMENT_NAMESPACE: segments,
        })

    @serialized_method
    def set_priority(
        self,
        scope: str,
        task_id: Any,
        priority: int,
        move_to_head: bool,
    ) -> None:
        task_key = str(task_id or "")
        cursors = self._store.get_section(CURSOR_NAMESPACE)
        pages = self._store.get_section(ID_PAGE_NAMESPACE)
        segments = self._store.get_section(DATA_SEGMENT_NAMESPACE)
        cursor = dict(cursors.get(scope) or {})
        cursor["revision"] = int(cursor.get("revision") or 0) + 1
        if move_to_head:
            cursor["head_id"] = task_key
        elif str(cursor.get("head_id") or "") == task_key:
            cursor["head_id"] = None
        cursor["updated_at"] = time.time()
        cursors[scope] = cursor

        scope_pages: List[Dict[str, Any]] = []
        for page in list(pages.get(scope) or []):
            if page.get("state") != "priority":
                scope_pages.append(page)
                continue
            ids = [str(value) for value in page.get("ids", []) if str(value) != task_key]
            if ids:
                scope_pages.append({**page, "ids": ids})
        if move_to_head:
            scope_pages.insert(0, {
                "page_id": f"head-{cursor['revision']}",
                "ids": [task_key],
                "state": "priority",
                "created_at": time.time(),
            })
        pages[scope] = self._trim_pages(scope_pages)

        scope_segments = dict(segments.get(scope) or {})
        task = scope_segments.get(task_key)
        if isinstance(task, dict):
            task["priority"] = (
                max(int(task.get("priority") or 0), int(priority))
                if move_to_head
                else int(priority)
            )
            scope_segments[task_key] = task
            segments[scope] = scope_segments

        self._store.set_sections({
            CURSOR_NAMESPACE: cursors,
            ID_PAGE_NAMESPACE: pages,
            DATA_SEGMENT_NAMESPACE: segments,
        })

    @serialized_method
    def move_to_head(self, scope: str, task_id: Any, queue_position: int) -> None:
        task_key = str(task_id or "")
        if not task_key:
            return
        cursors = self._store.get_section(CURSOR_NAMESPACE)
        pages = self._store.get_section(ID_PAGE_NAMESPACE)
        segments = self._store.get_section(DATA_SEGMENT_NAMESPACE)
        cursor = dict(cursors.get(scope) or {})
        cursor["revision"] = int(cursor.get("revision") or 0) + 1
        cursor["head_id"] = task_key
        cursor["updated_at"] = time.time()
        cursors[scope] = cursor

        scope_pages: List[Dict[str, Any]] = []
        for page in list(pages.get(scope) or []):
            if page.get("state") != "head":
                scope_pages.append(page)
                continue
            ids = [str(value) for value in page.get("ids", []) if str(value) != task_key]
            if ids:
                scope_pages.append({**page, "ids": ids})
        scope_pages.insert(0, {
            "page_id": f"head-{cursor['revision']}",
            "ids": [task_key],
            "state": "head",
            "created_at": time.time(),
        })
        pages[scope] = self._trim_pages(scope_pages)

        scope_segments = dict(segments.get(scope) or {})
        task = scope_segments.get(task_key)
        if isinstance(task, dict):
            task["queue_position"] = int(queue_position)
            scope_segments[task_key] = task
            segments[scope] = scope_segments

        self._store.set_sections({
            CURSOR_NAMESPACE: cursors,
            ID_PAGE_NAMESPACE: pages,
            DATA_SEGMENT_NAMESPACE: segments,
        })

    def promote(self, scope: str, task_id: Any, priority: int) -> None:
        self.set_priority(scope, task_id, priority, True)

    def reprioritize(self, scope: str, task_id: Any, priority: int) -> None:
        self.set_priority(scope, task_id, priority, False)

    @staticmethod
    def _trim_pages(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        head = [page for page in pages if page.get("state") == "head"]
        priority = [page for page in pages if page.get("state") == "priority"]
        ready = [page for page in pages if page.get("state") == "ready"]
        consumed = [page for page in pages if page.get("state") == "consumed"]
        candidates = head + priority + list(reversed(ready)) + list(reversed(consumed))
        total_ids = 0
        bounded: List[Dict[str, Any]] = []
        for page in candidates:
            if len(bounded) >= PAGE_LIMIT:
                break
            ids = list(page.get("ids") or [])
            if total_ids + len(ids) > ID_LIMIT:
                continue
            bounded.append(page)
            total_ids += len(ids)
        return bounded

    @staticmethod
    def _task_order(task: Dict[str, Any]) -> tuple[int]:
        return task_order_key(task)

    @staticmethod
    def _delivery_key(scope: str, task_id: Any) -> str:
        return f"{scope}:{task_id}"


diff_task_segment_store = _DiffTaskSegmentCenter()


__all__ = ["diff_task_segment_store"]
