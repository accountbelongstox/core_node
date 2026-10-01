# -*- coding: utf-8 -*-
"""Qwen3TTS queue events delivered through bounded HTTP long polling."""

from __future__ import annotations

import uuid
from typing import Optional

from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import RunningFlag, start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.tts.qwen.client import (
    acknowledge_events,
    queue_events,
    queue_status,
)
from pycore.pyutils.tts.qwen.config import QUEUE_EVENT_NAME

_SEQ_SIGNAL = "tts.qwen3tts.events_listener.seq"
_INSTANCE_SIGNAL = "tts.qwen3tts.events_listener.instance_id"
_MIN_BACKOFF_S = 1.0
_MAX_BACKOFF_S = 30.0
_POLL_TIMEOUT_S = 20.0
_CLIENT_ID = f"pycore-qwen-events-{uuid.uuid4().hex}"
_LISTENER = RunningFlag("tts.qwen3tts.events_listener")


def start_qwen3tts_http_events() -> None:
    if _LISTENER.start():
        start_bus_task(_listener_loop, thread_name="Qwen3TtsHttpEventsThread")


def stop_qwen3tts_http_events() -> None:
    _LISTENER.stop()


def listener_running() -> bool:
    return _LISTENER.is_running()


def _listener_loop() -> None:
    backoff = Backoff(_MIN_BACKOFF_S, _MAX_BACKOFF_S)
    connected = False
    last_error = ""
    while _LISTENER.active():
        try:
            error = _poll_once()
        except Exception as exc:  # noqa: BLE001 - listener thread boundary; retry with backoff
            error = str(exc) or type(exc).__name__
        if error is None:
            connected = True
            last_error = ""
            backoff.reset()
            continue
        if connected and error != last_error:
            ColorPrint.yellow(f"[qwen3tts-events] HTTP poll failed: {error}")
        last_error = error
        _LISTENER.wait(backoff.next_delay())


def _poll_once() -> Optional[str]:
    """One long poll; the error text, or None after a delivered poll."""
    since_seq = int(THREAD_BUS.get_signal(_SEQ_SIGNAL, 0) or 0)
    known_instance = str(THREAD_BUS.get_signal(_INSTANCE_SIGNAL, "") or "")
    poll_timeout = _POLL_TIMEOUT_S if known_instance else 0.0
    response = queue_events(_CLIENT_ID, since_seq, poll_timeout)
    if not response.get("success"):
        return str(response.get("error") or "event poll rejected")
    instance_id = str(response.get("instance_id") or "")
    instance_changed = bool(known_instance and instance_id and known_instance != instance_id)
    if instance_id:
        THREAD_BUS.signal(_INSTANCE_SIGNAL, instance_id)
    if not known_instance or instance_changed or response.get("replay_lost"):
        reason = "listener_started"
        if instance_changed:
            reason = "instance_changed"
        elif response.get("replay_lost"):
            reason = "replay_lost"
        error = _publish_authoritative_snapshot(reason, instance_id)
        if error:
            return error
        current_seq = max(0, int(response.get("seq") or 0))
        THREAD_BUS.signal(_SEQ_SIGNAL, current_seq)
        if current_seq:
            acknowledge_events(_CLIENT_ID, current_seq)
        return None
    events = response.get("events") if isinstance(response.get("events"), list) else []
    highest_seq = since_seq
    for record in events:
        if not isinstance(record, dict):
            continue
        highest_seq = max(highest_seq, int(record.get("seq") or 0))
        event = record.get("payload") if isinstance(record.get("payload"), dict) else None
        if event is not None:
            THREAD_BUS.trigger_event(QUEUE_EVENT_NAME, dict(event), async_mode=True)
    if highest_seq > since_seq:
        THREAD_BUS.signal(_SEQ_SIGNAL, highest_seq)
        acknowledge_events(_CLIENT_ID, highest_seq)
    return None


def _publish_authoritative_snapshot(reason: str, transport_instance_id: str) -> Optional[str]:
    snapshot = queue_status()
    if not snapshot.get("ok"):
        return str(snapshot.get("error") or "qwen3tts queue snapshot failed")
    THREAD_BUS.trigger_event(QUEUE_EVENT_NAME, {
        "type": "snapshot",
        "event": "queue.snapshot",
        "seq": int(snapshot.get("seq") or 0),
        "instance_id": str(snapshot.get("instance_id") or "unknown"),
        "transport_instance_id": transport_instance_id,
        "job_id": "snapshot",
        "reason": reason,
        "queue": snapshot,
    }, async_mode=True)
    return None


__all__ = [
    "listener_running",
    "start_qwen3tts_http_events",
    "stop_qwen3tts_http_events",
]
