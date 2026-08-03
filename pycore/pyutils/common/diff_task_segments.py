# -*- coding: utf-8 -*-
"""Persistent DIFF cursor, ID-page, and lazy task-data segments."""

import threading
import time
from typing import Any, Dict, List

from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyutils.common.queue_center_contract import QUEUE_CENTER_DIFF_DELIVERY
from pycore.pyutils.common.user_data_store import UserDataStore


CURSOR_NAMESPACE = "queue_diff_cursors"
ID_PAGE_NAMESPACE = "queue_diff_id_pages"
DATA_SEGMENT_NAMESPACE = "queue_diff_data_segments"
STORE_FILE_NAME = "queue_center_segments.json"
STORE_DEFAULTS_DIR = APP_CONFIG_DIR / "queue_center_empty_defaults"
PAGE_LIMIT = int(QUEUE_CENTER_DIFF_DELIVERY["id_page_limit"])
ID_LIMIT = int(QUEUE_CENTER_DIFF_DELIVERY["id_limit"])
DATA_LIMIT = int(QUEUE_CENTER_DIFF_DELIVERY["data_segment_limit"])


class DiffTaskSegmentStore:
    """Keep task IDs persistent and full payloads only while locally owned."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._delivered: set[str] = set()
        self._store = UserDataStore(
            file_name=STORE_FILE_NAME,
            defaults_dir=STORE_DEFAULTS_DIR,
        )

    def stage(self, scope: str, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        with self._lock:
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
            segments[scope] = self._trim_segments(scope_segments)
            self._store.set_section(CURSOR_NAMESPACE, cursors)
            self._store.set_section(ID_PAGE_NAMESPACE, pages)
            self._store.set_section(DATA_SEGMENT_NAMESPACE, segments)
            return new_tasks

    def pending(self, scope: str) -> List[Dict[str, Any]]:
        with self._lock:
            segments = self._store.get_section(DATA_SEGMENT_NAMESPACE)
            scope_segments = dict(segments.get(scope) or {})
            pending: List[Dict[str, Any]] = []
            for task_id, task in scope_segments.items():
                delivery_key = self._delivery_key(scope, task_id)
                if delivery_key in self._delivered or not isinstance(task, dict):
                    continue
                self._delivered.add(delivery_key)
                pending.append(dict(task))
            return pending

    def consume(self, scope: str, task_id: Any) -> None:
        self.consume_many(scope, [task_id])

    def consume_many(self, scope: str, task_ids: List[Any]) -> None:
        with self._lock:
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
            self._store.set_section(ID_PAGE_NAMESPACE, pages)
            self._store.set_section(DATA_SEGMENT_NAMESPACE, segments)

    def promote(self, scope: str, task_id: Any, priority: int) -> None:
        with self._lock:
            task_key = str(task_id or "")
            cursors = self._store.get_section(CURSOR_NAMESPACE)
            pages = self._store.get_section(ID_PAGE_NAMESPACE)
            segments = self._store.get_section(DATA_SEGMENT_NAMESPACE)
            cursor = dict(cursors.get(scope) or {})
            cursor["revision"] = int(cursor.get("revision") or 0) + 1
            cursor["head_id"] = task_key
            cursor["updated_at"] = time.time()
            cursors[scope] = cursor

            scope_pages = list(pages.get(scope) or [])
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
                task["priority"] = max(int(task.get("priority") or 0), int(priority))
                scope_segments[task_key] = task
                segments[scope] = scope_segments

            self._store.set_section(CURSOR_NAMESPACE, cursors)
            self._store.set_section(ID_PAGE_NAMESPACE, pages)
            self._store.set_section(DATA_SEGMENT_NAMESPACE, segments)

    @staticmethod
    def _trim_pages(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        priority = [page for page in pages if page.get("state") == "priority"]
        ready = [page for page in pages if page.get("state") == "ready"]
        consumed = [page for page in pages if page.get("state") == "consumed"]
        candidates = priority + list(reversed(ready)) + list(reversed(consumed))
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
    def _trim_segments(segments: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        if len(segments) <= DATA_LIMIT:
            return segments
        keys = list(segments)[-DATA_LIMIT:]
        return {key: segments[key] for key in keys}

    @staticmethod
    def _delivery_key(scope: str, task_id: Any) -> str:
        return f"{scope}:{task_id}"


diff_task_segment_store = DiffTaskSegmentStore()


__all__ = ["DiffTaskSegmentStore", "diff_task_segment_store"]
