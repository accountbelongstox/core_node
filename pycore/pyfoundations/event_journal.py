# -*- coding: utf-8 -*-
"""The process event journal: one THREAD_BUS-owned replayable record journal.

Every domain publishes here from any thread; the RPC server's SSE and
WebSocket routes are views of it, and taps (the relay forwarder) observe each
publish on the publisher's thread.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, Optional

from pycore.pyfoundations.event_records import (
    BROADCAST_AUDIENCE,
    EventRecordJournal,
    EventTap,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus_constants import BusSignals


class EventJournal(EventRecordJournal):
    """EventRecordJournal whose state lives on one THREAD_BUS owner thread."""

    def __init__(self) -> None:
        super().__init__()
        init_serialized_owner(self, "pyfoundations.event_journal.state", "EventJournalStateThread")

    @property
    def seq(self) -> int:
        return self._current_seq()

    @serialized_method
    def _current_seq(self) -> int:
        return self._seq

    @serialized_method
    def allocate_client_id(self, allocation_key: str) -> str:
        return super().allocate_client_id(allocation_key)

    @serialized_method
    def publish(
        self,
        topic: str,
        payload: Any,
        *,
        event_id: Optional[str] = None,
        audience: str = BROADCAST_AUDIENCE,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return super().publish(
            topic,
            payload,
            event_id=event_id,
            audience=audience,
            metadata=metadata,
        )

    @serialized_method
    def snapshot(
        self,
        client_id: str,
        since_seq: int = 0,
        topics: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        return super().snapshot(client_id, since_seq, topics)

    @serialized_method
    def acknowledge(self, client_id: str, seq: int) -> Dict[str, Any]:
        return super().acknowledge(client_id, seq)

    @serialized_method
    def add_waiter(self, loop: Any, future: Any, seen_seq: int) -> None:
        super().add_waiter(loop, future, seen_seq)

    @serialized_method
    def discard_waiter(self, future: Any) -> None:
        super().discard_waiter(future)

    @serialized_method
    def add_tap(self, tap: EventTap) -> None:
        super().add_tap(tap)

    @serialized_method
    def remove_tap(self, tap: EventTap) -> None:
        super().remove_tap(tap)

    @serialized_method
    def taps(self):
        return super().taps()

    def publish_topic(
        self,
        topic: str,
        payload: Optional[Dict[str, Any]],
        audience: str = BROADCAST_AUDIENCE,
        **metadata: Any,
    ) -> Dict[str, Any]:
        """Publish one domain event; taps observe it on this thread first."""
        event_id_value = metadata.pop("event_id", None)
        event_id = str(event_id_value) if event_id_value else None
        normalized_topic = str(topic or "")
        normalized_audience = str(audience or BROADCAST_AUDIENCE)
        event_payload = dict(payload or {})
        for tap in self.taps():
            try:
                tap(normalized_topic, event_payload, normalized_audience, event_id)
            except Exception as exc:  # noqa: BLE001 - a tap failure must not block publishing
                # A failing tap on console-log entries must not log again (feedback loop).
                if normalized_topic != BusSignals.PYCORE_LOG:
                    ColorPrint.red(f"[EventJournal] tap {getattr(tap, '__qualname__', tap)} failed topic={normalized_topic}: {exc}")
        return self.publish(
            normalized_topic,
            event_payload,
            event_id=event_id,
            audience=normalized_audience,
            metadata=metadata,
        )

    def publish_log(self, entry: Dict[str, Any]) -> None:
        """Console log journal sink: one sequenced entry per pycore_log event."""
        self.publish_topic(
            BusSignals.PYCORE_LOG,
            entry,
            event_id=f"{entry.get('instance_id')}:{entry.get('seq')}",
        )


event_journal = EventJournal()


__all__ = ["EventJournal", "event_journal"]
