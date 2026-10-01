# -*- coding: utf-8 -*-
"""Bounded replayable event record journal (stdlib only, no thread ownership).

Standalone subprocess services load this module by path and use one journal on
their own event loop; pycore wraps it in the THREAD_BUS-owned
``pyfoundations.event_journal`` instance.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections import deque
from dataclasses import dataclass
from typing import Any, Callable, Deque, Dict, Iterable, Optional, Set, Tuple

from pycore.pyfoundations.network_constants import (
    SSE_EVENT_JOURNAL_MAX,
    SSE_EVENT_MAX_AGE_SECONDS,
    SSE_EVENT_MAX_WAIT_SECONDS,
)
from pycore.pyfoundations.time_utils import utc_now_iso

BROADCAST_AUDIENCE = "*"
CLIENT_AUDIENCE_PREFIX = "client:"
EventTap = Callable[[str, Dict[str, Any], str, Optional[str]], None]
Waiter = Tuple[Any, Any]


@dataclass(frozen=True)
class EventRecord:
    instance_id: str
    event_id: str
    seq: int
    topic: str
    payload: Any
    audience: str
    metadata: Dict[str, Any]
    created_at: str
    created_monotonic: float

    def as_dict(self) -> Dict[str, Any]:
        return {
            "instance_id": self.instance_id,
            "event_id": self.event_id,
            "seq": self.seq,
            "topic": self.topic,
            "payload": self.payload,
            "audience": self.audience,
            "metadata": dict(self.metadata),
            "created_at": self.created_at,
        }


def client_audience(client_id: str) -> str:
    return f"{CLIENT_AUDIENCE_PREFIX}{client_id}"


def _audience_client(audience: str) -> str:
    normalized = str(audience or BROADCAST_AUDIENCE).strip()
    if normalized.startswith(CLIENT_AUDIENCE_PREFIX):
        return normalized[len(CLIENT_AUDIENCE_PREFIX):]
    return normalized


def _resolve_waiter(future: Any) -> None:
    if not future.done():
        future.set_result(None)


class EventRecordJournal:
    """Bounded journal with replay cursors, ACK state and event-loop waiters."""

    def __init__(
        self,
        *,
        max_events: int = SSE_EVENT_JOURNAL_MAX,
        max_age_seconds: float = SSE_EVENT_MAX_AGE_SECONDS,
    ) -> None:
        self.instance_id = uuid.uuid4().hex
        self.max_events = max(1, int(max_events))
        self.max_age_seconds = max(1.0, float(max_age_seconds))
        self._events: Deque[EventRecord] = deque()
        self._client_acks: Dict[str, Tuple[int, float]] = {}
        self._allocated_clients: Dict[str, Tuple[str, float]] = {}
        self._seq = 0
        self._pruned_seq = 0
        self._waiters: Dict[int, Waiter] = {}
        self._taps: Tuple[EventTap, ...] = ()

    @property
    def seq(self) -> int:
        return self._seq

    def allocate_client_id(self, allocation_key: str) -> str:
        """Return one bounded server-owned ID for a browser allocation key."""
        normalized_key = str(allocation_key or "").strip() or uuid.uuid4().hex
        now = time.monotonic()
        current = self._allocated_clients.get(normalized_key)
        if current is not None:
            self._allocated_clients[normalized_key] = (current[0], now)
            return current[0]
        client_id = f"pycore-{self.instance_id[:8]}-{uuid.uuid4().hex}"
        self._allocated_clients[normalized_key] = (client_id, now)
        self._prune()
        return client_id

    def publish(
        self,
        topic: str,
        payload: Any,
        *,
        event_id: Optional[str] = None,
        audience: str = BROADCAST_AUDIENCE,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        normalized_topic = str(topic or "").strip()
        if not normalized_topic:
            raise ValueError("Event topic is required")
        self._seq += 1
        record = EventRecord(
            instance_id=self.instance_id,
            event_id=str(event_id or uuid.uuid4().hex),
            seq=self._seq,
            topic=normalized_topic,
            payload=payload,
            audience=str(audience or BROADCAST_AUDIENCE).strip() or BROADCAST_AUDIENCE,
            metadata=dict(metadata or {}),
            created_at=utc_now_iso(z_suffix=True),
            created_monotonic=time.monotonic(),
        )
        self._events.append(record)
        self._prune()
        self._wake_waiters()
        return record.as_dict()

    def snapshot(
        self,
        client_id: str,
        since_seq: int = 0,
        topics: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        """Records after the client cursor (the presented or acknowledged seq)."""
        normalized_client_id = str(client_id or "").strip()
        acknowledged_seq = self._client_acks.get(normalized_client_id, (0, 0.0))[0]
        cursor = max(0, int(since_seq or 0), acknowledged_seq)
        topic_filter: Set[str] = {
            str(topic).strip() for topic in (topics or ()) if str(topic).strip()
        }
        self._prune()
        earliest_seq = self._events[0].seq if self._events else self._seq + 1
        records = [
            record.as_dict()
            for record in self._events
            if record.seq > cursor
            and self._audience_matches(record.audience, normalized_client_id)
            and (not topic_filter or record.topic in topic_filter)
        ]
        return {
            "success": True,
            "instance_id": self.instance_id,
            "seq": self._seq,
            "earliest_seq": earliest_seq,
            "replay_lost": 0 < cursor < self._pruned_seq,
            "cursor_ahead": cursor > self._seq,
            "events": records,
        }

    def acknowledge(self, client_id: str, seq: int) -> Dict[str, Any]:
        normalized_client_id = str(client_id or "").strip()
        if not normalized_client_id:
            raise ValueError("client_id is required")
        acknowledged_seq = max(0, min(int(seq or 0), self._seq))
        previous = self._client_acks.get(normalized_client_id, (0, 0.0))[0]
        highest = max(previous, acknowledged_seq)
        self._client_acks[normalized_client_id] = (highest, time.monotonic())
        self._prune()
        return {
            "success": True,
            "client_id": normalized_client_id,
            "acked_seq": highest,
            "instance_id": self.instance_id,
            "seq": self._seq,
        }

    # Coroutine forms used by the event-loop views. The plain journal runs on
    # the caller's loop; the THREAD_BUS-owned journal overrides them to run
    # the owner round trip off the loop.
    async def snapshot_async(self, client_id: str, since_seq: int = 0,
                             topics: Optional[Iterable[str]] = None) -> Dict[str, Any]:
        return self.snapshot(client_id, since_seq, topics)

    async def add_waiter_async(self, loop: Any, future: Any, seen_seq: int) -> None:
        self.add_waiter(loop, future, seen_seq)

    async def discard_waiter_async(self, future: Any) -> None:
        self.discard_waiter(future)

    async def acknowledge_async(self, client_id: str, seq: int) -> Dict[str, Any]:
        return self.acknowledge(client_id, seq)

    async def allocate_client_id_async(self, allocation_key: str) -> str:
        return self.allocate_client_id(allocation_key)

    def add_waiter(self, loop: Any, future: Any, seen_seq: int) -> None:
        """Wake ``future`` on ``loop`` at the next publish, or now when a
        record newer than ``seen_seq`` already exists."""
        if self._seq > int(seen_seq or 0):
            loop.call_soon_threadsafe(_resolve_waiter, future)
            return
        self._waiters[id(future)] = (loop, future)

    def discard_waiter(self, future: Any) -> None:
        self._waiters.pop(id(future), None)

    def add_tap(self, tap: EventTap) -> None:
        if tap not in self._taps:
            self._taps = self._taps + (tap,)

    def remove_tap(self, tap: EventTap) -> None:
        self._taps = tuple(item for item in self._taps if item != tap)

    def taps(self) -> Tuple[EventTap, ...]:
        return self._taps

    def _wake_waiters(self) -> None:
        waiters = tuple(self._waiters.values())
        self._waiters.clear()
        for loop, future in waiters:
            if not loop.is_closed():
                loop.call_soon_threadsafe(_resolve_waiter, future)

    @staticmethod
    def _audience_matches(audience: str, client_id: str) -> bool:
        if str(audience or BROADCAST_AUDIENCE).strip() == BROADCAST_AUDIENCE:
            return True
        return bool(client_id and _audience_client(audience) == client_id)

    def _prune(self) -> None:
        now = time.monotonic()
        while self._events and (
            len(self._events) > self.max_events
            or now - self._events[0].created_monotonic > self.max_age_seconds
        ):
            self._pruned_seq = self._events.popleft().seq
        for client_id in [
            client_id
            for client_id, (_seq, seen_at) in self._client_acks.items()
            if now - seen_at > self.max_age_seconds
        ]:
            self._client_acks.pop(client_id, None)
        for allocation_key in [
            allocation_key
            for allocation_key, (_client_id, seen_at) in self._allocated_clients.items()
            if now - seen_at > self.max_age_seconds
        ]:
            self._allocated_clients.pop(allocation_key, None)
        allocation_excess = len(self._allocated_clients) - self.max_events
        if allocation_excess > 0:
            oldest = sorted(self._allocated_clients.items(), key=lambda item: item[1][1])
            for allocation_key, _entry in oldest[:allocation_excess]:
                self._allocated_clients.pop(allocation_key, None)


async def poll_journal(
    journal: EventRecordJournal,
    *,
    client_id: str,
    since_seq: int = 0,
    timeout_seconds: float = 0.0,
    topics: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    """Snapshot the journal on the running event loop, waiting up to
    ``timeout_seconds`` for a record when nothing is pending."""
    topic_list = list(topics) if topics is not None else None
    wait_seconds = min(SSE_EVENT_MAX_WAIT_SECONDS, max(0.0, float(timeout_seconds)))
    response = await journal.snapshot_async(client_id, since_seq, topic_list)
    if response["events"] or response["replay_lost"] or response["cursor_ahead"] or wait_seconds <= 0:
        return response
    loop = asyncio.get_running_loop()
    waiter = loop.create_future()
    await journal.add_waiter_async(loop, waiter, response["seq"])
    await asyncio.wait({waiter}, timeout=wait_seconds)
    await journal.discard_waiter_async(waiter)
    if not waiter.done():
        waiter.cancel()
    return await journal.snapshot_async(client_id, since_seq, topic_list)


def journal_state(result: Dict[str, Any]) -> Dict[str, Any]:
    """Replay-cursor state of one snapshot."""
    return {
        "instance_id": result["instance_id"],
        "seq": result["seq"],
        "earliest_seq": result["earliest_seq"],
        "replay_lost": result["replay_lost"],
        "cursor_ahead": result["cursor_ahead"],
    }


__all__ = [
    "BROADCAST_AUDIENCE",
    "EventRecord",
    "EventRecordJournal",
    "EventTap",
    "client_audience",
    "journal_state",
    "poll_journal",
]
