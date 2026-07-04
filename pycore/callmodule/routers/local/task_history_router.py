# -*- coding: utf-8 -*-
"""
Task History router — the cross-end "Recent Tasks" log (contract: PcTaskRecent).

GET /api/local/tasks/recent backs the FE pycore-manager Queue Center "Recent"
tab (PcTaskRecentResponse in pycoreTypes.ts): a newest-first log of finished
task units with a roll-up stats block. POST /api/local/tasks/clear wipes it.

The dedicated cross-end task-record ring (pycore + chrome, with per-task latency
/ posted_back / free-form detail) is a separate subsystem that may not be wired
in this clone. This router therefore degrades to the pyctl TaskManager — the
task store that IS always present — and maps each record onto the PcTaskRecord
shape the FE expects. It does NOT whitelist task types (the log is open: every
task_type the TaskManager holds is surfaced), so no per-type label gate exists
here.

All data comes from the in-process TaskManager singleton — no network I/O.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import fastapi

from pycore.pyctl.desktop.task_manager import get_task_manager

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

    # Best-effort human title: a word/text/title from the input, else the id.
    title = (
        input_data.get("word")
        or input_data.get("text")
        or input_data.get("title")
        or task.get("task_id")
        or ""
    )

    detail: Dict[str, Any] = {}
    detail.update(input_data)
    detail.update(result or {})

    # Cross-end attribution: the recorder may tag a task with the producing
    # worker/end (e.g. assist cover/tts/poster -> worker='assist'); fall back to
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
        "language": str(input_data.get("language") or input_data.get("target_language") or ""),
        "status": status,
        "success": success,
        "posted_back": success,
        "latency_ms": None,
        "error": task.get("error"),
        "detail": detail,
    }


@router.get("/recent")
async def get_recent_tasks(
    limit: int = 200,
    end: Optional[str] = None,
    worker: Optional[str] = None,
):
    """
    Return the newest-first recent-task log + roll-up stats (PcTaskRecent).

    `limit` caps the rows; `end`/`worker` are accepted for FE filter parity
    (the local TaskManager is single-end/single-worker, so they only ever match
    'pycore' / 'pycore-local', but the params keep the endpoint contract stable).
    """
    manager = get_task_manager()
    raw = manager.get_recent_tasks(limit=max(1, min(int(limit or 200), 1000)))

    records: List[Dict[str, Any]] = [
        _to_record(seq, task) for seq, task in enumerate(raw)
    ]

    if end:
        records = [r for r in records if r["end"] == end]
    if worker:
        records = [r for r in records if r["worker"] == worker]

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
            "log_path": "",
        },
    }


@router.post("/clear")
async def clear_recent_tasks():
    """
    Wipe the recent-task history. The pyctl TaskManager exposes no public clear,
    so reset its in-memory stores defensively when reachable; degrade to a no-op
    success when the internals are unavailable (never 500 the FE clear action).
    """
    manager = get_task_manager()
    cleared = False
    try:
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
