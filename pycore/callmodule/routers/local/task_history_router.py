# -*- coding: utf-8 -*-
"""
Task History router — the cross-end "Recent Tasks" log (contract: PcTaskRecent).

GET /api/local/tasks/recent backs the FE pycore-manager Queue Center "Recent"
tab (PcTaskRecentResponse in pycoreTypes.ts): a newest-first log of finished
task units with a roll-up stats block. POST /api/local/tasks/clear wipes it.

The response merges the persistent cross-end task store, completed-task archive
and the in-process pyctl TaskManager fallback. Every task_type is surfaced; no
per-type label gate exists here.

Reads combine the in-process TaskManager with the local persistent stores. Only
the explicit completed-archive sync endpoint contacts Laravel.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import fastapi
from fastapi.responses import FileResponse

from pycore.pyctl.desktop.task_manager import get_task_manager
from pycore.callmodule.services.completed_task_archive import get_completed_task_archive
from pycore.callmodule.services.task_history_store import (
    append_record,
    clear_records,
    query_records,
)

router = fastapi.APIRouter(
    prefix="/api/local/tasks",
    tags=["Local Processing - Task History"],
)

# Ring capacity advertised in the stats block (mirrors the TaskManager's
# max_history default; informational for the FE).
_RING_MAX = 100

# Statuses that count as a successful finish for the roll-up + the per-record
# `success` flag.
_SUCCESS_STATUSES = ("completed", "submitted", "already_done")


@router.get("/completed")
def get_completed_archive(
    task_type: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
):
    return get_completed_task_archive().query(
        task_type=task_type,
        limit=limit,
        offset=offset,
    )


@router.post("/completed/sync")
def sync_completed_archive():
    return get_completed_task_archive().sync_all()


@router.get("/completed/resources/{cache_key}")
def completed_archive_resource(cache_key: str):
    path = get_completed_task_archive().resource_path(cache_key)
    if path is None:
        raise fastapi.HTTPException(status_code=404, detail="Cached resource not found")
    return FileResponse(path)


def _iso(value: Optional[str]) -> str:
    """Normalize a created/updated timestamp to a string (best-effort)."""
    if isinstance(value, str) and value:
        return value
    return datetime.now(timezone.utc).isoformat()


def _to_record(seq: int, task: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map one pyctl TaskManager dict onto the FE PcTaskRecord shape. The local
    TaskManager has no cross-end attribution, so `end`/`worker`/`source_api`
    degrade to the pycore-local defaults; `detail` carries the raw
    input_data/result so the expand row is never empty.
    """
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

    # Best-effort human title: preview/words/text from the input, else the id.
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

    # Cross-end attribution: the recorder may tag a task with the producing
    # worker/end (e.g. canonical TTS or mcp-chrome media); fall back to
    # the pycore-local defaults so existing records are unchanged.
    worker = str(input_data.get("_worker") or "pycore-local")
    end = str(input_data.get("_end") or "pycore")

    return {
        "ts": _iso(task.get("updated_at") or task.get("created_at")),
        "seq": seq,
        "end": end,
        "worker": worker,
        "task_type": task.get("task_type") or "unknown",
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
    }


@router.get("/recent")
def get_recent_tasks(
    limit: int = 200,
    end: Optional[str] = None,
    worker: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    task_type: Optional[str] = None,
):
    """
    Return the newest-first recent-task log + roll-up stats (PcTaskRecent).

    `limit` caps the rows; `end`/`worker` are accepted for FE filter parity
    (the local TaskManager is single-end/single-worker, so they only ever match
    'pycore' / 'pycore-local', but the params keep the endpoint contract stable).
    """
    row_limit = max(1, min(int(limit or 200), 1000))
    manager = get_task_manager()
    raw = manager.get_recent_tasks(limit=1000)
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
                "task_type": pe.get("task_type") or "unknown",
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
            })

    archived = get_completed_task_archive().query(
        task_type=task_type,
        limit=1000,
        offset=0,
    )
    records.extend(archived.get("records") or [])

    if end:
        records = [r for r in records if r["end"] == end]
    if worker:
        records = [r for r in records if r["worker"] == worker]
    if task_type:
        records = [r for r in records if r["task_type"] == task_type]

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


@router.get("/search")
async def search_tasks(
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    task_type: Optional[str] = None,
    worker: Optional[str] = None,
    limit: int = 200,
):
    """Keyword/date query over persisted task_history only."""
    data = query_records(
        limit=limit,
        q=q,
        date_from=date_from,
        date_to=date_to,
        task_type=task_type,
        worker=worker,
    )
    return {"success": True, **data}


@router.post("/clear")
def clear_recent_tasks():
    """
    Wipe the recent-task history. The pyctl TaskManager exposes no public clear,
    so reset its in-memory stores defensively when reachable; degrade to a no-op
    success when the internals are unavailable (never 500 the FE clear action).
    """
    manager = get_task_manager()
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
