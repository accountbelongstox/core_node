# -*- coding: utf-8 -*-
"""
Universal model-load progress registry — the ONE status contract every speech
engine reports to, surfaced to the UI for BOTH class-B in-process models and
class-C HTTP servers, TTS and STT alike.

Why: loading a neural model (server startup or in-process weight load) can take
tens of seconds; without a signal the UI just looks frozen. This registry is the
single place that tracks, per engine, whether it is idle / loading / loaded /
error, with a bounded tail of the most recent log lines for diagnosis.

Who writes:
  - class-C servers: pycore/pyutils/common/managed_service.py (`_start_server`)
    reports `loading` at launch and `loaded`/`error` from the health outcome,
    tailing the per-service log file (get_app_logs_dir()/services/<cat>_<name>.log).
  - class-B models: the orchestrators (tts_orchestrator / stt_orchestrator) wrap
    the FIRST synth/transcribe of a not-yet-resident model with `report_model_load`
    — one place, not per-engine. class-A (edge/azure/gtts/streamelements) never
    load a model, so they are never reported here.

Who reads: GET /api/local/engines/load-status (engines_load_status_router). Each
state change is also best-effort published through the RPC v2 HTTP event journal via
THREAD_BUS ('engine_load_status_update'); a listener is registered in
callmodule/rpc_routes/thread_bus_routes.py. The polled endpoint is authoritative;
the broadcast is an optimization.

Thread-safety mirrors managed_service: one module-level lock guards a simple dict.
No heavy machinery. See TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md 'Model-load progress'.
"""

import time
from collections import deque
from contextlib import contextmanager
from typing import Any, Callable, Deque, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

# Broadcast is best-effort: on a standalone/headless run THREAD_BUS may have no
# listener, and that is fine (the polled endpoint still works).
try:
    _THREAD_BUS_AVAILABLE = True
except Exception:  # noqa: BLE001
    THREAD_BUS = None  # type: ignore[assignment]
    _THREAD_BUS_AVAILABLE = False

_LOG_TAIL_MAX = 40
_VALID_STATES = ("idle", "loading", "loaded", "error")

# name -> mutable status dict (state/message/device/started_at/updated_at/log_tail deque)
_registry: Dict[str, Dict[str, Any]] = {}
_STATUS_QUEUE = 'pyutils.common.model_load_status'
_STATUS_WORKER = SerializedWorkerThread(_STATUS_QUEUE, 'ModelLoadStatusThread')
_STATUS_WORKER.start()


def _entry(name: str) -> Dict[str, Any]:
    """Return the mutable registry entry for `name`, creating an idle one lazily.
    Called only by the status-owner thread."""
    entry = _registry.get(name)
    if entry is None:
        entry = {
            "state": "idle",
            "message": "",
            "device": "",
            "started_at": None,
            "updated_at": time.time(),
            "log_tail": deque(maxlen=_LOG_TAIL_MAX),
        }
        _registry[name] = entry
    return entry


def _public(name: str, entry: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize one entry for the API/broadcast (deque -> list, add elapsed_ms).
    Called only by the status-owner thread."""
    started = entry.get("started_at")
    updated = entry.get("updated_at") or time.time()
    if started is not None:
        # While loading, elapse to NOW; once terminal, freeze at the last update.
        end = updated if entry.get("state") in ("loaded", "error") else time.time()
        elapsed_ms = max(0, int((end - started) * 1000))
    else:
        elapsed_ms = 0
    return {
        "name": name,
        "state": entry.get("state", "idle"),
        "message": entry.get("message", ""),
        "device": entry.get("device", ""),
        "started_at": started,
        "updated_at": updated,
        "elapsed_ms": elapsed_ms,
        "log_tail": list(entry.get("log_tail") or ()),
    }


def _broadcast(name: str) -> None:
    """Best-effort live push of one engine's status over the rpc_v2 bus. Never
    raises (no listener / no server -> silently no-op)."""
    if not _THREAD_BUS_AVAILABLE:
        return
    try:
        payload = _public(name, _entry(name))
        THREAD_BUS.trigger_event(BusSignals.ENGINE_LOAD_STATUS_UPDATE, payload, async_mode=True)
    except Exception:  # noqa: BLE001 — status must never break the caller
        pass


def _set_loading(name: str, message: str = "", device: str = "") -> None:
    """Mark `name` as loading (resets the started_at / elapsed clock)."""
    entry = _entry(name)
    entry["state"] = "loading"
    entry["message"] = message or "loading"
    if device:
        entry["device"] = device
    entry["started_at"] = time.time()
    entry["updated_at"] = time.time()
    _broadcast(name)


def _set_loaded(name: str, message: str = "", device: str = "") -> None:
    """Mark `name` as loaded/ready (freezes elapsed at this moment)."""
    entry = _entry(name)
    entry["state"] = "loaded"
    entry["message"] = message or "ready"
    if device:
        entry["device"] = device
    entry["updated_at"] = time.time()
    _broadcast(name)


def _set_error(name: str, message: str) -> None:
    """Mark `name` as failed to load (keeps any accumulated log_tail)."""
    entry = _entry(name)
    entry["state"] = "error"
    entry["message"] = message or "error"
    entry["updated_at"] = time.time()
    _broadcast(name)


def _append_log(name: str, line: str) -> None:
    """Append one diagnostic line to `name`'s bounded log tail (no broadcast — the
    next state change carries the updated tail)."""
    text = (line or "").rstrip("\n")
    if not text:
        return
    _entry(name)["log_tail"].append(text)


def _set_log_tail(name: str, lines: Any) -> None:
    """Replace `name`'s log tail with `lines` (last _LOG_TAIL_MAX kept)."""
    tail: Deque[str] = _entry(name)["log_tail"]
    tail.clear()
    for line in lines or ():
        text = str(line).rstrip("\n")
        if text:
            tail.append(text)


