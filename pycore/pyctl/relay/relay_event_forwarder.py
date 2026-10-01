# -*- coding: utf-8 -*-
"""Tunnel pycore's local event bus to paired UI owners through Relay device events.

Direct mode reads the pycore SSE journal; Relay mode has no such stream, so
every public domain event (logs, queue/lane/engine changes, ...) is batched
here into one ``pycore.events`` device event. The UI replays each entry on the
same topic bus, which replaces polling through Relay operations. Console log
entries carry their journal sequence, so the UI fills any gap left by a
dropped batch through the relay-exposed console log history route.
"""

from __future__ import annotations

import json
import threading
import time
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.common.terminal_events import TERMINAL_CHANGED_EVENT
from pycore.pyutils.rpc.delivery import http_event_delivery_service


RELAY_EVENTS_QUEUE = "relay.events.forward"
RELAY_EVENTS_THREAD = "RelayEventForwardThread"
RELAY_EVENTS_NAME = "pycore_events"
RELAY_EVENTS_FLUSH_SECONDS = 2.0
RELAY_EVENTS_BACKOFF_MAX_SECONDS = 60.0
RELAY_EVENTS_BATCH_MAX = 200
RELAY_EVENTS_QUEUE_MAX = 2000
RELAY_EVENTS_PAYLOAD_MAX_BYTES = 48000
RELAY_EVENTS_ENTRY_MAX_BYTES = 16000
RELAY_EVENTS_BROADCAST_AUDIENCE = "*"
RELAY_EVENTS_DEDICATED_TOPICS = frozenset((
    TERMINAL_CHANGED_EVENT,
    BusSignals.AGENT_HISTORY_PROMPT_NEW,
    BusSignals.AGENT_HISTORY_PROMPT_DERIVED,
    BusSignals.AGENT_HISTORY_CONFIG_CHANGED,
))
RELAY_EVENTS_EXCLUDED_TOPICS = RELAY_EVENTS_DEDICATED_TOPICS | frozenset((
    BusSignals.LARAVEL_HTTP,
))
RELAY_EVENTS_LATEST_WINS_TOPICS = frozenset((
    BusSignals.QUEUE_BUMP,
    BusSignals.SYSTEM_SETTINGS_UPDATE,
    BusSignals.ENGINE_LOAD_STATUS_UPDATE,
    BusSignals.AUDIO_ORCH_TASKS_CHANGED,
    BusSignals.QWEN_QUEUE_CHANGED,
    BusSignals.AGENT_HISTORY_SESSIONS_CHANGED,
    BusSignals.AGENT_HISTORY_VIDEO_CHANGED,
))


class RelayEventForwarder:
    """Batch broadcast events and post them as one Relay device event.

    Events raised by the flusher thread itself are dropped, so posting a batch
    can never feed the next batch. Latest-wins topics keep only the newest
    payload per batch; every other topic keeps all of its entries in order.
    """

    def __init__(
        self,
        post: Callable[[str, Dict[str, Any], int], bool],
        should_stop: Callable[[], bool],
        wait: Callable[[float], None],
    ) -> None:
        self._post = post
        self._should_stop = should_stop
        self._wait = wait
        self._flusher_ident = 0
        self._thread: Optional[Any] = None
        self._tapped = False
        self._dropped = 0

    def start(self) -> None:
        if not self._tapped:
            http_event_delivery_service.add_tap(self._on_event)
            self._tapped = True
        if self._thread is None or not self._thread.is_alive():
            self._thread = start_bus_task(self._run, thread_name=RELAY_EVENTS_THREAD)

    def stop(self) -> None:
        if self._tapped:
            http_event_delivery_service.remove_tap(self._on_event)
            self._tapped = False
        THREAD_BUS.clear_queue(RELAY_EVENTS_QUEUE)

    def _on_event(
        self,
        topic: str,
        payload: Dict[str, Any],
        audience: str,
        event_id: Optional[str],
    ) -> None:
        if audience != RELAY_EVENTS_BROADCAST_AUDIENCE or topic in RELAY_EVENTS_EXCLUDED_TOPICS:
            return
        if threading.get_ident() == self._flusher_ident:
            return
        # Console log entries are sequenced on the journal thread; their
        # producer thread name marks the flusher's own lines (feedback loop).
        if topic == BusSignals.PYCORE_LOG and payload.get("thread") == RELAY_EVENTS_THREAD:
            return
        if THREAD_BUS.queue_size(RELAY_EVENTS_QUEUE) >= RELAY_EVENTS_QUEUE_MAX:
            self._dropped += 1
            return
        THREAD_BUS.send_message(RELAY_EVENTS_QUEUE, {
            "topic": topic,
            "payload": payload,
            "event_id": event_id or "",
            "ts": int(time.time() * 1000),
        })

    def _drain(self) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        latest: Dict[str, int] = {}
        size = 0
        for _ in range(RELAY_EVENTS_BATCH_MAX):
            entry = THREAD_BUS.receive_message(RELAY_EVENTS_QUEUE)
            if entry is None:
                break
            entry_size = len(json.dumps(entry, ensure_ascii=False, default=str).encode("utf-8"))
            if entry_size > RELAY_EVENTS_ENTRY_MAX_BYTES or size + entry_size > RELAY_EVENTS_PAYLOAD_MAX_BYTES:
                self._dropped += 1
                continue
            topic = entry["topic"]
            if topic in RELAY_EVENTS_LATEST_WINS_TOPICS and topic in latest:
                entries[latest[topic]] = entry
                continue
            if topic in RELAY_EVENTS_LATEST_WINS_TOPICS:
                latest[topic] = len(entries)
            entries.append(entry)
            size += entry_size
        return entries

    def _run(self) -> None:
        self._flusher_ident = threading.get_ident()
        delay = RELAY_EVENTS_FLUSH_SECONDS
        while not self._should_stop():
            self._wait(delay)
            entries = self._drain()
            if not entries:
                continue
            body: Dict[str, Any] = {"events": entries, "dropped": self._dropped}
            self._dropped = 0
            if self._post(RELAY_EVENTS_NAME, body, 0):
                delay = RELAY_EVENTS_FLUSH_SECONDS
            else:
                self._dropped += len(entries)
                delay = min(RELAY_EVENTS_BACKOFF_MAX_SECONDS, delay * 2)


__all__ = ["RELAY_EVENTS_NAME", "RelayEventForwarder"]
