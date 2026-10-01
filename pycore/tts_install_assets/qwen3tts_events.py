# -*- coding: utf-8 -*-
"""Qwen3-TTS subprocess queue events: a bounded journal with long-poll and
ACK routes, read by pycore's qwen client (pycore itself serves its events
only over WebSocket)."""

from typing import Any, Dict, Optional

import tts_server_common

event_records = tts_server_common.load_pycore_source(
    "pycore.pyfoundations.event_records", "pyfoundations/event_records.py"
)
QUEUE_EVENT_WAIT_SECONDS = 20.0


class QwenEventService:
    """FastAPI app plus ``{event_path}/poll`` and ``{event_path}/ack`` over one journal."""

    def __init__(self, *, fastapi_module: Any, title: str, version: str,
                 lifespan: Optional[Any], event_path: str) -> None:
        self.fastapi = fastapi_module
        self.app = fastapi_module.FastAPI(
            title=title, version=version, docs_url=None, redoc_url=None, lifespan=lifespan,
        )
        self.events = event_records.EventRecordJournal()
        self.event_path = "/" + str(event_path or "").strip("/")
        self._attach_routes()

    async def publish_event(self, topic: str, payload: Any) -> Dict[str, Any]:
        return self.events.publish(topic, payload)

    def _attach_routes(self) -> None:
        json_response = self.fastapi.responses.JSONResponse
        encode = self.fastapi.encoders.jsonable_encoder
        ack_body = self.fastapi.Body(default={})

        async def poll_events(client_id: str, since_seq: int = 0,
                              timeout_s: float = QUEUE_EVENT_WAIT_SECONDS,
                              topics: Optional[str] = None) -> Any:
            result = await event_records.poll_journal(
                self.events,
                client_id=client_id,
                since_seq=since_seq,
                timeout_seconds=timeout_s,
                topics=topics.split(",") if topics else None,
            )
            return json_response(encode(result))

        async def acknowledge_events(payload: Dict[str, Any] = ack_body) -> Any:
            result = self.events.acknowledge(str(payload.get("client_id") or ""), int(payload.get("seq") or 0))
            return json_response(encode(result))

        self.app.add_api_route(f"{self.event_path}/poll", poll_events, methods=["GET"], name="queue_event_poll")
        self.app.add_api_route(f"{self.event_path}/ack", acknowledge_events, methods=["POST"], name="queue_event_ack")
