# -*- coding: utf-8 -*-
"""WebSocket transport over the process event journal (the only event transport).

Frames are JSON objects keyed by ``op``. The first client frame is ``hello``
(client_id, since_seq, topics, leases); afterwards the client may send
``subscribe``, ``lease``, ``ack`` and ``ping``. The server answers with
``state`` (replay cursor state), ``events`` (record batches), ``pong`` and
``error``. Replay, ACK and audience rules are the journal's own.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, Dict, Iterable, List, Optional, Set

from pycore.pyfoundations.network_constants import (
    HTTP_WS_PATH,
    WS_CLOSE_POLICY_VIOLATION,
    WS_ERROR_FRAME_INVALID,
    WS_ERROR_HELLO_REQUIRED,
    WS_ERROR_OP_UNKNOWN,
    WS_EVENT_BATCH_MAX,
    WS_HELLO_TIMEOUT_SECONDS,
    WS_MAX_LEASES,
    WS_MAX_TOPICS,
    WS_NAME_MAX_CHARS,
    WS_OP_ACK,
    WS_OP_ERROR,
    WS_OP_EVENTS,
    WS_OP_HELLO,
    WS_OP_LEASE,
    WS_OP_PING,
    WS_OP_PONG,
    WS_OP_STATE,
    WS_OP_SUBSCRIBE,
    WS_PING_INTERVAL_SECONDS,
)
from pycore.pyfoundations.event_records import EventRecordJournal, journal_state, poll_journal
from pycore.pyutils.rpc.ui_presence import ui_presence

_MESSAGE_RECEIVE = "websocket.receive"
_MESSAGE_DISCONNECT = "websocket.disconnect"


def _decode_frame(message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    text = message.get("text")
    if text is None:
        raw = message.get("bytes")
        if raw is None:
            return None
        text = bytes(raw).decode("utf-8", "replace")
    try:
        frame = json.loads(text)
    except json.JSONDecodeError:
        return None
    return frame if isinstance(frame, dict) else None


def _bounded_names(raw: Any, limit: int) -> Optional[Set[str]]:
    """``None`` keeps every topic; a list becomes a bounded name set."""
    if raw is None:
        return None
    if not isinstance(raw, list):
        return set()
    names = (str(item).strip()[:WS_NAME_MAX_CHARS] for item in raw[:limit])
    return {name for name in names if name}


class _WsEventSession:
    """One accepted socket: cursor, topic filter and held leases."""

    def __init__(self, websocket: Any, journal: EventRecordJournal, fastapi_module: Any) -> None:
        self.websocket = websocket
        self.journal = journal
        self.connected_state = fastapi_module.websockets.WebSocketState.CONNECTED
        self.disconnect_error = fastapi_module.WebSocketDisconnect
        self.session_id = uuid.uuid4().hex
        self.client_id = ""
        self.cursor = 0
        self.topics: Optional[Set[str]] = None
        self.leases: Set[str] = set()
        self.announce_state = True

    async def send(self, frame: Dict[str, Any]) -> bool:
        if self.websocket.application_state != self.connected_state:
            return False
        encoded = json.dumps(frame, ensure_ascii=False, separators=(",", ":"), default=str)
        # A peer can vanish between the state check and the write; Starlette
        # reports that single I/O race as WebSocketDisconnect.
        try:
            await self.websocket.send_text(encoded)
        except self.disconnect_error:
            return False
        return True

    async def send_error(self, code: str) -> bool:
        return await self.send({"op": WS_OP_ERROR, "code": code})

    def apply_hello(self, frame: Dict[str, Any]) -> None:
        self.client_id = str(frame.get("client_id") or "").strip()[:WS_NAME_MAX_CHARS]
        self.cursor = max(0, int(frame.get("since_seq") or 0))
        self.topics = _bounded_names(frame.get("topics"), WS_MAX_TOPICS)
        self.set_leases(_bounded_names(frame.get("leases"), WS_MAX_LEASES) or set())

    def set_leases(self, names: Set[str]) -> None:
        for name in self.leases - names:
            ui_presence.release_socket(name, self.session_id)
        for name in names - self.leases:
            ui_presence.hold_socket(name, self.session_id)
        self.leases = set(names)

    def toggle_lease(self, name: str, held: bool) -> None:
        normalized = str(name or "").strip()[:WS_NAME_MAX_CHARS]
        if not normalized:
            return
        wanted = set(self.leases)
        if held and len(wanted) < WS_MAX_LEASES:
            wanted.add(normalized)
        if not held:
            wanted.discard(normalized)
        self.set_leases(wanted)

    def close(self) -> None:
        ui_presence.release_sockets(self.session_id, self.leases)
        self.leases = set()

    def poll(self, wait_seconds: float = WS_PING_INTERVAL_SECONDS) -> "asyncio.Future[Dict[str, Any]]":
        return asyncio.ensure_future(
            poll_journal(
                self.journal,
                client_id=self.client_id,
                since_seq=self.cursor,
                timeout_seconds=wait_seconds,
                topics=self.topics,
            )
        )

    async def deliver(self, result: Dict[str, Any]) -> bool:
        if self.announce_state or result["replay_lost"] or result["cursor_ahead"]:
            self.announce_state = False
            if not await self.send({"op": WS_OP_STATE, **journal_state(result)}):
                return False
        if result["cursor_ahead"]:
            self.cursor = int(result["seq"])
        records: List[Dict[str, Any]] = result["events"]
        for start in range(0, len(records), WS_EVENT_BATCH_MAX):
            if not await self.send({"op": WS_OP_EVENTS, "records": records[start:start + WS_EVENT_BATCH_MAX]}):
                return False
        # The snapshot saw every event up to ``seq``; filtered-out ones included.
        self.cursor = max(self.cursor, int(result["seq"]))
        return True

    async def handle(self, frame: Dict[str, Any]) -> bool:
        """Apply one client frame; ``True`` means the poll must restart."""
        op = frame.get("op")
        if op == WS_OP_PING:
            await self.send({"op": WS_OP_PONG, "t": frame.get("t")})
            return False
        if op == WS_OP_ACK:
            if self.client_id:
                self.journal.acknowledge(self.client_id, int(frame.get("seq") or 0))
            return False
        if op == WS_OP_LEASE:
            self.toggle_lease(str(frame.get("name") or ""), bool(frame.get("held")))
            return False
        if op == WS_OP_SUBSCRIBE:
            self.topics = _bounded_names(frame.get("topics"), WS_MAX_TOPICS)
            return True
        await self.send_error(WS_ERROR_OP_UNKNOWN)
        return False


class WsEventService:
    """Attach the ``/api/ws`` event socket to one FastAPI app and journal."""

    def __init__(
        self,
        app: Any,
        *,
        fastapi_module: Any,
        journal: EventRecordJournal,
        ws_path: str = HTTP_WS_PATH,
    ) -> None:
        self.app = app
        self.fastapi = fastapi_module
        self.journal = journal
        self.ws_path = "/" + str(ws_path or "").strip("/")
        self._attach_route()

    def _attach_route(self) -> None:
        async def event_socket(websocket) -> None:
            await websocket.accept()
            session = _WsEventSession(websocket, self.journal, self.fastapi)
            hello = await self._receive_hello(websocket)
            if hello is None:
                await session.send_error(WS_ERROR_HELLO_REQUIRED)
                await websocket.close(code=WS_CLOSE_POLICY_VIOLATION)
                return
            session.apply_hello(hello)
            await self._serve(session)

        event_socket.__annotations__["websocket"] = self.fastapi.WebSocket
        self.app.add_api_websocket_route(self.ws_path, event_socket, name="ws_event_socket")

    async def _receive_hello(self, websocket: Any) -> Optional[Dict[str, Any]]:
        receiving = asyncio.ensure_future(websocket.receive())
        done, _pending = await asyncio.wait({receiving}, timeout=WS_HELLO_TIMEOUT_SECONDS)
        if not done:
            receiving.cancel()
            return None
        message = receiving.result()
        if message.get("type") != _MESSAGE_RECEIVE:
            return None
        frame = _decode_frame(message)
        if frame is None or frame.get("op") != WS_OP_HELLO:
            return None
        return frame

    async def _serve(self, session: _WsEventSession) -> None:
        receiving = asyncio.ensure_future(session.websocket.receive())
        # State and any backlog go out at once instead of after the first wait.
        open_socket = await session.deliver(await session.poll(0.0))
        polling = session.poll()
        while open_socket:
            done, _pending = await asyncio.wait(
                {receiving, polling},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if receiving in done:
                message = receiving.result()
                if message.get("type") == _MESSAGE_DISCONNECT:
                    open_socket = False
                    continue
                frame = _decode_frame(message)
                restart = False
                if frame is None:
                    open_socket = await session.send_error(WS_ERROR_FRAME_INVALID)
                else:
                    restart = await session.handle(frame)
                if restart and polling not in done:
                    polling.cancel()
                    polling = session.poll()
                receiving = asyncio.ensure_future(session.websocket.receive())
            if polling in done and not polling.cancelled():
                open_socket = open_socket and await session.deliver(polling.result())
                polling = session.poll()
        self._cancel((receiving, polling))
        session.close()

    @staticmethod
    def _cancel(tasks: Iterable["asyncio.Future[Any]"]) -> None:
        for task in tasks:
            if not task.done():
                task.cancel()


__all__ = ["WsEventService"]