def _reset(name: str) -> None:
    """Return `name` to idle (e.g. after an unload)."""
    entry = _entry(name)
    entry["state"] = "idle"
    entry["message"] = ""
    entry["started_at"] = None
    entry["updated_at"] = time.time()
    _broadcast(name)


def _get(name: str) -> Optional[Dict[str, Any]]:
    """Snapshot of ONE engine's status, or None when never reported."""
    entry = _registry.get(name)
    if entry is None:
        return None
    return _public(name, entry)


def _snapshot() -> Dict[str, Dict[str, Any]]:
    """Snapshot of ALL reported engines: name -> status dict."""
    return {name: _public(name, entry) for name, entry in _registry.items()}


def set_loading(name: str, message: str = "", device: str = "") -> None:
    """Mark an engine loading through the status-owner thread."""
    call_serialized(_STATUS_QUEUE, _set_loading, name, message, device)


def set_loaded(name: str, message: str = "", device: str = "") -> None:
    """Mark an engine loaded through the status-owner thread."""
    call_serialized(_STATUS_QUEUE, _set_loaded, name, message, device)


def set_error(name: str, message: str) -> None:
    """Mark an engine failed through the status-owner thread."""
    call_serialized(_STATUS_QUEUE, _set_error, name, message)


def append_log(name: str, line: str) -> None:
    """Append a log line through the status-owner thread."""
    call_serialized(_STATUS_QUEUE, _append_log, name, line)


def set_log_tail(name: str, lines: Any) -> None:
    """Replace a log tail through the status-owner thread."""
    call_serialized(_STATUS_QUEUE, _set_log_tail, name, lines)


def reset(name: str) -> None:
    """Reset an engine through the status-owner thread."""
    call_serialized(_STATUS_QUEUE, _reset, name)


def get(name: str) -> Optional[Dict[str, Any]]:
    """Read one engine snapshot through the status-owner thread."""
    return call_serialized(_STATUS_QUEUE, _get, name)


def snapshot() -> Dict[str, Dict[str, Any]]:
    """Read all engine snapshots through the status-owner thread."""
    return call_serialized(_STATUS_QUEUE, _snapshot)


@contextmanager
def report_model_load(
    name: str,
    is_loaded: Callable[[], bool],
    device: str = "",
):
    """Wrap the FIRST call of a class-B in-process model so its weight-load
    progress surfaces once. No-op when the model is already resident (so warm
    calls never churn the registry).

    Usage (orchestrator, inside `managed_services.using(name)`):
        with report_model_load(name, is_loaded=lambda: managed_services.is_running(name)):
            ok = synth(...)

    `is_loaded()` reports whether the model is resident; it is probed before (to
    skip warm calls) and after (to confirm the load). An exception from the wrapped
    call is recorded as an error and re-raised; a call that returns without the
    model resident is recorded as an error too. Never raises from the status path
    itself."""
    already = False
    try:
        already = bool(is_loaded())
    except Exception:  # noqa: BLE001
        already = False
    if already:
        # Already warm — nothing to report; keep the registry quiet.
        yield
        return
    set_loading(name, "loading model", device)
    try:
        yield
    except Exception as exc:  # noqa: BLE001 — record then re-raise for the caller
        set_error(name, f"{name}: {exc}")
        raise
    resident = False
    try:
        resident = bool(is_loaded())
    except Exception:  # noqa: BLE001
        resident = False
    if resident:
        set_loaded(name, "model loaded", device)
    else:
        set_error(name, f"{name}: model did not load")
        ColorPrint.gray(f"[model-load] {name} call finished but model not resident")


__all__ = [
    "BROADCAST_EVENT",
    "set_loading",
    "set_loaded",
    "set_error",
    "append_log",
    "set_log_tail",
    "reset",
    "get",
    "snapshot",
    "report_model_load",
]
