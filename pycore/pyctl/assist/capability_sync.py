# -*- coding: utf-8 -*-
"""
Sync persisted Queue Center capabilities to Pycore's live pull workers.

The UI owns switches and endpoint selection; registered heartbeat callbacks
own Laravel pull/accept/result processing independently of the UI lifecycle.
This module is the ONE settings -> runtime transition point: it reconciles
every heartbeat callback with the persisted capabilities and drives the lane
lifecycle (request_start / request_stop) through the canonical lane registry.
"""

from typing import Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.assist_settings import assist_callback_states
from pycore.pyctl.queue_center.lane_registry import (
    LANE_BY_CALLBACK,
    lane_worker,
)
from pycore.pyutils.tts.audio_queue_model import (
    AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS,
    AUDIO_QUEUE_LANES,
)
from pycore.pyutils.tts.audio_queue_center import audio_queue_center


def _start_audio_lane_after_restore(control: str, worker: Any) -> None:
    """Off the settings-sync thread: hold this lane's first remote pull
    until its cache-first restore finishes (R6/section 5.4 - the local cache loads
    in full before any remote access), then start it. BusTaskThread isolates
    a failure here from the caller."""
    restored = audio_queue_center.wait_for_restore(control, timeout=AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS)
    if not restored:
        ColorPrint.yellow(
            f"[AssistSync] {control} cache-first restore did not signal within "
            f"{AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS:.0f}s; starting the lane anyway"
        )
    worker.request_start()


def _apply_lane_lifecycle(callback_name: str, want: bool, graceful_stop: bool) -> None:
    """Drive one registry lane's explicit start/stop lifecycle.

    request_start() wakes one immediate remote-first pull so an enable action
    processes the first bounded batch without waiting for the poll interval.
    An audio lane (word_audio / sentence_audio) defers that start to a
    background task that waits for the lane's own cache-first restore first,
    so this settings-sync call never blocks on a snapshot load and the
    remote pull never races it (R6/section 5.4). request_stop() closes the
    pull/accept gates and halts background drains; ``graceful_stop`` selects
    finish-the-claimed-heap vs immediate stop with active release of
    unstarted claims. Both are idempotent and coalesced, so reconciling an
    already-consistent lane is a no-op.
    """
    control = LANE_BY_CALLBACK.get(callback_name)
    if control is None:
        return
    worker = lane_worker(control)
    if worker is None:
        return
    if want and control in AUDIO_QUEUE_LANES:
        start_bus_task(
            _start_audio_lane_after_restore, control, worker,
            thread_name=f"AudioLaneRestoreGate.{control}",
        )
        return
    if want:
        worker.request_start()
    else:
        worker.request_stop(graceful=graceful_stop)


def _toggle_callback(name: str, want: bool) -> None:
    """Enable/disable a heartbeat callback.

    An unregistered callback is not a failure while startup registration is
    still in progress; the persisted setting will be applied after registration.
    """
    heartbeat = shared_heartbeat_system
    ok = (
        heartbeat.enable_callback(name)
        if want
        else heartbeat.disable_callback(name)
    )
    if not ok:
        if want:
            ColorPrint.blue(f"[AssistSync] {name} not registered - deferred")
        return
    ColorPrint.blue(f"[AssistSync] {name} {'enabled' if want else 'disabled'}")


def apply_assist_runtime(
    config: Dict[str, Any],
    graceful_stop: bool = True,
) -> Dict[str, Any]:
    """Apply assist config to all related heartbeat callbacks and lane workers.

    ``graceful_stop`` only matters for lanes being disabled: True finishes the
    already-claimed heap, False halts immediately and releases the unstarted
    claims back to Laravel's pending queue.

    Returns ``{"ok": bool, "errors": [...]}``.
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
        _toggle_callback(name, want)
        _apply_lane_lifecycle(name, want, graceful_stop)

    ColorPrint.blue(
        f"[AssistSync] runtime applied master={enabled} "
        f"translation={want_translation} word_audio={want_word_audio} "
        f"sentence_audio={want_sentence_audio} stt={want_stt}"
    )
    return {"ok": not errors, "errors": errors}
