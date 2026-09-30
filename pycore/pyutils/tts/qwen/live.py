# -*- coding: utf-8 -*-
"""Normalized live view of the Qwen3-TTS server (QwenLive).

The server ``/status`` payload is flat (queue fields spread at the top level,
jobs carry chunk progress as ``progress``/``progress_total``). This module is
the ONE place that turns it into the shape every consumer reads: the model-live
snapshot/topic, ``ui/qwen/model/status`` and the agent-history summary.
"""

from typing import Any, Dict, List, Optional

JOB_STATE_PENDING = "pending"
JOB_STATE_RUNNING = "running"
ACTIVE_JOB_STATES = (JOB_STATE_PENDING, JOB_STATE_RUNNING)
_TERMINAL_STATES = ("done", "failed", "cancelled")
_RECENT_LIMIT = 10


def _int(value: Any) -> int:
    return int(value) if isinstance(value, (int, float)) else 0


def normalize_job(job: Dict[str, Any]) -> Dict[str, Any]:
    """One server job (status row or event job) in the live job shape."""
    progress = _int(job.get("progress"))
    total = _int(job.get("progress_total"))
    return {
        "job_id": str(job.get("job_id") or ""),
        "status": str(job.get("status") or ""),
        "progress": progress,
        "progress_total": total,
        "chunks_completed": progress,
        "chunks_total": total,
        "phase": str(job.get("progress_phase") or ""),
        "queue_position": _int(job.get("queue_position")),
        "elapsed_ms": job.get("elapsed_ms"),
        "running_elapsed_ms": job.get("running_elapsed_ms"),
        "progress_age_ms": job.get("progress_age_ms"),
        "text_summary": str(job.get("text_summary") or ""),
        "language": job.get("language"),
        "speaker": job.get("speaker"),
        "submitted_at": job.get("submitted_at"),
        "started_at": job.get("started_at"),
        "finished_at": job.get("finished_at"),
        "result_bytes": job.get("result_bytes"),
        "error": job.get("error"),
    }


def _recent_entry(job: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "job_id": str(job.get("job_id") or ""),
        "ok": job.get("status") == "done",
        "status": str(job.get("status") or ""),
        "elapsed_ms": job.get("elapsed_ms"),
        "result_bytes": job.get("result_bytes"),
        "language": job.get("language"),
        "speaker": job.get("speaker"),
        "finished_at": job.get("finished_at"),
        "error": job.get("error"),
    }


def offline_live() -> Dict[str, Any]:
    return {
        "online": False,
        "model_loaded": False,
        "device": None,
        "dtype": None,
        "model_id": None,
        "attention": None,
        "max_parallel": 0,
        "capacity_plan": {},
        "gpu": {},
        "queue": {
            "pending": 0,
            "running": 0,
            "queue_max": 0,
            "stalled": False,
            "consumer_running": False,
            "oldest_running_ms": 0,
            "oldest_progress_age_ms": 0,
            "average_elapsed_ms": 0,
        },
        "jobs": [],
        "recent": [],
        "synthesized_count": 0,
        "failed_count": 0,
        "synthesis_runtime": {},
    }


def normalize_status(status: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """QwenLive from the flat server ``/status`` payload (offline when None)."""
    if not isinstance(status, dict) or not status.get("ok"):
        return offline_live()
    raw_jobs: List[Dict[str, Any]] = [
        job for job in (status.get("jobs") or []) if isinstance(job, dict)
    ]
    counts = status.get("counts") if isinstance(status.get("counts"), dict) else {}
    active = [
        normalize_job(job) for job in raw_jobs
        if job.get("status") in ACTIVE_JOB_STATES
    ]
    active.sort(key=lambda job: (
        0 if job["status"] == JOB_STATE_RUNNING else 1,
        job["queue_position"],
        str(job.get("submitted_at") or ""),
    ))
    finished = [job for job in raw_jobs if job.get("status") in _TERMINAL_STATES]
    finished.sort(key=lambda job: str(job.get("finished_at") or ""), reverse=True)
    return {
        "online": True,
        "model_loaded": bool(status.get("model_loaded")),
        "device": status.get("device"),
        "dtype": status.get("dtype"),
        "model_id": status.get("model_id"),
        "attention": status.get("attention_implementation"),
        "max_parallel": _int(status.get("max_parallel")),
        "capacity_plan": dict(status.get("capacity_plan") or {}),
        "gpu": dict(status.get("gpu") or {}),
        "queue": {
            "pending": _int(counts.get("pending")),
            "running": _int(counts.get("running")),
            "queue_max": _int(status.get("queue_max")),
            "stalled": bool(status.get("stalled")),
            "consumer_running": bool(status.get("consumer_running")),
            "oldest_running_ms": _int(status.get("oldest_running_ms")),
            "oldest_progress_age_ms": _int(status.get("oldest_progress_age_ms")),
            "average_elapsed_ms": _int(status.get("average_elapsed_ms")),
        },
        "jobs": active,
        "recent": [_recent_entry(job) for job in finished[:_RECENT_LIMIT]],
        "synthesized_count": _int(status.get("synthesized_count")),
        "failed_count": _int(status.get("failed_count")),
        "synthesis_runtime": dict(status.get("synthesis_runtime") or {}),
    }


def live_active(live: Dict[str, Any]) -> bool:
    queue = live.get("queue") or {}
    return _int(queue.get("pending")) > 0 or _int(queue.get("running")) > 0


def decorate_status(status: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Raw ``/status`` keys kept as is, plus the normalized ``queue`` and
    ``live`` blocks (the agent-history panel reads ``qwen.queue.pending``)."""
    live = normalize_status(status)
    decorated: Dict[str, Any] = dict(status) if isinstance(status, dict) else {"ok": False}
    decorated["queue"] = live["queue"]
    decorated["live"] = live
    return decorated


__all__ = [
    "decorate_status",
    "live_active",
    "normalize_job",
    "normalize_status",
    "offline_live",
]
