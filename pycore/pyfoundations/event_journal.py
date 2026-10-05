# -*- coding: utf-8 -*-
"""The process event journal: one writer thread owns a replayable record journal.

Every domain publishes here from any thread without waiting: a publish is one
THREAD_BUS message, and the writer thread sequences, stores and pushes each
burst to the subscribers (the WebSocket sessions of the RPC server). Taps (the
relay forwarder) observe each publish on the publisher's thread.

Console log entries are live-only: they are pushed to subscribers that want the
log topic, never stored in the replay ring, and not published at all while no
subscriber wants them (the console log history covers every gap).
"""

from __future__ import annotations

import traceback
import uuid
from typing import Any, Callable, Dict, Hashable, Iterable, List, Optional, Tuple

from pycore.pyfoundations.batch_owner_thread import BatchOwnerThread
from pycore.pyfoundations.event_records import (
    BROADCAST_AUDIENCE,
    Deliver,
    EventRecordJournal,
    PublishSpec,
    derive_client_id,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals

EventTap = Callable[[str, Dict[str, Any], str, Optional[str]], None]

EVENT_JOURNAL_QUEUE = "pyfoundations.event_journal.writer"
EVENT_JOURNAL_THREAD = "EventJournalWriterThread"
EVENT_JOURNAL_BATCH_MAX = 256
EVENT_JOURNAL_LIVE_ONLY_TOPICS = frozenset({BusSignals.PYCORE_LOG})

_PUBLISH = "publish"
_SUBSCRIBE = "subscribe"
_RETOPIC = "retopic"
_UNSUBSCRIBE = "unsubscribe"
_ACKNOWLEDGE = "acknowledge"
_TAP_ADD = "tap_add"
_TAP_REMOVE = "tap_remove"


class EventJournal:
    """Thread-safe facade; the journal state is touched only by the writer thread."""

    def __init__(self) -> None:
        self._records = EventRecordJournal()
        self._taps: Tuple[EventTap, ...] = ()
        self._guarded: Dict[Hashable, Deliver] = {}
        self.log_wanted = False
        self._queue_name = f"{EVENT_JOURNAL_QUEUE}.{uuid.uuid4().hex}"
        self._writer = BatchOwnerThread(
            self._queue_name,
            EVENT_JOURNAL_THREAD,
            self._apply,
            self._report_writer_failure,
            EVENT_JOURNAL_BATCH_MAX,
        )
        self._writer.start()

    @property
    def instance_id(self) -> str:
        return self._records.instance_id

    @property
    def seq(self) -> int:
        return self._records.seq

    def allocate_client_id(self, allocation_key: str) -> str:
        return derive_client_id(self.instance_id, allocation_key)

    def subscribe(
        self,
        key: Hashable,
        deliver: Deliver,
        client_id: str,
        since_seq: int,
        topics: Optional[Iterable[str]],
    ) -> None:
        """Start pushing matching records to ``deliver`` (called on the writer
        thread, so it must hand off and never block): first the backlog after
        ``since_seq``, then every later match."""
        self._writer.post((_SUBSCRIBE, key, deliver, client_id, since_seq, EventRecordJournal.topic_filter(topics)))

    def retopic(self, key: Hashable, topics: Optional[Iterable[str]]) -> None:
        self._writer.post((_RETOPIC, key, EventRecordJournal.topic_filter(topics)))

    def unsubscribe(self, key: Hashable) -> None:
        self._writer.post((_UNSUBSCRIBE, key))

    def acknowledge(self, client_id: str, seq: int) -> None:
        self._writer.post((_ACKNOWLEDGE, client_id, int(seq)))

    def add_tap(self, tap: EventTap) -> None:
        self._control(_TAP_ADD, tap)

    def remove_tap(self, tap: EventTap) -> None:
        self._control(_TAP_REMOVE, tap)

    def taps(self) -> Tuple[EventTap, ...]:
        return self._taps

    def publish_topic(
        self,
        topic: str,
        payload: Optional[Dict[str, Any]],
        audience: str = BROADCAST_AUDIENCE,
        **metadata: Any,
    ) -> None:
        """Publish one domain event; taps observe it on this thread first."""
        event_id_value = metadata.pop("event_id", None)
        event_id = str(event_id_value) if event_id_value else None
        normalized_topic = str(topic or "")
        normalized_audience = str(audience or BROADCAST_AUDIENCE)
        event_payload = dict(payload or {})
        for tap in self._taps:
            try:
                tap(normalized_topic, event_payload, normalized_audience, event_id)
            except Exception as exc:  # noqa: BLE001 - a tap failure must not block publishing
                # A failing tap on console-log entries must not log again (feedback loop).
                if normalized_topic != BusSignals.PYCORE_LOG:
                    ColorPrint.red(f"[EventJournal] tap {getattr(tap, '__qualname__', tap)} failed topic={normalized_topic}: {exc}")
        live_only = normalized_topic in EVENT_JOURNAL_LIVE_ONLY_TOPICS
        if live_only and not self.log_wanted:
            return
        spec: PublishSpec = (normalized_topic, event_payload, event_id, normalized_audience, metadata, not live_only)
        self._writer.post((_PUBLISH, spec))

    def publish_log(self, entry: Dict[str, Any]) -> None:
        """Console log journal sink: one sequenced entry per pycore_log event."""
        self.publish_topic(
            BusSignals.PYCORE_LOG,
            entry,
            event_id=f"{entry.get('instance_id')}:{entry.get('seq')}",
        )

    def _control(self, kind: str, *arguments: Any) -> None:
        """Run one control step on the writer thread and wait for it."""
        done = f"{self._queue_name}.control.{uuid.uuid4().hex}"
        self._writer.post((kind, *arguments, done))
        THREAD_BUS.wait_signal(done)
        THREAD_BUS.clear_signal(done)

    def _apply(self, batch: List[Any]) -> None:
        pending: List[PublishSpec] = []
        for message in batch:
            if message[0] == _PUBLISH:
                pending.append(message[1])
                continue
            self._publish(pending)
            pending = []
            self._handle(message)
        self._publish(pending)

    def _publish(self, specs: List[PublishSpec]) -> None:
        if specs:
            self._records.publish_batch(specs)

    def _handle(self, message: Tuple[Any, ...]) -> None:
        kind = message[0]
        if kind == _SUBSCRIBE:
            _kind, key, deliver, client_id, since_seq, topics = message
            guarded = self._guard(key, deliver)
            self._guarded[key] = guarded
            guarded(self._records.subscribe(key, guarded, client_id, since_seq, topics))
        elif kind == _RETOPIC:
            _kind, key, topics = message
            frame = self._records.retopic(key, topics)
            if frame is not None:
                self._guarded[key](frame)
        elif kind == _UNSUBSCRIBE:
            self._records.unsubscribe(message[1])
            self._guarded.pop(message[1], None)
        elif kind == _ACKNOWLEDGE:
            self._records.acknowledge(message[1], message[2])
        elif kind == _TAP_ADD:
            if message[1] not in self._taps:
                self._taps = self._taps + (message[1],)
            THREAD_BUS.signal(message[2], True)
        elif kind == _TAP_REMOVE:
            self._taps = tuple(tap for tap in self._taps if tap != message[1])
            THREAD_BUS.signal(message[2], True)
        self.log_wanted = any(self._records.wants(topic) for topic in EVENT_JOURNAL_LIVE_ONLY_TOPICS)

    def _guard(self, key: Hashable, deliver: Deliver) -> Deliver:
        def guarded(frame: Dict[str, Any]) -> None:
            try:
                deliver(frame)
            except RuntimeError as exc:
                self._records.unsubscribe(key)
                self._guarded.pop(key, None)
                ColorPrint.yellow(f"[EventJournal] subscriber dropped: {exc}")

        return guarded

    @staticmethod
    def _report_writer_failure(exc: BaseException) -> None:
        trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)).rstrip()
        ColorPrint.red(f"[EventJournal] writer batch failed: {exc!r}\n{trace}")


event_journal = EventJournal()


__all__ = ["EventJournal", "EventTap", "event_journal"]
