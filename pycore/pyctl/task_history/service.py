# -*- coding: utf-8 -*-
"""
Task History service for the cross-end "Recent Tasks" log.
"""

import base64
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyctl.desktop.task_manager import task_manager
from pycore.pyctl.task_history.archive import completed_task_archive
from pycore.pyctl.task_history.store import (
    append_record,
    clear_records,
    query_records,
)
from pycore.pyutils.common.task_type_contract import normalize_task_type

_RING_MAX = 100
_SUCCESS_STATUSES = ("completed", "submitted", "already_done")


def get_completed_archive(
    task_type: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> Dict[str, Any]:
    normalized_task_type = normalize_task_type(task_type) if task_type else None
    return completed_task_archive.query(
        task_type=normalized_task_type,
        limit=limit,
        offset=offset,
    )


def completed_archive_resource(cache_key: str) -> Dict[str, Any]:
    path = completed_task_archive.resource_path(cache_key)
    if path is None:
        return {"success": False, "error": "Cached resource not found"}
    resource_path = Path(path)
    if not resource_path.is_file():
        return {"success": False, "error": "Cached resource is not a file"}
    content = resource_path.read_bytes()
    mime, _encoding = mimetypes.guess_type(resource_path.name)
    return {
        "success": True,
        "mime": mime or "application/octet-stream",
        "content_base64": base64.b64encode(content).decode("ascii"),
        "bytes": len(content),
        "filename": resource_path.name,
    }


def _iso(value: Optional[str]) -> str:
    if isinstance(value, str) and value:
        return value
    return datetime.now(timezone.utc).isoformat()


def _to_record(seq: int, task: Dict[str, Any]) -> Dict[str, Any]:
    status = task.get("status") or "pending"
    result = task.get("result") if isinstance(task.get("result"), dict) else {}
    input_data = task.get("input_data") if isinstance(task.get("input_data"), dict) else {}
    success = status in _SUCCESS_STATUSES

    words = input_data.get("words")
    words_preview = ""
    if isinstance(words, list) and words:
        labels = []
        for entry in words:
            if isinstance(entry, str) and entry.strip():
                labels.append(entry.strip())
            elif isinstance(entry, dict):
                w = entry.get("word") or entry.get("content")
                if isinstance(w, str) and w.strip():
                    labels.append(w.strip())
        if labels:
            words_preview = ", ".join(labels[:5])
            if len(labels) > 5:
                words_preview += f" +{len(labels) - 5}"

    title = (
        input_data.get("content_preview")
        or words_preview
        or input_data.get("word")
        or input_data.get("text")
        or input_data.get("title")
        or input_data.get("content")
        or task.get("task_id")
        or ""
    )
    content = (
        input_data.get("content_preview")
        or input_data.get("content")
        or words_preview
        or input_data.get("text")
        or input_data.get("title")
        or title
    )

    detail: Dict[str, Any] = {}
    detail.update(input_data)
    detail.update(result or {})

    worker = str(input_data.get("_worker") or "pycore-local")
    end = str(input_data.get("_end") or "pycore")

    return {
        "ts": _iso(task.get("updated_at") or task.get("created_at")),
        "seq": seq,
        "end": end,
        "worker": worker,
        "task_type": normalize_task_type(task.get("task_type")),
        "task_id": task.get("task_id") or "",
        "source_api": "local",
        "title": str(title),
        "content": str(content),
        "language": str(input_data.get("language") or input_data.get("target_language") or ""),
        "status": status,
        "success": success,
        "posted_back": success,
        "latency_ms": None,
        "error": task.get("error"),
        "detail": detail,
        "is_local": True,
        "source": "pycore",
        "updated_at": task.get("updated_at") or task.get("created_at"),
        "last_error": task.get("error"),
    }


def get_recent_tasks(
    limit: int = 200,
    end: Optional[str] = None,
    worker: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    task_type: Optional[str] = None,
) -> Dict[str, Any]:
    row_limit = max(1, min(int(limit or 200), 1000))
    manager = task_manager
    raw = manager.get_recent_tasks(limit=row_limit)
    finished = [
        task for task in raw
        if task.get("status") not in ("pending", "processing")
    ]

    records: List[Dict[str, Any]] = [
        _to_record(seq, task) for seq, task in enumerate(finished)
    ]

    persisted = query_records(
        limit=limit,
        q=q,
        date_from=date_from,
        date_to=date_to,
        task_type=task_type,
        worker=worker,
    )
    if persisted.get("entries"):
        for pe in persisted["entries"]:
            records.append({
                "ts": pe.get("ts") or "",
                "seq": len(records),
                "end": "pycore",
                "worker": pe.get("worker") or "pycore-local",
                "task_type": normalize_task_type(pe.get("task_type")),
                "task_id": pe.get("task_id") or "",
                "source_api": "local",
                "title": str(pe.get("title") or pe.get("content") or ""),
                "content": str(pe.get("content") or pe.get("title") or ""),
                "language": str(pe.get("language") or ""),
                "status": "completed" if pe.get("success") else "failed",
                "success": bool(pe.get("success")),
                "posted_back": bool(pe.get("success")),
                "latency_ms": pe.get("latency_ms"),
                "error": pe.get("error"),
                "detail": pe.get("detail") if isinstance(pe.get("detail"), dict) else pe,
                "is_local": True,
                "source": "pycore",
                "updated_at": pe.get("ts"),
                "last_error": pe.get("error"),
            })

    archived = completed_task_archive.query(
        task_type=task_type,
        limit=row_limit,
        offset=0,
    )
    records.extend(archived.get("records") or [])

    if end:
        records = [r for r in records if r["end"] == end]
    if worker:
        records = [r for r in records if r["worker"] == worker]
    if task_type:
        canonical_task_type = normalize_task_type(task_type)
        records = [r for r in records if normalize_task_type(r.get("task_type")) == canonical_task_type]

    unique: Dict[Tuple[str, str, str, str], Dict[str, Any]] = {}
    for record in records:
        fallback = f"{record.get('ts')}:{record.get('title')}"
        identity = str(record.get("task_id") or fallback)
        key = (
            str(record.get("end") or ""),
            str(record.get("worker") or ""),
            str(record.get("task_type") or ""),
            identity,
        )
        unique[key] = record
    records = sorted(
        unique.values(), key=lambda record: str(record.get("ts") or ""), reverse=True
    )[:row_limit]
    for seq, record in enumerate(records):
        record["seq"] = seq

    total = len(records)
    success = sum(1 for r in records if r["success"])
    failed = sum(1 for r in records if r["status"] == "failed")
    posted_back = sum(1 for r in records if r["posted_back"])

    return {
        "success": True,
        "records": records,
        "count": total,
        "stats": {
            "total": total,
            "success": success,
            "failed": failed,
            "posted_back": posted_back,
            "ring_max": _RING_MAX,
            "log_path": "user_data:task_history",
            "persisted_total": persisted.get("stored", 0),
        },
        "types": archived.get("types") or {},
        "resource_count": archived.get("resource_count", 0),
        "last_sync_at": archived.get("last_sync_at"),
    }


def search_tasks(
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    task_type: Optional[str] = None,
    worker: Optional[str] = None,
    limit: int = 200,
) -> Dict[str, Any]:
    data = query_records(
        limit=limit,
        q=q,
        date_from=date_from,
        date_to=date_to,
        task_type=task_type,
        worker=worker,
    )
    return {"success": True, **data}


def clear_recent_tasks() -> Dict[str, Any]:
    manager = task_manager
    cleared = False
    try:
        clear_records()
        lock = getattr(manager, "lock", None)
        if lock is not None:
            with lock:
                tasks = getattr(manager, "tasks", None)
                history = getattr(manager, "task_history", None)
                if isinstance(tasks, dict):
                    tasks.clear()
                    cleared = True
                if isinstance(history, list):
                    history.clear()
                    cleared = True
    except Exception:
        cleared = False
    return {"ok": True, "cleared": cleared}
