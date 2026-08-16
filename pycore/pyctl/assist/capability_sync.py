# -*- coding: utf-8 -*-
"""
Sync persisted Queue Center capabilities to Pycore's live pull workers.

The UI owns switches and endpoint selection; registered heartbeat callbacks
own Laravel pull/accept/result processing independently of the UI lifecycle.
This module is the ONE settings -> runtime transition point: it reconciles
every heartbeat callback with the persisted capabilities and drives the lane
lifecycle (request_start / request_stop) through the canonical lane registry.
"""

from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.assist_settings import assist_callback_states
from pycore.pyctl.queue_center.lane_registry import (
    LANE_BY_CALLBACK,
    lane_worker,
)


def _apply_lane_lifecycle(callback_name: str, want: bool, graceful_stop: bool) -> None:
    """Drive one registry lane's explicit start/stop lifecycle.

    request_start() wakes one immediate remote-first pull so an enable action
    processes the first bounded batch without waiting for the poll interval.
    request_stop() closes the pull/accept gates and halts background drains;
    ``graceful_stop`` selects finish-the-claimed-heap vs immediate stop with
    active release of unstarted claims. Both are idempotent and coalesced, so
    reconciling an already-consistent lane is a no-op.
    """
    control = LANE_BY_CALLBACK.get(callback_name)
    if control is None:
        return
    worker = lane_worker(control)
    if worker is None:
        return
    try:
        if want:
            worker.request_start()
        else:
            worker.request_stop(graceful=graceful_stop)
    except Exception as exc:  # noqa: BLE001 - lifecycle must not break settings sync
        ColorPrint.yellow(f"[AssistSync] {callback_name} lifecycle failed ({exc})")


def _toggle_callback(name: str, want: bool) -> Tuple[bool, Optional[str]]:
    """Enable/disable a heartbeat callback. Returns (ok, error_or_None).

    An unregistered callback is not a failure while startup registration is
    still in progress; the persisted setting will be applied after registration.
    """
    heartbeat = shared_heartbeat_system
    try:
        ok = (
            heartbeat.enable_callback(name)
            if want
            else heartbeat.disable_callback(name)
        )
        if not ok:
            if not want:
                return True, None
            ColorPrint.blue(f"[AssistSync] {name} not registered - deferred")
            return True, None
        ColorPrint.blue(f"[AssistSync] {name} {'enabled' if want else 'disabled'}")
        return True, None
    except Exception as exc:  # noqa: BLE001
        error = f"{name} toggle failed ({exc})"
        ColorPrint.yellow(f"[AssistSync] {error}")
        return False, error


def apply_assist_runtime(
    config: Dict[str, Any],
    graceful_stop: bool = True,
) -> Dict[str, Any]:
    """Apply assist config to all related heartbeat callbacks and lane workers.

    ``graceful_stop`` only matters for lanes being disabled: True finishes the
    already-claimed heap, False halts immediately and releases the unstarted
    claims back to Laravel's pending queue.

    Returns ``{"ok": bool, "errors": [...]}`` so callers can surface heartbeat
    registration failures instead of treating a yellow log as success.
    """
    enabled = bool(config.get("enabled"))
    caps = config.get("capabilities") if isinstance(config.get("capabilities"), dict) else {}
    states = assist_callback_states(config)
    want_word_audio = states.get("tts_queue_poller", False)
    want_sentence_audio = states.get("tts_sentence_worker", False)
    want_translation = enabled and bool(caps.get("translation", True))
    want_stt = enabled and bool(caps.get("stt", False))

    errors: List[str] = []
    for name, want in states.items():
        ok, error = _toggle_callback(name, want)
        if not ok and error:
            errors.append(error)
        _apply_lane_lifecycle(name, want, graceful_stop)

    ColorPrint.blue(
        f"[AssistSync] runtime applied master={enabled} "
        f"translation={want_translation} word_audio={want_word_audio} "
        f"sentence_audio={want_sentence_audio} stt={want_stt}"
    )
    return {"ok": not errors, "errors": errors}
