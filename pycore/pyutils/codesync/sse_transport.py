# -*- coding: utf-8 -*-
"""Shared Code Sync HTTP/SSE transport state and stream lifecycle."""

import time
from typing import Any, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.http_sse import SSE_KEEP_ALIVE, encode_sse_event
from pycore.pyfoundations.network_constants import SSE_KEEP_ALIVE_SECONDS
import pycore.pyutils.codesync.routes as routes
from pycore.pyutils.codesync.runtime import (
    THREAD_BUS,
    init_serialized_owner,
    serialized_method,
)


SSE_EVENT_NAME = "code-sync.ack"
SSE_CLIENT_STALE_SECONDS = 45.0
SSE_TRANSPORT_LABEL = (
    "DEV HTTP POST frames + persistent CLIENT SSE acknowledgements; "
    "reconnect runs full manifest comparison"
)


class CodeSyncSseBroker:
    """Queue CLIENT replies for DEV-owned SSE sessions."""

    def __init__(self) -> None:
        self._frames: Dict[str, list] = {}
        self._connected: Dict[str, float] = {}
        self._sessions: Dict[str, int] = {}
        init_serialized_owner(self, "codesync.sse_broker.state", "CodeSyncSseBrokerState")

    @staticmethod
    def _frame_signal(client_id: str) -> str:
        return f"codesync.sse.frame.{client_id}"

    @serialized_method
    def connect(self, session_id: str) -> int:
        normalized = str(session_id or "").strip()
        if not normalized:
            return 0
        session = self._sessions.get(normalized, 0) + 1
        self._sessions[normalized] = session
        self._connected[normalized] = time.monotonic()
        return session

    @serialized_method
    def touch(self, session_id: str, session: int) -> None:
        normalized = str(session_id or "").strip()
        if self._sessions.get(normalized) == int(session or 0):
            self._connected[normalized] = time.monotonic()

    @serialized_method
    def disconnect(self, session_id: str, session: int) -> None:
        normalized = str(session_id or "").strip()
        if self._sessions.get(normalized) == int(session or 0):
            self._connected.pop(normalized, None)
            self._frames.pop(normalized, None)

    @serialized_method
    def is_connected(self, session_id: str) -> bool:
        last_seen = self._connected.get(str(session_id or "").strip(), 0.0)
        return bool(last_seen and time.monotonic() - last_seen <= SSE_CLIENT_STALE_SECONDS)

    @serialized_method
    def publish_reply(self, session_id: str, frame_id: str, reply: str) -> None:
        normalized = str(session_id or "").strip()
        frame = {"frame_id": str(frame_id or "").strip(), "reply": str(reply or "")}
        self._frames.setdefault(normalized, []).append(frame)
        THREAD_BUS.signal(self._frame_signal(normalized), frame_id)

    @serialized_method
    def next_frame(self, client_id: str, after_id: str = "") -> Optional[Dict[str, str]]:
        normalized = str(client_id or "").strip()
        frames = self._frames.get(normalized, [])
        if not frames:
            return None
        if not after_id:
            return dict(frames[0])
        found = False
        for frame in frames:
            if found:
                return dict(frame)
            if frame.get("frame_id") == after_id:
                found = True
        return dict(frames[0]) if not found else None

    def wait_next_frame(
        self,
        client_id: str,
        after_id: str = "",
        timeout: float = SSE_KEEP_ALIVE_SECONDS,
    ) -> Optional[Dict[str, str]]:
        signal_name = self._frame_signal(str(client_id or "").strip())
        THREAD_BUS.clear_signal(signal_name)
        frame = self.next_frame(client_id, after_id)
        if frame is not None:
            return frame
        THREAD_BUS.wait_signal(signal_name, timeout=max(0.0, float(timeout)))
        return self.next_frame(client_id, after_id)

    @serialized_method
    def consume_reply(self, session_id: str, frame_id: str) -> bool:
        normalized = str(session_id or "").strip()
        normalized_frame_id = str(frame_id or "").strip()
        frames = self._frames.get(normalized, [])
        matched = False
        remaining = []
        for frame in frames:
            if frame.get("frame_id") == normalized_frame_id:
                matched = True
                continue
            remaining.append(frame)
        self._frames[normalized] = remaining
        return matched

    @serialized_method
    def connected_sessions(self) -> int:
        now = time.monotonic()
        return sum(
            1
            for last_seen in self._connected.values()
            if now - last_seen <= SSE_CLIENT_STALE_SECONDS
        )

    def handle_frame_payload(
        self,
        payload: Dict[str, Any],
        handle_text: Callable[[str, Callable[[str], None]], bool],
    ) -> Tuple[Dict[str, Any], int]:
        session_id = str((payload or {}).get("session_id") or "").strip()
        frame_id = str((payload or {}).get("frame_id") or "").strip()
        frame = str((payload or {}).get("frame") or "")
        if not session_id or not frame_id or not frame:
            return (
                {
                    "success": False,
                    "error": "session_id, frame_id and frame required",
                },
                400,
            )
        if not self.is_connected(session_id):
            return {"success": False, "error": "SSE session is not connected"}, 409
        replies = []
        accepted = handle_text(frame, replies.append)
        self.publish_reply(session_id, frame_id, replies[0] if replies else "")
        return {"success": bool(accepted)}, 200 if accepted else 422


code_sync_sse_broker = CodeSyncSseBroker()


def iter_code_sync_reply_stream(session_id: str, should_stop=None):
    """Yield one shared SSE reply stream for standalone and FastAPI servers."""
    normalized = str(session_id or "").strip()
    cursor = ""
    session = code_sync_sse_broker.connect(normalized)
    try:
        yield SSE_KEEP_ALIVE
        while should_stop is None or not should_stop():
            code_sync_sse_broker.touch(normalized, session)
            frame = code_sync_sse_broker.wait_next_frame(
                normalized,
                cursor,
                SSE_KEEP_ALIVE_SECONDS,
            )
            if frame is None:
                yield SSE_KEEP_ALIVE
                continue
            cursor = str(frame.get("frame_id") or "")
            yield encode_sse_event(SSE_EVENT_NAME, frame, cursor)
            code_sync_sse_broker.consume_reply(normalized, cursor)
    finally:
        code_sync_sse_broker.disconnect(normalized, session)


def code_sync_transport_status() -> Dict[str, str]:
    return {
        "name": "http_sse",
        "label": SSE_TRANSPORT_LABEL,
        "ack_stream": routes.EVENTS_PATH,
        "frame": routes.EVENTS_FRAME_PATH,
        "event": SSE_EVENT_NAME,
        "reconnect": "full_manifest_compare",
    }


__all__ = [
    "SSE_EVENT_NAME",
    "SSE_KEEP_ALIVE_SECONDS",
    "code_sync_sse_broker",
    "code_sync_transport_status",
    "iter_code_sync_reply_stream",
]
