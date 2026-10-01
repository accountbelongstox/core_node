# -*- coding: utf-8 -*-
"""Journal polling shared by the event views, and the bounded JSON long-poll
HTTP view used by standalone subprocess services.

pycore serves its event journal only over WebSocket (ws_event_service).
Standalone subprocess services load this module by path with their own
EventRecordJournal; its only project dependencies are stdlib-only leaves.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Iterable, Optional

from pycore.pyfoundations.event_records import BROADCAST_AUDIENCE, EventRecordJournal
from pycore.pyfoundations.network_constants import (
    SSE_EVENT_MAX_WAIT_SECONDS,
    SSE_EVENT_WAIT_SECONDS,
)


async def poll_journal(
    journal: EventRecordJournal,
    *,
    client_id: str,
    since_seq: int = 0,
    timeout_seconds: float = SSE_EVENT_WAIT_SECONDS,
    topics: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    """Snapshot the journal, waiting up to ``timeout_seconds`` for a record."""
    topic_list = list(topics) if topics is not None else None
    wait_seconds = min(SSE_EVENT_MAX_WAIT_SECONDS, max(0.0, float(timeout_seconds)))
    response = journal.snapshot(client_id, since_seq, topic_list)
    if (
        response["events"]
        or response["replay_lost"]
        or response["cursor_ahead"]
        or wait_seconds <= 0
    ):
        return response
    waiter = asyncio.get_running_loop().create_future()
    journal.add_waiter(asyncio.get_running_loop(), waiter, response["seq"])
    await asyncio.wait({waiter}, timeout=wait_seconds)
    journal.discard_waiter(waiter)
    if not waiter.done():
        waiter.cancel()
    return journal.snapshot(client_id, since_seq, topic_list)


def journal_state(result: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "instance_id": result["instance_id"],
        "seq": result["seq"],
        "earliest_seq": result["earliest_seq"],
        "replay_lost": result["replay_lost"],
        "cursor_ahead": result["cursor_ahead"],
    }


class HttpEventService:
    """Attach the long-poll and ACK routes for one journal (standalone services)."""

    def __init__(
        self,
        app: Optional[Any] = None,
        *,
        fastapi_module: Any,
        title: str = "HTTP Event Service",
        version: str = "1.0.0",
        lifespan: Optional[Any] = None,
        event_path: str,
        journal: Optional[EventRecordJournal] = None,
    ) -> None:
        self.fastapi = fastapi_module
        self.json_encoder = fastapi_module.encoders.jsonable_encoder
        self.json_response_type = fastapi_module.responses.JSONResponse
        self.app = app or fastapi_module.FastAPI(
            title=title,
            version=version,
            docs_url=None,
            redoc_url=None,
            lifespan=lifespan,
        )
        self.event_path = "/" + str(event_path or "").strip("/")
        self.events = journal if journal is not None else EventRecordJournal()
        self._attach_routes()

    async def publish_event(
        self,
        topic: str,
        payload: Any,
        *,
        event_id: Optional[str] = None,
        audience: str = BROADCAST_AUDIENCE,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self.events.publish(
            topic,
            payload,
            event_id=event_id,
            audience=audience,
            metadata=metadata,
        )

    def _attach_routes(self) -> None:
        ack_body = self.fastapi.Body(default={})

        async def poll_events(
            client_id: str,
            since_seq: int = 0,
            timeout_s: float = SSE_EVENT_WAIT_SECONDS,
            topics: Optional[str] = None,
        ) -> Any:
            result = await poll_journal(
                self.events,
                client_id=client_id,
                since_seq=since_seq,
                timeout_seconds=timeout_s,
                topics=topics.split(",") if topics else None,
            )
            return self.json_response_type(self.json_encoder(result))

        async def acknowledge_events(
            payload: Dict[str, Any] = ack_body,
        ) -> Any:
            result = self.events.acknowledge(
                str(payload.get("client_id") or ""),
                int(payload.get("seq") or 0),
            )
            return self.json_response_type(self.json_encoder(result))

        self.app.add_api_route(
            f"{self.event_path}/poll",
            poll_events,
            methods=["GET"],
            name="sse_event_poll",
        )
        self.app.add_api_route(
            f"{self.event_path}/ack",
            acknowledge_events,
            methods=["POST"],
            name="sse_event_ack",
        )


__all__ = ["HttpEventService", "journal_state", "poll_journal"]
