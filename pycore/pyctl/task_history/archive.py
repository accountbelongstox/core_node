# -*- coding: utf-8 -*-
"""Bounded completed-task metadata cache with cursor pagination."""

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from pycore.pyfoundations.system_paths import get_app_cache_dir
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyctl.desktop.task_manager import task_manager
from pycore.pyctl.task_history.store import query_records
from pycore.pyutils.common.task_type_contract import (
    aggregate_task_counts,
    normalize_task_type,
)
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import (
    laravel_endpoint_manager,
)
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_LIMITS,
    GLOBAL_TASK_STATUSES_BY_ROLE,
)


_HISTORY_PATH = "/api/task-center/completed"
_PAGE_LIMIT = GLOBAL_TASK_LIMITS["completed"]
_DEFAULT_PAGE_LIMIT = GLOBAL_TASK_LIMITS["history_records"]
_ARCHIVE_RECORD_LIMIT = 2000
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_json(path: Path, value: Any) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(temp, path)


def _compact_inline_resources(value: Any, key: str = "") -> Any:
    """Keep record metadata small after inline resource bytes are cached."""
    if isinstance(value, dict):
        return {
            child_key: _compact_inline_resources(child, str(child_key))
            for child_key, child in value.items()
        }
    if isinstance(value, list):
        return [_compact_inline_resources(child, key) for child in value]
    if isinstance(value, str) and len(value) > 64:
        if "base64" in key.lower() or value.startswith("data:"):
            return "[resource omitted]"
    return value


def _task_type_counts(rows: Iterable[Dict[str, Any]]) -> Dict[str, int]:
    raw_counts: Dict[str, int] = {}
    for row in rows:
        task_type = str(row.get("task_type") or "assist")
        raw_counts[task_type] = raw_counts.get(task_type, 0) + 1
    return aggregate_task_counts(raw_counts)


