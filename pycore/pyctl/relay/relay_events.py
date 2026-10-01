# -*- coding: utf-8 -*-
"""Tunnel pycore's local events to paired UI owners through relay device events.

Dedicated bus events (terminal, agent history) are posted one by one. Every
other public journal event (logs, queue/lane/engine changes, ...) is batched
into one ``pycore.events`` device event that the UI replays on its own topic
bus. Console log entries carry their journal sequence, so the UI fills any gap
left by a dropped batch through the relay-exposed console log history route.
"""

from __future__ import annotations

import json
import threading
from typing import Any, Dict, List, Tuple

from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.event_journal import event_journal
from pycore.pyfoundations.event_records import BROADCAST_AUDIENCE
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyfoundations.time_utils import utc_now_ms
from pycore.pyutils.common.http_client import HttpError
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.common.terminal_events import TERMINAL_CHANGED_EVENT
from pycore.pyutils.laravel.relay_transport import RelayHttpError, relay_transport
from pycore.pyctl.relay.relay_state import RELAY_STOP_SIGNAL


RELAY_EVENTS_QUEUE = "relay.events.forward"
RELAY_EVENTS_THREAD = "RelayEventForwardThread"
RELAY_EVENTS_STATE_QUEUE = "relay.events.state"
RELAY_EVENTS_STATE_THREAD = "RelayEventsStateThread"
RELAY_EVENTS_NAME = "pycore_events"
RELAY_EVENTS_FLUSH_SECONDS = 2.0
RELAY_EVENTS_BACKOFF_MAX_SECONDS = 60.0
RELAY_EVENTS_BATCH_MAX = 200
RELAY_EVENTS_QUEUE_MAX = 2000
RELAY_EVENTS_PAYLOAD_MAX_BYTES = 48000
RELAY_EVENTS_ENTRY_MAX_BYTES = 16000
RELAY_EVENTS_DEDICATED_TOPICS = frozenset((
    TERMINAL_CHANGED_EVENT,
    BusSignals.AGENT_HISTORY_PROMPT_NEW,
    BusSignals.AGENT_HISTORY_PROMPT_DERIVED,
    BusSignals.AGENT_HISTORY_CONFIG_CHANGED,
))
RELAY_EVENTS_EXCLUDED_TOPICS = RELAY_EVENTS_DEDICATED_TOPICS | frozenset((BusSignals.LARAVEL_HTTP,))
RELAY_EVENTS_LATEST_WINS_KEYS = {
    BusSignals.QUEUE_BUMP: "",
    BusSignals.SYSTEM_SETTINGS_UPDATE: "",
    BusSignals.ENGINE_LOAD_STATUS_UPDATE: "name",
    BusSignals.AUDIO_ORCH_TASKS_CHANGED: "task_id",
    BusSignals.QWEN_QUEUE_CHANGED: "",
    BusSignals.AGENT_HISTORY_SESSIONS_CHANGED: "",
    BusSignals.AGENT_HISTORY_VIDEO_CHANGED: "",
}


class RelayEventForwardThread(threading.Thread):
    """Flush batched broadcast events as one relay device event.

    Events raised by the flusher thread itself are dropped, so posting a batch
    can never feed the next batch. Latest-wins topics keep only the newest
    payload per batch and per entity (task id or engine name where the topic has one); every other topic keeps all of its entries in order.
    """

    def __init__(self, owner: "RelayEvents") -> None:
        super().__init__(name=RELAY_EVENTS_THREAD, daemon=True)
        self._owner = owner

    def run(self) -> None:
        backoff = Backoff(RELAY_EVENTS_FLUSH_SECONDS, RELAY_EVENTS_BACKOFF_MAX_SECONDS)
        delay = RELAY_EVENTS_FLUSH_SECONDS
        while not self._owner.should_stop():
            THREAD_BUS.wait_signal(RELAY_STOP_SIGNAL, timeout=delay)
            entries = self._drain()
            if not entries and not self._owner.has_dropped():
                continue
            dropped, since = self._owner.take_dropped()
            body: Dict[str, Any] = {"events": entries, "dropped": dropped, "since": since}
            if self._owner.post(RELAY_EVENTS_NAME, body):
                backoff.reset()
                delay = RELAY_EVENTS_FLUSH_SECONDS
            else:
                self._owner.note_dropped(dropped + len(entries), since or utc_now_ms())
                backoff.next_delay()
                delay = backoff.current

    def _drain(self) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        latest: Dict[Tuple[str, str], int] = {}
        size = 0
        for _ in range(RELAY_EVENTS_BATCH_MAX):
            entry = THREAD_BUS.receive_message(RELAY_EVENTS_QUEUE)
            if entry is None:
                break
            entry_size = len(json.dumps(entry, ensure_ascii=False, default=str).encode("utf-8"))
            if entry_size > RELAY_EVENTS_ENTRY_MAX_BYTES or size + entry_size > RELAY_EVENTS_PAYLOAD_MAX_BYTES:
                self._owner.note_dropped(1)
                continue
            topic = entry["topic"]
            if topic in RELAY_EVENTS_LATEST_WINS_KEYS:
                entity_field = RELAY_EVENTS_LATEST_WINS_KEYS[topic]
                entity = entry["payload"].get(entity_field) if entity_field else None
                key = (topic, "" if entity is None else str(entity))
                if key in latest:
                    entries[latest[key]] = entry
                    continue
                latest[key] = len(entries)
            entries.append(entry)
            size += entry_size
        return entries


