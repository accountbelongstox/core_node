#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared human-readable AI-call TEXT log — the pycore twin of Laravel's
``App\\Services\\AiGateway\\AiTextLog``. Both runtimes append EVERY AI /
capability call to ONE flat file beside the JSON ring buffers so an operator can
``tail -f`` what every AI call did (text / vision / probe / image / tts / stt),
regardless of which runtime produced it.

Path: ``<core_node>/.data/.ai_state/ai_calls.log`` — the same dir
``ai_usage_records.json`` / ``ai_image_history.json`` use (see ai_usage_log).

Line shape (MUST match AiTextLog.php so the shared file stays consistent):
  <iso>  <runtime>  <kind6>  <provider>/<model>  src=<source>  <ok|FAIL|->  <ms>ms  err=..  <extra>

Two effects, both previously missing on pycore:
  1. appends the flat operator line to the shared ai_calls.log, and
  2. emits ONE ColorPrint line per call so AI usage is visible on the pycore
     console (no per-call CLI print existed before — this is goal "print AI
     usage details to the CLI").

Best-effort + 5 MB size cap (keep the most recent ~half). It NEVER raises into
the AI-call path. Imports at file top (PYTHON_PYCORE.md §1.4); resolves the
shared state dir independently from system_paths to avoid an import cycle with
ai_usage_log (which calls this module).
"""

from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR, get_core_node_root

RUNTIME = "pycore"

# Shared cross-runtime state dir (mirrors ai_usage_log: .data/.ai_state under the
# core_node root, legacy app-data fallback when the repo root is not writable).
_SHARED_STATE_DIR = get_core_node_root() / ".data" / ".ai_state"
_LEGACY_DIR = APP_DATA_DIR / "ai_state"

_LOG_NAME = "ai_calls.log"
# 5 MB, then keep the most recent ~half (matches AiTextLog.php MAX_BYTES).
_MAX_BYTES = 5 * 1024 * 1024

_lock = threading.Lock()


def _state_dir():
    """Shared ``.data/.ai_state`` dir (legacy app-data fallback when unwritable)."""
    try:
        _SHARED_STATE_DIR.mkdir(parents=True, exist_ok=True)
        return _SHARED_STATE_DIR
    except OSError:
        _LEGACY_DIR.mkdir(parents=True, exist_ok=True)
        return _LEGACY_DIR


def log_path() -> str:
    """Absolute path of the shared flat AI-call log."""
    return str(_state_dir() / _LOG_NAME)


def _format_line(
    runtime: str,
    kind: str,
    provider: str,
    model: str,
    source: str,
    success: Optional[bool],
    latency_ms: Optional[float],
    error: Optional[str],
    extra: str,
) -> str:
    """Build one flat log line (matches AiTextLog.php part order/spacing)."""
    iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    status = "ok" if success is True else ("FAIL" if success is False else "-")
    parts = [
        iso,
        runtime or "?",
        (kind or "?").ljust(6),
        f"{provider or '?'}/{model or '-'}",
    ]
    if source:
        parts.append(f"src={source}")
    parts.append(status)
    if latency_ms is not None:
        parts.append(f"{int(latency_ms)}ms")
    if error:
        parts.append(f"err={str(error)[:200]}")
    if extra:
        parts.append(extra)
    return "  ".join(parts) + "\n"


def _print_console(
    kind: str,
    provider: str,
    model: str,
    source: str,
    success: Optional[bool],
    latency_ms: Optional[float],
    error: Optional[str],
) -> None:
    """One ColorPrint line per AI call — green ok / red FAIL / yellow unknown."""
    head = f"[AI] {(kind or '?').ljust(6)} {provider or '?'}/{model or '-'}"
    if source:
        head += f"  src={source}"
    if latency_ms is not None:
        head += f"  {int(latency_ms)}ms"
    if success is True:
        ColorPrint.green(f"{head}  ok")
    elif success is False:
        ColorPrint.red(f"{head}  FAIL{(' err=' + str(error)[:160]) if error else ''}")
    else:
        ColorPrint.yellow(f"{head}  -")


def _append(line: str) -> None:
    """Append one line to the flat log, self-trimming past the size cap."""
    path = _state_dir() / _LOG_NAME
    try:
        if path.is_file() and path.stat().st_size > _MAX_BYTES:
            data = path.read_bytes()
            path.write_bytes(data[len(data) // 2:])
        with path.open("a", encoding="utf-8") as fh:
            fh.write(line)
    except OSError as e:
        ColorPrint.yellow(f"[ai_text_log] write failed: {e}")


def log_ai_call(
    kind: str,
    provider: str,
    model: str = "",
    source: str = "",
    success: Optional[bool] = None,
    latency_ms: Optional[float] = None,
    error: Optional[str] = None,
    extra: str = "",
    runtime: str = RUNTIME,
) -> None:
    """Record ONE AI call: a ColorPrint console line + a flat-log append.

    Best-effort: any failure is swallowed (logging must never break the AI
    call). Called from the central record points (ai_usage_log.record_usage and
    ai_image_history.record) so every pycore AI call is captured without
    touching each call site."""
    kind = (kind or "").strip().lower()
    provider = (provider or "").strip()
    _print_console(kind, provider, model or "", source or "", success, latency_ms, error)
    with _lock:
        _append(_format_line(
            runtime or RUNTIME, kind, provider, model or "", source or "",
            success, latency_ms, error, extra or ""))


__all__ = ["log_ai_call", "log_path", "RUNTIME"]
