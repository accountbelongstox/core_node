#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared AI *usage* log — the text/vision/probe sibling of ai_image_history
(images live there; this records everything else an AI call does).

Cross-runtime: pycore (Windows) and the Laravel apps (WSL) append to ONE file
under ``<core_node>/.ai_state`` — the only path both see as a single file
(D:\\..\\core_node == /mnt/d/..\\core_node via DrvFs), the same channel
``.secret_keys`` / ``ai_rate_usage.json`` / ``ai_image_history.json`` use. The
Laravel side mirrors this contract in ``App\\Services\\AiGateway\\AiUsageLog``.

Layout:
  <core_node>/.ai_state/ai_usage_records.json   — newest-last ring buffer + stats

Record (the shape the UI / Laravel depend on):
  { ts, iso, runtime: 'pycore'|'laravel', kind: 'text'|'vision'|'probe',
    provider, model, source, success, latency_ms, error }

Per-provider/kind rollup (so the UI can show "gemini: text 18 ok / 2 failed"):
  stats: { "<provider>": { "<kind>": {calls, ok, failed}, last_ts, last_model } }

Safety mirrors ai_image_history / ai_rate_limits: tmp file + atomic os.replace +
an in-process lock. Cross-runtime DrvFs locking is unreliable, but calls are
seconds apart so the lost-update window is negligible and atomic replace prevents
corruption. All imports at file top (PYTHON_PYCORE.md §1.4); ColorPrint logging.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR, get_core_node_root, get_local_data_dir
from pycore.pyctl.ai.ai_text_log import log_ai_call
from pycore.pyutils.common.usage_rollup import usage_rollup
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

RUNTIME = "pycore"

# Cross-runtime shared store (see module docstring + ai_rate_limits rationale).
# Lives under <cache>/pycore/.ai_state; the prior <core_node>/.ai_state
# location is migrated once on first access.
_SHARED_STATE_DIR = get_local_data_dir() / ".ai_state"
_OLD_SHARED_DIR = get_core_node_root() / ".ai_state"
_LEGACY_DIR = APP_DATA_DIR / "ai_state"

# Newest-last ring buffer cap.
_MAX_ENTRIES = 5000
# Every AI/capability call kind the unified usage log accepts. text/vision/probe
# flow through the AI gateway; image/tts/stt are folded in so the global usage
# history + per-provider rollup reflect EVERY AI call, not just chat/vision.
_KINDS = ("text", "vision", "probe", "image", "tts", "stt")

_WORK_QUEUE = 'pyctl.ai.usage_log.operations'


def _migrate_old_state():
    """Move files from the prior shared dir (<core_node>/.ai_state) into the new
    <cache>/pycore/.ai_state once (idempotent; shared by all AI-state modules)."""
    try:
        if not _OLD_SHARED_DIR.exists() or _OLD_SHARED_DIR.resolve() == _SHARED_STATE_DIR.resolve():
            return
        for item in _OLD_SHARED_DIR.iterdir():
            dest = _SHARED_STATE_DIR / item.name
            if not dest.exists():
                os.replace(str(item), str(dest))
    except Exception:
        pass


def _state_dir():
    """Shared ``<cache>/pycore/.ai_state`` dir (legacy fallback when
    the cache root is not writable, e.g. a read-only deploy)."""
    try:
        _SHARED_STATE_DIR.mkdir(parents=True, exist_ok=True)
        _migrate_old_state()
        return _SHARED_STATE_DIR
    except Exception:
        _LEGACY_DIR.mkdir(parents=True, exist_ok=True)
        return _LEGACY_DIR


def _usage_file():
    return _state_dir() / "ai_usage_records.json"


def _load() -> Dict[str, Any]:
    path = _usage_file()
    try:
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                data.setdefault("entries", [])
                data.setdefault("stats", {})
                data.setdefault("source_stats", {})
                if (
                    isinstance(data["entries"], list)
                    and isinstance(data["stats"], dict)
                    and isinstance(data["source_stats"], dict)
                ):
                    if not data["source_stats"]:
                        data["source_stats"] = usage_rollup.rebuild(data["entries"])
                        if data["entries"]:
                            _save(data)
                    return data
    except Exception as e:  # noqa: BLE001 — a corrupt log must never crash callers
        ColorPrint.yellow(f"[ai_usage_log] log unreadable ({e}); starting fresh")
    return {
        "version": 1,
        "saved_at": 0.0,
        "entries": [],
        "stats": {},
        "source_stats": {},
    }


def _save(doc: Dict[str, Any]) -> None:
    doc["saved_at"] = time.time()
    path = _usage_file()
    tmp = path.with_suffix(".json.tmp")
    try:
        tmp.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[ai_usage_log] write failed: {e}")
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass


