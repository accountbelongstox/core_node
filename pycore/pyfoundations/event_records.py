# -*- coding: utf-8 -*-
"""Bounded replayable event record journal (stdlib only, no thread ownership).

One owner (a loop thread or a state-owner thread) calls every method; readers
that must not share that thread subscribe and receive pushes. Standalone
subprocess services load this module by path and use one journal on their own
event loop; pycore wraps it in the THREAD_BUS-fed
``pyfoundations.event_journal`` instance.

Subscriber ``deliver`` callables run on the owner and must not raise or block.
"""

from __future__ import annotations

import asyncio
import hashlib
import time
import uuid
from collections import deque
from dataclasses import dataclass
from typing import Any, Callable, Deque, Dict, FrozenSet, Hashable, Iterable, List, Optional, Tuple

from pycore.pyfoundations.network_constants import (
    SSE_EVENT_JOURNAL_MAX,
    SSE_EVENT_MAX_AGE_SECONDS,
    SSE_EVENT_MAX_WAIT_SECONDS,
)
from pycore.pyfoundations.time_utils import utc_now_iso

BROADCAST_AUDIENCE = "*"
CLIENT_AUDIENCE_PREFIX = "client:"
CLIENT_ID_PREFIX = "pycore-"
CLIENT_ID_INSTANCE_CHARS = 8
CLIENT_ID_DIGEST_CHARS = 32
Deliver = Callable[[Dict[str, Any]], None]
PublishSpec = Tuple[str, Any, Optional[str], str, Optional[Dict[str, Any]], bool]


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


class _Subscription:
    __slots__ = ("deliver", "client_id", "topics", "cursor")

    def __init__(self, deliver: Deliver, client_id: str, topics: Optional[FrozenSet[str]], cursor: int) -> None:
        self.deliver = deliver
        self.client_id = client_id
        self.topics = topics
        self.cursor = cursor


def client_audience(client_id: str) -> str:
    return f"{CLIENT_AUDIENCE_PREFIX}{client_id}"


def derive_client_id(instance_id: str, allocation_key: str) -> str:
    """The server-owned client ID of one browser allocation key: stable for the
    key within one journal instance, unguessable without the key."""
    normalized_key = str(allocation_key or "").strip()
    if not normalized_key:
        digest = uuid.uuid4().hex
    else:
        digest = hashlib.sha256(f"{instance_id}:{normalized_key}".encode("utf-8")).hexdigest()[:CLIENT_ID_DIGEST_CHARS]
    return f"{CLIENT_ID_PREFIX}{instance_id[:CLIENT_ID_INSTANCE_CHARS]}-{digest}"


def _audience_client(audience: str) -> str:
    normalized = str(audience or BROADCAST_AUDIENCE).strip()
    if normalized.startswith(CLIENT_AUDIENCE_PREFIX):
        return normalized[len(CLIENT_AUDIENCE_PREFIX):]
    return normalized


def _resolve_waiter(future: Any, value: Any) -> None:
    if not future.done():
        future.set_result(value)


