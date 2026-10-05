# -*- coding: utf-8 -*-
"""WebSocket transport over the process event journal (the only event transport).

Frames are JSON objects keyed by ``op``. The first client frame is ``hello``
(client_id, since_seq, topics, leases); afterwards the client may send
``subscribe``, ``lease``, ``ack`` and ``ping``. The server answers with
``state`` (replay cursor state), ``events`` (record batches), ``pong`` and
``error``. A session is one journal subscription: the journal pushes the
backlog and every later matching record onto the session's loop, so a session
costs no thread and no polling. A client that cannot keep up is closed and
resumes from its cursor. Replay, ACK and audience rules are the journal's own.
"""

from __future__ import annotations

import asyncio
import uuid
from collections import deque
from typing import Any, Deque, Dict, Iterable, List, Optional, Set

from pycore.pyfoundations.event_journal import EventJournal
from pycore.pyfoundations.event_records import journal_state
from pycore.pyfoundations.json_codec import json_codec
from pycore.pyfoundations.network_constants import (
    HTTP_WS_PATH,
    SSE_EVENT_JOURNAL_MAX,
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
)
from pycore.pyutils.rpc.ui_presence import ui_presence

_MESSAGE_RECEIVE = "websocket.receive"
_MESSAGE_DISCONNECT = "websocket.disconnect"
_WS_CLOSE_TRY_AGAIN_LATER = 1013
_WS_PENDING_EVENTS_MAX = SSE_EVENT_JOURNAL_MAX


def _decode_frame(message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    data = message.get("text")
    if data is None:
        data = message.get("bytes")
        if data is None:
            return None
    try:
        frame = json_codec.decode(data)
    except json_codec.DecodeError:
        return None
    return frame if isinstance(frame, dict) else None


def _bounded_names(raw: Any, limit: int) -> Optional[Set[str]]:
    """``None`` keeps every topic; a list becomes a bounded name set (empty keeps none)."""
    if raw is None:
        return None
    if not isinstance(raw, list):
        return set()
    names = (str(item).strip()[:WS_NAME_MAX_CHARS] for item in raw[:limit])
    return {name for name in names if name}


class _WsEventSession:
    """One accepted socket: topic filter, held leases and the pushed-frame inbox."""

    def __init__(self, websocket: Any, journal: EventJournal, fastapi_module: Any) -> None:
        self.websocket = websocket
        self.journal = journal
        self.connected_state = fastapi_module.websockets.WebSocketState.CONNECTED
        self.disconnect_error = fastapi_module.WebSocketDisconnect
        self.loop = asyncio.get_running_loop()
        self.session_id = uuid.uuid4().hex
        self.client_id = ""
        self.cursor = 0
        self.topics: Optional[Set[str]] = None
        self.leases: Set[str] = set()
        self.announce_state = True
        self.inbox: Deque[Dict[str, Any]] = deque()
        self.inbox_events = 0
        self.overflowed = False
        self.waiter: Optional["asyncio.Future[None]"] = None

    async def send(self, frame: Dict[str, Any]) -> bool:
        if self.websocket.application_state != self.connected_state:
            return False
        encoded = json_codec.encode(frame, default=str).decode("utf-8")
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

    def start(self) -> None:
        self.journal.subscribe(self.session_id, self.push, self.client_id, self.cursor, self.topics)

    def close(self) -> None:
        self.journal.unsubscribe(self.session_id)
        ui_presence.release_sockets(self.session_id, self.leases)
        self.leases = set()

    def push(self, frame: Dict[str, Any]) -> None:
        """Journal writer thread: hand the frame to this session's loop."""
        self.loop.call_soon_threadsafe(self.receive, frame)

    def receive(self, frame: Dict[str, Any]) -> None:
        if self.overflowed:
            return
        self.inbox_events += len(frame["events"])
        if self.inbox_events > _WS_PENDING_EVENTS_MAX:
            self.overflowed = True
        else:
            self.inbox.append(frame)
        if self.waiter is not None and not self.waiter.done():
            self.waiter.set_result(None)

    def next_ready(self) -> "asyncio.Future[None]":
        """A future that completes when a frame is waiting (or the inbox overflowed)."""
        ready = self.loop.create_future()
        if self.inbox or self.overflowed:
            ready.set_result(None)
        else:
            self.waiter = ready
        return ready

    async def flush(self) -> bool:
        """Send every queued frame; ``False`` ends the session."""
        while self.inbox:
            frame = self.inbox.popleft()
            self.inbox_events -= len(frame["events"])
            if not await self.deliver(frame):
                return False
        if self.overflowed:
            await self.websocket.close(code=_WS_CLOSE_TRY_AGAIN_LATER)
            return False
        return True

    async def deliver(self, result: Dict[str, Any]) -> bool:
        if self.announce_state or result["replay_lost"] or result["cursor_ahead"]:
            self.announce_state = False
            if not await self.send({"op": WS_OP_STATE, **journal_state(result)}):
                return False
        records: List[Dict[str, Any]] = result["events"]
        for start in range(0, len(records), WS_EVENT_BATCH_MAX):
            if not await self.send({"op": WS_OP_EVENTS, "records": records[start:start + WS_EVENT_BATCH_MAX]}):
                return False
        return True

    async def handle(self, frame: Dict[str, Any]) -> None:
        """Apply one client frame."""
        op = frame.get("op")
        if op == WS_OP_PING:
            await self.send({"op": WS_OP_PONG, "t": frame.get("t")})
        elif op == WS_OP_ACK:
            if self.client_id:
                self.journal.acknowledge(self.client_id, int(frame.get("seq") or 0))
        elif op == WS_OP_LEASE:
            self.toggle_lease(str(frame.get("name") or ""), bool(frame.get("held")))
        elif op == WS_OP_SUBSCRIBE:
            self.topics = _bounded_names(frame.get("topics"), WS_MAX_TOPICS)
            self.journal.retopic(self.session_id, self.topics)
        else:
            await self.send_error(WS_ERROR_OP_UNKNOWN)


class WsEventService:
    """Attach the ``/api/ws`` event socket to one FastAPI app and journal."""

    def __init__(
        self,
        app: Any,
        *,
        fastapi_module: Any,
        journal: EventJournal,
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
        session.start()
        ready = session.next_ready()
        open_socket = True
        while open_socket:
            done, _pending = await asyncio.wait({receiving, ready}, return_when=asyncio.FIRST_COMPLETED)
            if receiving in done:
                message = receiving.result()
                if message.get("type") == _MESSAGE_DISCONNECT:
                    open_socket = False
                    continue
                frame = _decode_frame(message)
                if frame is None:
                    open_socket = await session.send_error(WS_ERROR_FRAME_INVALID)
                else:
                    await session.handle(frame)
                receiving = asyncio.ensure_future(session.websocket.receive())
            if ready in done:
                open_socket = open_socket and await session.flush()
                ready = session.next_ready()
        self._cancel((receiving, ready))
        session.close()

    @staticmethod
    def _cancel(tasks: Iterable["asyncio.Future[Any]"]) -> None:
        for task in tasks:
            if not task.done():
                task.cancel()


__all__ = ["WsEventService"]