def _record_usage(
    kind: str,
    provider: str,
    model: str = "",
    success: bool = False,
    latency_ms: Optional[float] = None,
    source: str = "",
    error: Optional[str] = None,
    runtime: str = RUNTIME,
) -> None:
    """Append one usage record (text / vision / probe) to the shared store.

    Best-effort: any failure is logged and swallowed — recording usage must never
    break the actual AI call. ``image`` is intentionally NOT a kind here; image
    generations live in ai_image_history (with their bytes).
    """
    kind = (kind or "").strip().lower()
    if kind not in _KINDS:
        kind = "text"
    provider = (provider or "").strip()
    ts = time.time()
    entry = {
        "ts": ts,
        "iso": datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds"),
        "runtime": runtime or RUNTIME,
        "kind": kind,
        "provider": provider,
        "model": model or "",
        "source": source or "",
        "success": bool(success),
        "latency_ms": latency_ms,
        "error": error,
    }
    doc = _load()
    entries = doc.get("entries") or []
    entries.append(entry)
    if len(entries) > _MAX_ENTRIES:
        entries = entries[len(entries) - _MAX_ENTRIES:]
    doc["entries"] = entries
    stats = doc.get("stats") or {}
    provider_stats = stats.setdefault(provider, {})
    bucket = provider_stats.setdefault(
        kind,
        {"calls": 0, "ok": 0, "failed": 0},
    )
    bucket["calls"] += 1
    bucket["ok" if success else "failed"] += 1
    provider_stats["last_ts"] = ts
    provider_stats["last_model"] = entry["model"]
    doc["stats"] = stats
    source_stats = doc.get("source_stats") or {}
    usage_rollup.update(source_stats, entry)
    doc["source_stats"] = source_stats
    _save(doc)
    # Mirror to the shared flat operator log AND print one CLI line (the
    # per-call visibility that was missing). Outside the lock — the file write
    # and console print must never hold the usage-log lock.
    log_ai_call(
        kind, provider, model=entry["model"], source=source,
        success=bool(success), latency_ms=latency_ms, error=error,
        runtime=runtime or RUNTIME,
    )


def _usage_log(
    limit: int = 100,
    kind: Optional[str] = None,
    provider: Optional[str] = None,
    sources: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Newest-first records (+ per-provider/kind rollup) for the UI.

    ``kind``, ``provider``, and ``sources`` optionally filter returned records;
    aggregate stats always cover the full store. The Laravel usage endpoint
    returns the same base shape.
    """
    try:
        limit = max(1, min(_MAX_ENTRIES, int(limit)))
    except (TypeError, ValueError):
        limit = 100
    kind = (kind or "").strip().lower() or None
    provider = (provider or "").strip().lower() or None
    source_set = {str(source) for source in (sources or []) if str(source)}
    doc = _load()
    entries = list(doc.get("entries") or [])
    stats = dict(doc.get("stats") or {})
    source_stats = dict(doc.get("source_stats") or {})
    records = list(reversed(entries))
    if kind:
        records = [r for r in records if r.get("kind") == kind]
    if provider:
        records = [r for r in records if str(r.get("provider") or "").lower() == provider]
    if source_set:
        records = [r for r in records if str(r.get("source") or "") in source_set]
    return {
        "success": True,
        "storage_path": str(_usage_file()),
        "stats": stats,
        "source_stats": source_stats,
        "entries": records[:limit],
    }


def _clear_usage() -> int:
    """Delete ALL usage records + stats. Returns the count removed."""
    doc = _load()
    removed_count = len(doc.get("entries") or [])
    doc["entries"] = []
    doc["stats"] = {}
    doc["source_stats"] = {}
    _save(doc)
    return removed_count


_WORKER = SerializedWorkerThread(_WORK_QUEUE, 'AIUsageLogThread')
_WORKER.start()


def record_usage(
    kind: str,
    provider: str,
    model: str = "",
    success: bool = False,
    latency_ms: Optional[float] = None,
    source: str = "",
    error: Optional[str] = None,
    runtime: str = RUNTIME,
) -> None:
    call_serialized(
        _WORK_QUEUE,
        _record_usage,
        kind,
        provider,
        model,
        success,
        latency_ms,
        source,
        error,
        runtime,
    )


def usage_log(
    limit: int = 100,
    kind: Optional[str] = None,
    provider: Optional[str] = None,
    sources: Optional[List[str]] = None,
) -> Dict[str, Any]:
    return call_serialized(_WORK_QUEUE, _usage_log, limit, kind, provider, sources)


def _usage_revision() -> str:
    path = _usage_file()
    if not path.is_file():
        return "0:0"
    stat = path.stat()
    return f"{stat.st_mtime_ns}:{stat.st_size}"


def usage_revision() -> str:
    return str(call_serialized(_WORK_QUEUE, _usage_revision))


def clear_usage() -> int:
    return int(call_serialized(_WORK_QUEUE, _clear_usage))


__all__ = [
    "RUNTIME",
    "clear_usage",
    "record_usage",
    "usage_log",
    "usage_revision",
]
