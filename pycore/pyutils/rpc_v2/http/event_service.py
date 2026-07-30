# -*- coding: utf-8 -*-
"""Standalone FastAPI event journal shared with isolated subprocess assets.

This module intentionally imports no pycore package. Standalone services may
load it directly from its file path and inject their FastAPI module.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Deque, Dict, Iterable, Optional, Set, Tuple


DEFAULT_EVENT_MAX = 5000
DEFAULT_EVENT_MAX_AGE_SECONDS = 3600.0
DEFAULT_EVENT_WAIT_SECONDS = 20.0
MAX_EVENT_WAIT_SECONDS = 30.0
SSE_KEEP_ALIVE_SECONDS = 15.0


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sse_frame(event: str, data: Any, event_id: Optional[int] = None) -> str:
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"), default=str)
    lines = []
    if event_id is not None:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    for line in encoded.splitlines() or [""]:
        lines.append(f"data: {line}")
    return "\n".join(lines) + "\n\n"


@dataclass(frozen=True)
class SseEvent:
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


class SseEventJournal:
    """Bounded event journal with per-client replay cursors and ACK state."""

    def __init__(
        self,
        *,
        max_events: int = DEFAULT_EVENT_MAX,
        max_age_seconds: float = DEFAULT_EVENT_MAX_AGE_SECONDS,
        max_wait_seconds: float = MAX_EVENT_WAIT_SECONDS,
    ) -> None:
        self.instance_id = uuid.uuid4().hex
        self.max_events = max(1, int(max_events))
        self.max_age_seconds = max(1.0, float(max_age_seconds))
        self.max_wait_seconds = max(0.1, float(max_wait_seconds))
        self._events: Deque[SseEvent] = deque()
        self._client_acks: Dict[str, Tuple[int, float]] = {}
        self._seq = 0
        self._waiters: Set[asyncio.Future] = set()

    @property
    def seq(self) -> int:
        return self._seq

    async def publish(
        self,
        topic: str,
        payload: Any,
        *,
        event_id: Optional[str] = None,
        audience: str = "*",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        normalized_topic = str(topic or "").strip()
        if not normalized_topic:
            raise ValueError("Event topic is required")
        self._seq += 1
        event = SseEvent(
            instance_id=self.instance_id,
            event_id=str(event_id or uuid.uuid4().hex),
            seq=self._seq,
            topic=normalized_topic,
            payload=payload,
            audience=str(audience or "*").strip() or "*",
            metadata=dict(metadata or {}),
            created_at=_utc_now(),
            created_monotonic=time.monotonic(),
        )
        self._events.append(event)
        self._prune()
        waiters = tuple(self._waiters)
        self._waiters.clear()
        for waiter in waiters:
            if not waiter.done():
                waiter.set_result(None)
        return event.as_dict()

    async def poll(
        self,
        *,
        client_id: str,
        since_seq: int = 0,
        timeout_seconds: float = DEFAULT_EVENT_WAIT_SECONDS,
        topics: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        normalized_client_id = str(client_id or "").strip()
        acknowledged_seq = self._client_acks.get(normalized_client_id, (0, 0.0))[0]
        cursor = max(0, int(since_seq or 0), acknowledged_seq)
        wait_seconds = min(self.max_wait_seconds, max(0.0, float(timeout_seconds)))
        topic_filter = {
            str(topic).strip()
            for topic in (topics or ())
            if str(topic).strip()
        }
        self._prune()
        response = self._snapshot(normalized_client_id, cursor, topic_filter)
        if (
            response["events"]
            or response["replay_lost"]
            or response["cursor_ahead"]
            or wait_seconds <= 0
        ):
            return response
        waiter = asyncio.get_running_loop().create_future()
        self._waiters.add(waiter)
        await asyncio.wait({waiter}, timeout=wait_seconds)
        self._waiters.discard(waiter)
        if not waiter.done():
            waiter.cancel()
        self._prune()
        return self._snapshot(normalized_client_id, cursor, topic_filter)

    async def acknowledge(self, client_id: str, seq: int) -> Dict[str, Any]:
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

    def _snapshot(
        self,
        client_id: str,
        since_seq: int,
        topics: Set[str],
    ) -> Dict[str, Any]:
        earliest_seq = self._events[0].seq if self._events else self._seq + 1
        replay_lost = since_seq > 0 and since_seq < earliest_seq - 1
        cursor_ahead = since_seq > self._seq
        events = [
            event.as_dict()
            for event in self._events
            if event.seq > since_seq
            and self._audience_matches(event.audience, client_id)
            and (not topics or event.topic in topics)
        ]
        return {
            "success": True,
            "instance_id": self.instance_id,
            "seq": self._seq,
            "earliest_seq": earliest_seq,
            "replay_lost": replay_lost,
            "cursor_ahead": cursor_ahead,
            "events": events,
        }

    @staticmethod
    def _audience_matches(audience: str, client_id: str) -> bool:
        normalized_audience = str(audience or "*").strip()
        if normalized_audience == "*":
            return True
        if normalized_audience.startswith("client:"):
            normalized_audience = normalized_audience.split(":", 1)[1]
        return bool(client_id and normalized_audience == client_id)

    def _prune(self) -> None:
        now = time.monotonic()
        while self._events and (
            len(self._events) > self.max_events
            or now - self._events[0].created_monotonic > self.max_age_seconds
        ):
            self._events.popleft()
        stale_clients = tuple(
            client_id
            for client_id, (_seq, seen_at) in self._client_acks.items()
            if now - seen_at > self.max_age_seconds
        )
        for client_id in stale_clients:
            self._client_acks.pop(client_id, None)


class HttpEventService:
    """Attach an HTTP SSE stream and ACK route for one event journal."""

    def __init__(
        self,
        app: Optional[Any] = None,
        *,
        fastapi_module: Any,
        title: str = "HTTP Event Service",
        version: str = "1.0.0",
        event_path: str = "/api/events",
        event_max: int = DEFAULT_EVENT_MAX,
        event_max_age_seconds: float = DEFAULT_EVENT_MAX_AGE_SECONDS,
    ) -> None:
        self.fastapi = fastapi_module
        self.json_encoder = fastapi_module.encoders.jsonable_encoder
        self.json_response_type = fastapi_module.responses.JSONResponse
        self.app = app or fastapi_module.FastAPI(
            title=title,
            version=version,
            docs_url=None,
            redoc_url=None,
        )
        self.event_path = "/" + str(event_path or "").strip("/")
        self.events = SseEventJournal(
            max_events=event_max,
            max_age_seconds=event_max_age_seconds,
        )
        self._attach_routes()

    async def publish_event(
        self,
        topic: str,
        payload: Any,
        *,
        event_id: Optional[str] = None,
        audience: str = "*",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return await self.events.publish(
            topic,
            payload,
            event_id=event_id,
            audience=audience,
            metadata=metadata,
        )

    def _attach_routes(self) -> None:
        ack_body = self.fastapi.Body(default={})
        streaming_response_type = self.fastapi.responses.StreamingResponse

        async def stream_events(
            client_id: str,
            since_seq: int = 0,
            topics: Optional[str] = None,
        ) -> Any:
            normalized_client_id = str(client_id or "").strip()
            cursor = max(0, int(since_seq or 0))
            topic_filter = topics.split(",") if topics else None

            async def event_stream():
                nonlocal cursor
                first = True
                while True:
                    result = await self.events.poll(
                        client_id=normalized_client_id,
                        since_seq=cursor,
                        timeout_seconds=SSE_KEEP_ALIVE_SECONDS,
                        topics=topic_filter,
                    )
                    state = {
                        "instance_id": result["instance_id"],
                        "seq": result["seq"],
                        "earliest_seq": result["earliest_seq"],
                        "replay_lost": result["replay_lost"],
                        "cursor_ahead": result["cursor_ahead"],
                    }
                    if first or result["replay_lost"] or result["cursor_ahead"]:
                        yield _sse_frame("sse.state", state)
                    events = result["events"]
                    if events:
                        for record in events:
                            cursor = max(cursor, int(record.get("seq") or 0))
                            yield _sse_frame("sse.event", record, cursor)
                    else:
                        yield ": keep-alive\n\n"
                    first = False

            return streaming_response_type(
                event_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache, no-transform",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        async def acknowledge_events(
            payload: Dict[str, Any] = ack_body,
        ) -> Any:
            result = await self.events.acknowledge(
                str(payload.get("client_id") or ""),
                int(payload.get("seq") or 0),
            )
            return self.json_response_type(self.json_encoder(result))

        self.app.add_api_route(
            self.event_path,
            stream_events,
            methods=["GET"],
            name="rpc_event_stream",
        )
        self.app.add_api_route(
            f"{self.event_path}/ack",
            acknowledge_events,
            methods=["POST"],
            name="rpc_event_ack",
        )


__all__ = ["HttpEventService", "SseEvent", "SseEventJournal"]
