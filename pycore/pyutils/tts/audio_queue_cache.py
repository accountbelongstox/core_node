# -*- coding: utf-8 -*-
"""Whole-Queue snapshot persistence for the shared audio queue library.

Queue = Part1 + Part2 (binding model:
docs_fix/REQUIREMENTS_20260922_AUDIO_QUEUE_HEAD_PART1_PART2.md; offline-queue
requirements: docs_fix/REQUIREMENTS_20260922_WORD_AUDIO_OFFLINE_QUEUE.md).
The snapshot covers the ENTIRE Queue as ONE ordered task list plus the
INTERNAL Part1 membership set, so a restart restores the exact pop order and
part assignment. The Part1/Part2 split stays internal to the queue library —
this module is pure file persistence (no HTTP, no Laravel imports).

Cache-first boot contract: at pycore startup the queue is restored from this
file BEFORE any remote intake, so the lane drains even with Laravel offline.
"""

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_app_cache_dir

# Snapshot sources (informational; which path produced the snapshot).
SOURCE_FULL_SYNC = "full_sync"
SOURCE_LARAVEL_INTAKE = "laravel_intake"
SOURCE_LOCAL_PROMOTE = "local_promote"
SOURCE_DRAIN = "drain"

# Format version of the snapshot document (bump on incompatible changes).
SNAPSHOT_FORMAT_VERSION = 1


def _cache_dir() -> Path:
    return get_app_cache_dir() / "audio_queue"


def snapshot_path(lane: str) -> Path:
    """Per-lane snapshot file: <app_cache>/audio_queue/<lane>_queue.json."""
    return _cache_dir() / f"{str(lane or '').strip()}_queue.json"


def save_snapshot(
    lane: str,
    tasks: List[Dict[str, Any]],
    part1_keys: Set[str],
    source: str,
) -> Optional[Path]:
    """Atomically persist the whole-Queue snapshot (tmp file + os.replace).

    ``tasks`` must be in exact pop order (the whole Queue as ONE list);
    ``part1_keys`` is the INTERNAL Part1 membership set. Returns the path
    written, or None when nothing was persisted (empty queue is still
    persisted — an empty snapshot clears a stale backlog on purpose).
    """
    lane = str(lane or "").strip()
    if not lane:
        return None
    document = {
        "format_version": SNAPSHOT_FORMAT_VERSION,
        "lane": lane,
        "saved_at": int(time.time()),
        "source": str(source or ""),
        "count": len(tasks),
        # INTERNAL Part1 membership (see module docstring: split stays inside
        # the queue library; the file format is the library's own concern).
        "part1_keys": sorted(str(key) for key in (part1_keys or set())),
        "tasks": [dict(task) for task in tasks if isinstance(task, dict)],
    }
    path = snapshot_path(lane)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f"{path.name}.tmp.{os.getpid()}.{uuid.uuid4().hex}")
        with temporary.open("w", encoding="utf-8") as file_handle:
            json.dump(document, file_handle, ensure_ascii=False, default=str)
            file_handle.flush()
            os.fsync(file_handle.fileno())
        os.replace(str(temporary), str(path))
        return path
    except Exception as exc:  # noqa: BLE001 - cache write is best-effort
        ColorPrint.yellow(f"[AudioQueueCache] save {lane} failed: {exc}")
        return None


def load_snapshot(lane: str) -> Optional[Dict[str, Any]]:
    """Read one lane snapshot; None when absent/corrupt (caller boots empty)."""
    path = snapshot_path(str(lane or "").strip())
    try:
        if not path.is_file():
            return None
        with path.open("r", encoding="utf-8") as file_handle:
            document = json.load(file_handle)
    except Exception as exc:  # noqa: BLE001 - corrupt cache must not block boot
        ColorPrint.yellow(f"[AudioQueueCache] load {lane} failed: {exc}")
        return None
    if not isinstance(document, dict):
        return None
    if int(document.get("format_version") or 0) != SNAPSHOT_FORMAT_VERSION:
        ColorPrint.yellow(
            f"[AudioQueueCache] {lane} snapshot format "
            f"{document.get('format_version')} != {SNAPSHOT_FORMAT_VERSION}; ignored"
        )
        return None
    tasks = document.get("tasks")
    if not isinstance(tasks, list):
        return None
    part1_keys = document.get("part1_keys")
    return {
        "lane": str(document.get("lane") or lane),
        "saved_at": int(document.get("saved_at") or 0),
        "source": str(document.get("source") or ""),
        "tasks": [dict(task) for task in tasks if isinstance(task, dict)],
        "part1_keys": {
            str(key) for key in (part1_keys if isinstance(part1_keys, list) else [])
        },
    }


def clear_snapshot(lane: str) -> None:
    """Remove one lane snapshot (explicit reset; not part of the boot path)."""
    try:
        snapshot_path(str(lane or "").strip()).unlink(missing_ok=True)
    except OSError:
        pass


__all__ = [
    "SOURCE_DRAIN",
    "SOURCE_FULL_SYNC",
    "SOURCE_LARAVEL_INTAKE",
    "SOURCE_LOCAL_PROMOTE",
    "clear_snapshot",
    "load_snapshot",
    "save_snapshot",
    "snapshot_path",
]