class EventRecordJournal:
    """Bounded journal with replay cursors, ACK state and push subscriptions."""

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
        self._seq = 0
        self._pruned_seq = 0
        self._subscribers: Dict[Hashable, _Subscription] = {}

    @property
    def seq(self) -> int:
        return self._seq

    @staticmethod
    def topic_filter(topics: Optional[Iterable[str]]) -> Optional[FrozenSet[str]]:
        """``None`` keeps every topic; an empty collection keeps none."""
        if topics is None:
            return None
        return frozenset(str(topic).strip() for topic in topics if str(topic).strip())

    def publish(
        self,
        topic: str,
        payload: Any,
        *,
        event_id: Optional[str] = None,
        audience: str = BROADCAST_AUDIENCE,
        metadata: Optional[Dict[str, Any]] = None,
        retain: bool = True,
    ) -> Dict[str, Any]:
        return self.publish_batch(((topic, payload, event_id, audience, metadata, retain),))[0]

    def publish_batch(self, specs: Iterable[PublishSpec]) -> List[Dict[str, Any]]:
        """Publish in order and push once per subscriber. A record published
        with ``retain=False`` is delivered live only: it takes no sequence
        number and is never replayed."""
        records: List[EventRecord] = []
        for topic, payload, event_id, audience, metadata, retain in specs:
            normalized_topic = str(topic or "").strip()
            if not normalized_topic:
                raise ValueError("Event topic is required")
            if retain:
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
            if retain:
                self._events.append(record)
            records.append(record)
        self._prune_events()
        dicts = [record.as_dict() for record in records]
        self._fan_out(records, dicts)
        return dicts

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
        topic_filter = self.topic_filter(topics)
        self._prune_events()
        records: List[Dict[str, Any]] = []
        if topic_filter is None or topic_filter:
            for record in reversed(self._events):
                if record.seq <= cursor:
                    break
                if self._wanted(record, normalized_client_id, topic_filter):
                    records.append(record.as_dict())
            records.reverse()
        return self._result(records, 0 < cursor < self._pruned_seq, cursor > self._seq)

    def acknowledge(self, client_id: str, seq: int) -> Dict[str, Any]:
        normalized_client_id = str(client_id or "").strip()
        if not normalized_client_id:
            raise ValueError("client_id is required")
        acknowledged_seq = max(0, min(int(seq or 0), self._seq))
        previous = self._client_acks.get(normalized_client_id, (0, 0.0))[0]
        highest = max(previous, acknowledged_seq)
        self._client_acks[normalized_client_id] = (highest, time.monotonic())
        self._prune_acks()
        return {
            "success": True,
            "client_id": normalized_client_id,
            "acked_seq": highest,
            "instance_id": self.instance_id,
            "seq": self._seq,
        }

    def subscribe(
        self,
        key: Hashable,
        deliver: Deliver,
        client_id: str,
        since_seq: int = 0,
        topics: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        """Register ``deliver`` for matching records published from now on and
        return the backlog snapshot, atomically (no gap, no duplicate)."""
        result = self.snapshot(client_id, since_seq, topics)
        self._subscribers[key] = _Subscription(
            deliver,
            str(client_id or "").strip(),
            self.topic_filter(topics),
            int(result["seq"]),
        )
        return result

    def retopic(self, key: Hashable, topics: Optional[Iterable[str]]) -> Optional[Dict[str, Any]]:
        """Change one subscription's topics; returns the backlog of the new
        topics since the subscription's cursor, or None for an unknown key."""
        subscription = self._subscribers.get(key)
        if subscription is None:
            return None
        subscription.topics = self.topic_filter(topics)
        result = self.snapshot(subscription.client_id, subscription.cursor, topics)
        subscription.cursor = int(result["seq"])
        return result

    def unsubscribe(self, key: Hashable) -> None:
        self._subscribers.pop(key, None)

    def wants(self, topic: str) -> bool:
        return any(
            subscription.topics is None or topic in subscription.topics
            for subscription in self._subscribers.values()
        )

    def _result(self, events: List[Dict[str, Any]], replay_lost: bool, cursor_ahead: bool) -> Dict[str, Any]:
        return {
            "success": True,
            "instance_id": self.instance_id,
            "seq": self._seq,
            "earliest_seq": self._events[0].seq if self._events else self._seq + 1,
            "replay_lost": replay_lost,
            "cursor_ahead": cursor_ahead,
            "events": events,
        }

    def _fan_out(self, records: List[EventRecord], dicts: List[Dict[str, Any]]) -> None:
        for subscription in tuple(self._subscribers.values()):
            matched = [
                event
                for record, event in zip(records, dicts)
                if self._wanted(record, subscription.client_id, subscription.topics)
            ]
            subscription.cursor = self._seq
            if matched:
                subscription.deliver(self._result(matched, False, False))

    @staticmethod
    def _wanted(record: EventRecord, client_id: str, topic_filter: Optional[FrozenSet[str]]) -> bool:
        if topic_filter is not None and record.topic not in topic_filter:
            return False
        if record.audience == BROADCAST_AUDIENCE:
            return True
        return bool(client_id and _audience_client(record.audience) == client_id)

    def _prune_events(self) -> None:
        now = time.monotonic()
        while self._events and (
            len(self._events) > self.max_events
            or now - self._events[0].created_monotonic > self.max_age_seconds
        ):
            self._pruned_seq = self._events.popleft().seq

    def _prune_acks(self) -> None:
        now = time.monotonic()
        for client_id in [
            client_id
            for client_id, (_seq, seen_at) in self._client_acks.items()
            if now - seen_at > self.max_age_seconds
        ]:
            self._client_acks.pop(client_id, None)


async def poll_journal(
    journal: EventRecordJournal,
    *,
    client_id: str,
    since_seq: int = 0,
    timeout_seconds: float = 0.0,
    topics: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    """Backlog after ``since_seq`` on the running event loop, waiting up to
    ``timeout_seconds`` for a matching record when nothing is pending. The
    journal must publish on this loop's thread or deliver thread-safely."""
    wait_seconds = min(SSE_EVENT_MAX_WAIT_SECONDS, max(0.0, float(timeout_seconds)))
    loop = asyncio.get_running_loop()
    arrived = loop.create_future()
    key = object()

    def deliver(frame: Dict[str, Any]) -> None:
        loop.call_soon_threadsafe(_resolve_waiter, arrived, frame)

    result = journal.subscribe(key, deliver, client_id, since_seq, topics)
    if result["events"] or result["replay_lost"] or result["cursor_ahead"] or wait_seconds <= 0:
        journal.unsubscribe(key)
        return result
    await asyncio.wait({arrived}, timeout=wait_seconds)
    journal.unsubscribe(key)
    if arrived.done():
        return arrived.result()
    arrived.cancel()
    return journal.snapshot(client_id, since_seq, topics)


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
    "Deliver",
    "EventRecord",
    "EventRecordJournal",
    "PublishSpec",
    "client_audience",
    "derive_client_id",
    "journal_state",
    "poll_journal",
]