class CompletedTaskArchive:
    """File-backed task archive; Laravel remains the source of truth."""

    def __init__(self) -> None:
        self.root = get_app_cache_dir() / "completed_tasks"
        self.records_dir = self.root / "records"
        self.resources_dir = self.root / "resources"
        self.manifest_path = self.root / "index.json"
        self.records_dir.mkdir(parents=True, exist_ok=True)
        self.resources_dir.mkdir(parents=True, exist_ok=True)
        init_serialized_owner(
            self,
            "completed_task_archive.state",
            "CompletedTaskArchiveState",
            timeout=10.0,
        )

    def _manifest(self) -> Dict[str, Any]:
        if not self.manifest_path.is_file():
            return {"records": [], "types": {}, "resource_count": 0, "last_sync_at": None}
        try:
            data = json.loads(self.manifest_path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {"records": []}
        except (OSError, ValueError):
            return {"records": [], "types": {}, "resource_count": 0, "last_sync_at": None}

    def _record_path(self, archive_id: str) -> Path:
        digest = hashlib.sha256(archive_id.encode("utf-8")).hexdigest()
        return self.records_dir / f"{digest}.json"

    @staticmethod
    def _title(record: Dict[str, Any]) -> str:
        payload = record.get("payload") if isinstance(record.get("payload"), dict) else {}
        for key in ("word", "title", "text", "content", "source_key", "query"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return str(record.get("task_id") or "")

    def _normalize(self, raw: Dict[str, Any], base_url: str) -> Dict[str, Any]:
        status = str(raw.get("status") or GLOBAL_TASK_STATUSES_BY_ROLE["completed"])
        successful_statuses = {
            GLOBAL_TASK_STATUSES_BY_ROLE["completed"],
            GLOBAL_TASK_STATUSES_BY_ROLE["completed_demo"],
        }
        payload = raw.get("payload") if isinstance(raw.get("payload"), dict) else {}
        result = raw.get("result") if isinstance(raw.get("result"), dict) else {}
        resources: List[Dict[str, Any]] = []
        detail = _compact_inline_resources(dict(payload))
        detail.update(_compact_inline_resources(result))
        detail["resources"] = resources
        return {
            "archive_id": f"laravel:{raw.get('source_id')}",
            "ts": raw.get("completed_at") or raw.get("updated_at") or raw.get("created_at") or _now_iso(),
            "end": "laravel",
            "worker": raw.get("worker") or "laravel",
            "task_type": normalize_task_type(raw.get("task_type")),
            "task_id": raw.get("task_id") or "",
            "source_api": base_url,
            "title": self._title(raw),
            "content": self._title(raw),
            "language": payload.get("language") or payload.get("target_language") or "",
            "status": status,
            "success": status in successful_statuses,
            "posted_back": status in successful_statuses,
            "latency_ms": None,
            "error": raw.get("error"),
            "detail": detail,
            "resources": resources,
            "execution_type": raw.get("execution_type"),
            "capability": raw.get("capability"),
        }

    def _normalize_local_task(self, raw: Dict[str, Any], base_url: str) -> Dict[str, Any]:
        payload = raw.get("input_data") if isinstance(raw.get("input_data"), dict) else {}
        result = raw.get("result") if isinstance(raw.get("result"), dict) else {}
        task_id = str(raw.get("task_id") or "")
        source = {"payload": payload, "result": result, "task_id": task_id}
        resources: List[Dict[str, Any]] = []
        detail = _compact_inline_resources(dict(payload))
        detail.update(_compact_inline_resources(result))
        detail["resources"] = resources
        status = str(raw.get("status") or "completed")
        return {
            "archive_id": f"pycore-task:{task_id}",
            "ts": raw.get("updated_at") or raw.get("created_at") or _now_iso(),
            "end": str(payload.get("_end") or "pycore"),
            "worker": str(payload.get("_worker") or "pycore-local"),
            "task_type": normalize_task_type(raw.get("task_type")),
            "task_id": task_id,
            "source_api": "local",
            "title": self._title(source),
            "content": self._title(source),
            "language": payload.get("language") or payload.get("target_language") or "",
            "status": status,
            "success": status in ("completed", "submitted", "already_done"),
            "posted_back": status in ("completed", "submitted", "already_done"),
            "latency_ms": None,
            "error": raw.get("error"),
            "detail": detail,
            "resources": resources,
            "execution_type": payload.get("execution_type"),
            "capability": payload.get("capability"),
        }

    def _normalize_history_record(self, raw: Dict[str, Any], base_url: str) -> Dict[str, Any]:
        detail = raw.get("detail") if isinstance(raw.get("detail"), dict) else {}
        source = {"payload": detail, "result": {}}
        resources: List[Dict[str, Any]] = []
        compact = _compact_inline_resources(dict(detail))
        compact["resources"] = resources
        identity_source = json.dumps({
            "task_id": raw.get("task_id"),
            "task_type": raw.get("task_type"),
            "ts": raw.get("ts"),
            "title": raw.get("title") or raw.get("content"),
        }, ensure_ascii=False, sort_keys=True)
        identity = hashlib.sha256(identity_source.encode("utf-8")).hexdigest()
        success = bool(raw.get("success"))
        return {
            "archive_id": f"pycore-history:{identity}",
            "ts": raw.get("ts") or _now_iso(),
            "end": str(raw.get("end") or "pycore"),
            "worker": str(raw.get("worker") or "pycore-local"),
            "task_type": normalize_task_type(raw.get("task_type")),
            "task_id": str(raw.get("task_id") or identity),
            "source_api": "local",
            "title": str(raw.get("title") or raw.get("content") or ""),
            "content": str(raw.get("content") or raw.get("title") or ""),
            "language": str(raw.get("language") or ""),
            "status": "completed" if success else "failed",
            "success": success,
            "posted_back": bool(raw.get("posted_back", success)),
            "latency_ms": raw.get("latency_ms"),
            "error": raw.get("error"),
            "detail": compact,
            "resources": resources,
        }

    def _store_record(self, record: Dict[str, Any], rows: Dict[str, Dict[str, Any]]) -> None:
        archive_id = str(record["archive_id"])
        _atomic_json(self._record_path(archive_id), record)
        rows[archive_id] = {
            "archive_id": archive_id,
            "task_id": record.get("task_id"),
            "task_type": record.get("task_type"),
            "status": record.get("status"),
            "ts": record.get("ts"),
            "worker": record.get("worker"),
            "resource_count": len(record.get("resources") or []),
        }

    @serialized_method
    def _commit_page(
        self,
        records: List[Dict[str, Any]],
        remote_types: Optional[Dict[str, Any]],
        next_cursor_id: Optional[int],
    ) -> Dict[str, Any]:
        """Commit one already-fetched page without holding the owner during I/O."""
        manifest = self._manifest()
        rows = {
            str(row.get("archive_id")): row
            for row in manifest.get("records", [])
            if row.get("archive_id")
        }
        for record in records:
            self._store_record(record, rows)

        ordered = sorted(
            rows.values(),
            key=lambda row: str(row.get("ts") or ""),
            reverse=True,
        )
        expired = ordered[_ARCHIVE_RECORD_LIMIT:]
        ordered = ordered[:_ARCHIVE_RECORD_LIMIT]
        for row in expired:
            self._record_path(str(row.get("archive_id") or "")).unlink(missing_ok=True)

        types = (
            aggregate_task_counts(remote_types)
            if isinstance(remote_types, dict)
            else manifest.get("types") or _task_type_counts(ordered)
        )
        next_manifest = {
            "records": ordered,
            "types": types,
            "resource_count": int(manifest.get("resource_count") or 0),
            "last_sync_at": _now_iso(),
            "next_cursor_id": next_cursor_id,
        }
        _atomic_json(self.manifest_path, next_manifest)
        return next_manifest

    def sync_page(
        self,
        limit: int = _DEFAULT_PAGE_LIMIT,
        cursor_id: int = 0,
        task_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch and cache exactly one bounded completed-task page."""
        base_url = laravel_endpoint_manager.get_active_base_url() or ""
        page_limit = max(1, min(int(limit or _DEFAULT_PAGE_LIMIT), _PAGE_LIMIT))
        cursor = max(0, int(cursor_id or 0))
        remote_limit = page_limit if cursor > 0 else max(1, page_limit * 3 // 4)
        local_limit = max(0, page_limit - remote_limit)
        records: List[Dict[str, Any]] = []
        remote_types: Optional[Dict[str, Any]] = None
        next_cursor_id: Optional[int] = None
        laravel_error: Optional[str] = None
        if base_url:
            try:
                params: Dict[str, Any] = {
                    "limit": remote_limit,
                    "cursor_id": cursor,
                    "include_types": cursor == 0,
                }
                if task_type:
                    params["task_type"] = task_type
                response = laravel_client.get(
                    _HISTORY_PATH,
                    base_url=base_url,
                    params=params,
                    timeout=15,
                )
                if response.status_code != 200:
                    laravel_error = f"Laravel HTTP {response.status_code}"
                else:
                    envelope = response.json()
                    data = envelope.get("data") if isinstance(envelope, dict) else None
                    remote_records = data.get("records") if isinstance(data, dict) else None
                    if not isinstance(remote_records, list):
                        laravel_error = "Invalid Laravel completed-history response"
                    else:
                        records.extend(
                            self._normalize(raw, base_url)
                            for raw in remote_records
                            if isinstance(raw, dict)
                        )
                        raw_cursor = data.get("next_cursor_id")
                        next_cursor_id = int(raw_cursor) if raw_cursor else None
                        types_value = data.get("types")
                        remote_types = types_value if isinstance(types_value, dict) else None
            except Exception as exc:  # noqa: BLE001 - return the bounded local page
                laravel_error = str(exc)
        else:
            laravel_error = "Laravel endpoint unavailable"

        if cursor == 0:
            local_task_limit = local_limit // 2
            history_limit = local_limit - local_task_limit
            local_tasks = task_manager.get_recent_tasks(limit=local_task_limit)
            records.extend(
                self._normalize_local_task(raw, base_url)
                for raw in local_tasks
                if raw.get("status") not in ("pending", "processing")
            )
            history = query_records(limit=history_limit)
            records.extend(
                self._normalize_history_record(raw, base_url)
                for raw in history.get("entries") or []
                if isinstance(raw, dict)
            )

        manifest = self._commit_page(records, remote_types, next_cursor_id)
        ordered_page = sorted(
            records,
            key=lambda row: str(row.get("ts") or ""),
            reverse=True,
        )[:page_limit]
        return {
            "success": True,
            "partial": laravel_error is not None,
            "laravel_error": laravel_error,
            "synced": len(records),
            "records": ordered_page,
            "count": len(ordered_page),
            "next_cursor_id": next_cursor_id,
            **{key: manifest[key] for key in ("types", "resource_count", "last_sync_at")},
        }

    def query(self, task_type: Optional[str] = None, limit: int = 200, offset: int = 0) -> Dict[str, Any]:
        manifest = self._manifest()
        rows = list(manifest.get("records") or [])
        canonical_type = normalize_task_type(task_type)
        if task_type:
            rows = [row for row in rows if normalize_task_type(row.get("task_type")) == canonical_type]
        total = len(rows)
        start = max(0, int(offset or 0))
        size = max(1, min(int(limit or 200), 1000))
        records: List[Dict[str, Any]] = []
        for sequence, row in enumerate(rows[start:start + size], start=start):
            path = self._record_path(str(row.get("archive_id")))
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(record, dict):
                    record["seq"] = sequence
                    records.append(record)
            except (OSError, ValueError):
                continue
        return {
            "success": True,
            "records": records,
            "count": len(records),
            "total": total,
            "types": manifest.get("types") or _task_type_counts(rows),
            "resource_count": int(manifest.get("resource_count") or 0),
            "last_sync_at": manifest.get("last_sync_at"),
            "offset": start,
            "limit": size,
            "next_offset": start + len(records) if start + len(records) < total else None,
        }

    def resource_path(self, cache_key: str) -> Optional[Path]:
        safe = Path(cache_key).name
        path = (self.resources_dir / safe).resolve()
        if path.parent != self.resources_dir.resolve() or not path.is_file():
            return None
        return path


completed_task_archive = CompletedTaskArchive()