class RelayEvents:
    """Forward local bus and journal events to paired UI owners."""

    def __init__(self) -> None:
        init_serialized_owner(self, RELAY_EVENTS_STATE_QUEUE, RELAY_EVENTS_STATE_THREAD)
        self._last_revision = 0
        self._dropped = 0
        self._dropped_since = 0
        self._thread: Any = None
        self._handlers = {
            TERMINAL_CHANGED_EVENT: self._on_terminal_changed,
            BusSignals.AGENT_HISTORY_PROMPT_NEW: self._on_prompt_new,
            BusSignals.AGENT_HISTORY_PROMPT_DERIVED: self._on_prompt_derived,
            BusSignals.AGENT_HISTORY_CONFIG_CHANGED: self._on_config_changed,
        }

    @staticmethod
    def should_stop() -> bool:
        return THREAD_BUS.is_shutdown_requested() or bool(THREAD_BUS.get_signal(RELAY_STOP_SIGNAL, False))

    def start(self) -> None:
        for topic, handler in self._handlers.items():
            THREAD_BUS.register_event_handler(topic, handler)
        event_journal.add_tap(self._on_event)
        if self._thread is None or not self._thread.is_alive():
            self._thread = RelayEventForwardThread(self)
            self._thread.start()

    def stop(self) -> None:
        event_journal.remove_tap(self._on_event)
        for topic, handler in self._handlers.items():
            THREAD_BUS.unregister_event_handler(topic, handler)
        THREAD_BUS.clear_queue(RELAY_EVENTS_QUEUE)

    @serialized_method
    def note_dropped(self, count: int, since: int = 0) -> None:
        """Count dropped events; ``since`` is the earliest drop time (unix ms) of the open window."""
        if int(count) <= 0:
            return
        if self._dropped == 0 or (since and since < self._dropped_since):
            self._dropped_since = int(since) or utc_now_ms()
        self._dropped += int(count)

    @serialized_method
    def has_dropped(self) -> bool:
        return self._dropped > 0

    @serialized_method
    def take_dropped(self) -> Tuple[int, int]:
        dropped, since = self._dropped, self._dropped_since
        self._dropped = 0
        self._dropped_since = 0
        return dropped, since

    @serialized_method
    def _allocate_revision(self) -> int:
        """Wall-clock microseconds bumped past the last one issued: terminal counters
        restart at 0 and epoch seconds collide, so neither can order device events."""
        self._last_revision = max(utc_now_ms() * 1000, self._last_revision + 1)
        return self._last_revision

    def post(self, event_name: str, payload: Dict[str, Any]) -> bool:
        revision = self._allocate_revision()
        event_type = relay_contract.event(event_name)
        if not relay_device_identity.has_credential():
            relay_activity_log.warning("event.skipped", event_type=event_type, reason="credential_unavailable")
            return False
        try:
            relay_transport.request_json(
                "POST",
                relay_contract.endpoint("device_event"),
                {
                    "device_id": relay_device_identity.device_id(),
                    "event_type": event_type,
                    "revision": revision,
                    "payload": payload,
                },
                action="device.event.publish",
            )
        except (HttpError, RelayHttpError) as error:
            relay_activity_log.error(
                "event.publish.failed",
                event_type=event_type,
                revision=revision,
                error_type=type(error).__name__,
                error=error,
            )
            return False
        relay_activity_log.debug("event.publish.completed", event_type=event_type, revision=revision)
        return True

    def _on_terminal_changed(self, payload: Any) -> None:
        self.post("terminal_changed", dict(payload) if isinstance(payload, dict) else {})

    def _on_prompt_new(self, payload: Any) -> None:
        self.post("agent_history_prompt_new", dict(payload) if isinstance(payload, dict) else {})

    def _on_prompt_derived(self, payload: Any) -> None:
        self.post("agent_history_prompt_derived", dict(payload) if isinstance(payload, dict) else {})

    def _on_config_changed(self, payload: Any) -> None:
        self.post("agent_history_config_changed", dict(payload) if isinstance(payload, dict) else {})

    def _on_event(self, topic: str, payload: Dict[str, Any], audience: str, event_id: Any) -> None:
        if audience != BROADCAST_AUDIENCE or topic in RELAY_EVENTS_EXCLUDED_TOPICS:
            return
        if threading.current_thread().name == RELAY_EVENTS_THREAD:
            return
        # Console log entries are sequenced on the journal thread; their producer
        # thread name marks the flusher's own lines (feedback loop).
        if topic == BusSignals.PYCORE_LOG and payload.get("thread") == RELAY_EVENTS_THREAD:
            return
        if THREAD_BUS.queue_size(RELAY_EVENTS_QUEUE) >= RELAY_EVENTS_QUEUE_MAX:
            self.note_dropped(1)
            return
        THREAD_BUS.send_message(RELAY_EVENTS_QUEUE, {
            "topic": topic,
            "payload": payload,
            "event_id": event_id or "",
            "ts": utc_now_ms(),
        })


relay_events = RelayEvents()


__all__ = ["RELAY_EVENTS_NAME", "RelayEvents", "relay_events"]
