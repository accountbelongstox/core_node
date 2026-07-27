#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Server-Sent-Events broadcaster for the FastAPI RPC server.

.. deprecated::
    COMPAT-ONLY — SSE is a legacy compatibility path (L4).
    New features MUST NOT reference this module; use WebSocket RPC v2 instead.
    Durable server events must use the database outbox + WebSocket path.
    This module is retained only for existing SSE clients until they migrate.

Owns the additive SSE fan-out state (monotonic seq + bounded ring buffer +
subscriber queues) that shares the SAME event source as the WebSocket path.
`publish()` is the SSE half extracted from `FastAPIRPCServer.broadcast_event`;
the WS half stays on the server orchestrator. The shared `_broadcast_loop`
singleton lives on the server and is captured in its route wiring (NOT here)
so SSE + WS + sync broadcast scheduling stays coherent.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections import deque
from typing import Any, Deque, Dict, Optional, Set, Tuple

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_fastapi
from pycore.database import StateRepository, SystemEvent
from datetime import datetime, timezone

fastapi = get_third_package_fastapi()
Request = fastapi.Request
StreamingResponse = fastapi.responses.StreamingResponse

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SSEBroadcaster:
    """Owns SSE fan-out state and the GET /rpc/sse endpoint."""

    def __init__(self, debug: bool = False, sse_ring_size: int = 500):
        self.debug = debug
        self._sse_ring_max: int = sse_ring_size
        self._sse_ring: Deque[Tuple[int, str, Dict[str, Any]]] = deque(maxlen=self._sse_ring_max)
        self._sse_subscribers: Set["asyncio.Queue"] = set()
        self._repo = StateRepository()
        
        # Initialize seq from DB
        self._sse_seq: int = self._repo.get_latest_system_event_seq()
        
        # Pre-fill ring buffer from DB
        events = self._repo.get_system_events(since_seq=max(0, self._sse_seq - self._sse_ring_max), limit=self._sse_ring_max)
        for e in events:
            self._sse_ring.append((e.seq, e.topic, e.payload_json or {}))

    def publish(self, event_name: str, data: Dict[str, Any]):
        """
        SSE fan-out half of broadcast_event().

        Assigns a process-wide monotonic seq, appends to the bounded ring buffer
        (for ?since= resume), and pushes the tagged event to every connected SSE
        subscriber queue. Runs on the event loop thread, so plain (non-locked)
        mutation of these structures is safe; SSE generators consume on the same
        loop. Never blocks the WS delivery path.
        """
        # 1. Persist event to DB
        sys_event = SystemEvent(
            seq=0,
            event_id=uuid.uuid4().hex,
            topic=event_name,
            entity_type=data.get("entity_type"),
            entity_id=data.get("entity_id"),
            revision=data.get("revision", 0),
            trace_id=data.get("trace_id"),
            payload_json=data,
            created_at=_now_iso(),
        )
        self._repo.insert_system_event(sys_event)
        
        # 2. Update in-memory state
        seq = sys_event.seq
        self._sse_seq = seq
        self._sse_ring.append((seq, event_name, data))
        
        if self._sse_subscribers:
            sse_item = (seq, event_name, data)
            for queue in list(self._sse_subscribers):
                try:
                    queue.put_nowait(sse_item)
                except asyncio.QueueFull:
                    # Slow/stuck subscriber: drop the live push (it can still recover
                    # via the ring buffer on reconnect with ?since=). Never block WS.
                    pass

    async def handle_sse(
        self,
        request: Request,
        client_id: Optional[str] = None,
        since: Optional[int] = None,
    ) -> StreamingResponse:
        """
        Additive Server-Sent-Events endpoint (GET /rpc/sse).

        Browser clients that only need to RECEIVE pycore broadcast events (the same
        ones pushed to WS clients: pycore_log / voice_subtitle_queue_update /
        system_settings_update / ...) can subscribe here instead of opening a WS.
        The existing /rpc/ws route is unchanged and stays the bidirectional RPC path.

        Frame contract (mirrors the translation SSE stream, cursor renamed to seq):
          - on connect:          event: stream.open   data: {"seq": <currentSeq>}
          - each broadcast:      (default message)    data: {"event": <name>, "_seq": <int>, ...payload}
                                 i.e. NO `event:` line, so the client's onmessage
                                 dispatches ANY broadcast name generically.
          - idle keep-alive:     event: ping          data: {"seq": <seq>}  (~15s)
          - bounded lifetime:    event: stream.close  data: {"seq": <seq>}  (~300s),
                                 then the generator ends (client reconnects ?since=).

        Resume: ?since=<seq> replays buffered ring events with seq > since (oldest
        first). since absent / <= 0 starts from the current tail (only new events).
        """
        # Bounded per-connection inbox. broadcast_event() pushes live events here;
        # maxsize bounds memory - overflow is fine, the client recovers via ?since=.
        queue: "asyncio.Queue" = asyncio.Queue(maxsize=self._sse_ring_max)
        conn_id = client_id or str(uuid.uuid4())

        # Lifetime / cadence (seconds). Unlike the Laravel/Octane translation stream
        # (bounded at ~50s to free a blocking worker), THIS server is async uvicorn -
        # one event loop holds many SSE connections cheaply, so there is no worker to
        # free. A longer bound just paces cursor-resync + caps any leaked connection;
        # 300s cuts the browser's reconnect churn ~6x (and the Windows-Proactor reset
        # callbacks that come with each disconnect). The 15s heartbeat keeps proxies
        # from dropping the idle connection in between.
        max_lifetime = 300.0
        heartbeat_interval = 15.0
        # Wake at most every `tick` to emit a heartbeat / honour disconnects.
        tick = 1.0

        ColorPrint.green(f"[SSE] connected id={conn_id[:8]} since={since}")

        async def event_generator():
            # --- Replay backlog from the ring buffer (seq > since), oldest first. ---
            # since absent / <= 0 -> start from current tail (only new events).
            replay_from = since if isinstance(since, int) and since > 0 else None
            
            # Check if since is too old (not in ring buffer)
            if replay_from is not None and self._sse_ring:
                oldest_seq = self._sse_ring[0][0]
                if replay_from < oldest_seq - 1:
                    # Client is too far behind, send reset_required
                    yield self._sse_format("stream.reset_required", {
                        "oldest_seq": oldest_seq,
                        "current_seq": self._sse_seq,
                    })
                    return

            # Snapshot the ring before subscribing so we don't miss or double-send
            # events that land between replay and subscription.
            backlog = list(self._sse_ring) if replay_from is not None else []

            # Subscribe to live events.
            self._sse_subscribers.add(queue)
            try:
                current_seq = self._sse_seq

                # stream.open confirms the resume point.
                yield self._sse_format("stream.open", {"seq": current_seq})

                # Drain backlog (only events newer than the resume cursor).
                for seq, event_name, data in backlog:
                    if seq > replay_from:
                        frame = self._sse_with_seq(data, seq)
                        frame["event"] = event_name  # generic (default-message) channel frame
                        yield self._sse_format("", frame)
                        current_seq = seq

                start = time.monotonic()
                last_beat = start

                while (time.monotonic() - start) < max_lifetime:
                    # Client gone? stop promptly and free the worker.
                    if await request.is_disconnected():
                        break

                    try:
                        seq, event_name, data = await asyncio.wait_for(queue.get(), timeout=tick)
                    except asyncio.TimeoutError:
                        # Idle: emit a keep-alive ping at the heartbeat cadence.
                        if (time.monotonic() - last_beat) >= heartbeat_interval:
                            yield self._sse_format("ping", {"seq": current_seq})
                            last_beat = time.monotonic()
                        continue

                    # Skip stale ring duplicates already replayed from backlog.
                    if seq <= current_seq:
                        continue
                    frame = self._sse_with_seq(data, seq)
                    frame["event"] = event_name  # generic (default-message) channel frame
                    yield self._sse_format("", frame)
                    current_seq = seq
                    last_beat = time.monotonic()

                # Bounded lifetime reached: tell the client where to resume.
                yield self._sse_format("stream.close", {"seq": current_seq})
            finally:
                self._sse_subscribers.discard(queue)
                ColorPrint.yellow(f"[SSE] disconnected id={conn_id[:8]}")

        headers = {
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers=headers,
        )

    @staticmethod
    def _sse_with_seq(data: Dict[str, Any], seq: int) -> Dict[str, Any]:
        """Return a shallow copy of the WS payload with a top-level _seq resume cursor."""
        if isinstance(data, dict):
            merged = dict(data)
        else:
            # Non-dict payloads are wrapped so _seq always has a place to live.
            merged = {"value": data}
        merged["_seq"] = seq
        return merged

    @staticmethod
    def _sse_format(event_name: str, data: Dict[str, Any]) -> str:
        """Serialize one SSE frame: 'event:' + 'data:' lines, blank line terminates it.

        A NON-EMPTY event_name -> NAMED SSE event (the stream.open/ping/stream.close
        ENVELOPE), consumed on the client via addEventListener('<name>'). An EMPTY
        event_name -> DEFAULT 'message' event (client onmessage), used for CHANNEL
        broadcasts so the client dispatches ANY broadcast name generically (the name
        travels inside data['event']) - mirroring the WS path's generic dispatch and
        staying forward-compatible with new event names without client changes.
        """
        payload = json.dumps(data, ensure_ascii=False)
        if event_name:
            return f"event: {event_name}\ndata: {payload}\n\n"
        return f"data: {payload}\n\n"


__all__ = ["SSEBroadcaster"]
