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
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR, get_core_node_root, get_local_data_dir
from pycore.pyctl.ai.ai_text_log import log_ai_call

RUNTIME = "pycore"

# Cross-runtime shared store (see module docstring + ai_rate_limits rationale).
# Lives under <cache>/pycore/.ai_state; the prior <core_node>/.ai_state
# location is migrated once on first access.
_SHARED_STATE_DIR = get_local_data_dir() / ".ai_state"
_OLD_SHARED_DIR = get_core_node_root() / ".ai_state"
_LEGACY_DIR = APP_DATA_DIR / "ai_state"

# Newest-last ring buffer cap.
_MAX_ENTRIES = 400
# Every AI/capability call kind the unified usage log accepts. text/vision/probe
# flow through the AI gateway; image/tts/stt are folded in so the global usage
# history + per-provider rollup reflect EVERY AI call, not just chat/vision.
_KINDS = ("text", "vision", "probe", "image", "tts", "stt")

_lock = threading.Lock()


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
                if isinstance(data["entries"], list) and isinstance(data["stats"], dict):
                    return data
    except Exception as e:  # noqa: BLE001 — a corrupt log must never crash callers
        ColorPrint.yellow(f"[ai_usage_log] log unreadable ({e}); starting fresh")
    return {"version": 1, "saved_at": 0.0, "entries": [], "stats": {}}


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
    with _lock:
        doc = _load()
        entries = doc.get("entries") or []
        entries.append(entry)
        if len(entries) > _MAX_ENTRIES:
            entries = entries[len(entries) - _MAX_ENTRIES:]
        doc["entries"] = entries
        stats = doc.get("stats") or {}
        prov = stats.setdefault(provider, {})
        bucket = prov.setdefault(kind, {"calls": 0, "ok": 0, "failed": 0})
        bucket["calls"] += 1
        bucket["ok" if success else "failed"] += 1
        prov["last_ts"] = ts
        prov["last_model"] = entry["model"]
        doc["stats"] = stats
        _save(doc)
    # Mirror to the shared flat operator log AND print one CLI line (the
    # per-call visibility that was missing). Outside the lock — the file write
    # and console print must never hold the usage-log lock.
    log_ai_call(
        kind, provider, model=entry["model"], source=source,
        success=bool(success), latency_ms=latency_ms, error=error,
        runtime=runtime or RUNTIME,
    )


def usage_log(limit: int = 100, kind: Optional[str] = None) -> Dict[str, Any]:
    """Newest-first records (+ per-provider/kind rollup) for the UI.

    ``kind`` optionally filters the returned records (stats are always the full
    rollup). The Laravel ``/api/local/ai/usage`` endpoint returns the same shape.
    """
    try:
        limit = max(1, min(_MAX_ENTRIES, int(limit)))
    except (TypeError, ValueError):
        limit = 100
    kind = (kind or "").strip().lower() or None
    with _lock:
        doc = _load()
        entries = list(doc.get("entries") or [])
        stats = dict(doc.get("stats") or {})
    records = list(reversed(entries))
    if kind:
        records = [r for r in records if r.get("kind") == kind]
    return {
        "success": True,
        "storage_path": str(_usage_file()),
        "stats": stats,
        "entries": records[:limit],
    }


def clear_usage() -> int:
    """Delete ALL usage records + stats. Returns the count removed."""
    with _lock:
        doc = _load()
        n = len(doc.get("entries") or [])
        doc["entries"] = []
        doc["stats"] = {}
        _save(doc)
    return n


__all__ = ["record_usage", "usage_log", "clear_usage", "RUNTIME"]
