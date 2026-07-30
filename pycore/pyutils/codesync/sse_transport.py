# -*- coding: utf-8 -*-
"""In-process Code Sync SSE frame broker."""

import json
import time
import uuid
from typing import Any, Dict, Optional

from pycore.pyutils.codesync.runtime import (
    THREAD_BUS,
    init_serialized_owner,
    serialized_method,
)


SSE_STREAM_PATH = "/code-sync/events"
SSE_ACK_PATH = "/code-sync/events/ack"
SSE_EVENT_NAME = "code-sync.frame"
SSE_CONTENT_TYPE = "text/event-stream"
SSE_RESPONSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}
SSE_KEEP_ALIVE_SECONDS = 15.0
SSE_CLIENT_STALE_SECONDS = 45.0
SSE_ACK_TIMEOUT_SECONDS = 120.0
SSE_TRANSPORT_LABEL = (
    "HTTP SSE downlink + HTTP POST ACK; reconnect runs full manifest comparison"
)


def encode_sse_frame(event: str, payload: Dict[str, Any], event_id: str = "") -> bytes:
    lines = []
    if event_id:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str)
    for line in encoded.splitlines() or [""]:
        lines.append(f"data: {line}")
    return ("\n".join(lines) + "\n\n").encode("utf-8")


class CodeSyncSseBroker:
    """Queue DEV frames for connected CLIENT SSE subscribers."""

    def __init__(self) -> None:
        self._frames: Dict[str, list] = {}
        self._connected: Dict[str, float] = {}
        self._sessions: Dict[str, int] = {}
        init_serialized_owner(self, "codesync.sse_broker.state", "CodeSyncSseBrokerState")

    @staticmethod
    def _frame_signal(client_id: str) -> str:
        return f"codesync.sse.frame.{client_id}"

    @staticmethod
    def _ack_signal(frame_id: str) -> str:
        return f"codesync.sse.ack.{frame_id}"

    @serialized_method
    def connect(self, client_id: str) -> int:
        normalized = str(client_id or "").strip()
        if not normalized:
            return 0
        session = self._sessions.get(normalized, 0) + 1
        self._sessions[normalized] = session
        self._connected[normalized] = time.monotonic()
        return session

    @serialized_method
    def touch(self, client_id: str, session: int) -> None:
        normalized = str(client_id or "").strip()
        if self._sessions.get(normalized) == int(session or 0):
            self._connected[normalized] = time.monotonic()

    @serialized_method
    def disconnect(self, client_id: str, session: int) -> None:
        normalized = str(client_id or "").strip()
        if self._sessions.get(normalized) == int(session or 0):
            self._connected.pop(normalized, None)

    @serialized_method
    def is_connected(self, client_id: str) -> bool:
        last_seen = self._connected.get(str(client_id or "").strip(), 0.0)
        return bool(last_seen and time.monotonic() - last_seen <= SSE_CLIENT_STALE_SECONDS)

    @serialized_method
    def session(self, client_id: str) -> int:
        return int(self._sessions.get(str(client_id or "").strip(), 0))

    def wait_connected(self, client_id: str, timeout: float) -> bool:
        deadline = time.monotonic() + max(0.0, float(timeout))
        while time.monotonic() < deadline:
            if self.is_connected(client_id):
                return True
            time.sleep(0.1)
        return self.is_connected(client_id)

    @serialized_method
    def publish(self, client_id: str, text: str) -> str:
        normalized = str(client_id or "").strip()
        frame_id = uuid.uuid4().hex
        frame = {"frame_id": frame_id, "frame": str(text or "")}
        self._frames.setdefault(normalized, []).append(frame)
        THREAD_BUS.signal(self._frame_signal(normalized), frame_id)
        return frame_id

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
        frame = self.next_frame(client_id, after_id)
        if frame is not None:
            return frame
        signal_name = self._frame_signal(str(client_id or "").strip())
        THREAD_BUS.clear_signal(signal_name)
        THREAD_BUS.wait_signal(signal_name, timeout=max(0.0, float(timeout)))
        return self.next_frame(client_id, after_id)

    @serialized_method
    def acknowledge(self, client_id: str, frame_id: str, reply: Any = None) -> bool:
        normalized = str(client_id or "").strip()
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
        if matched:
            THREAD_BUS.signal(self._ack_signal(normalized_frame_id), reply)
        return matched

    def wait_ack(self, frame_id: str, timeout: float = SSE_ACK_TIMEOUT_SECONDS) -> Any:
        signal_name = self._ack_signal(str(frame_id or "").strip())
        reply = THREAD_BUS.wait_signal(signal_name, timeout=max(0.0, float(timeout)))
        THREAD_BUS.clear_signal(signal_name)
        return reply


code_sync_sse_broker = CodeSyncSseBroker()


def code_sync_transport_status() -> Dict[str, str]:
    return {
        "name": "http_sse",
        "label": SSE_TRANSPORT_LABEL,
        "downlink": SSE_STREAM_PATH,
        "ack": SSE_ACK_PATH,
        "event": SSE_EVENT_NAME,
        "reconnect": "full_manifest_compare",
    }


__all__ = [
    "SSE_ACK_PATH",
    "SSE_CONTENT_TYPE",
    "SSE_EVENT_NAME",
    "SSE_KEEP_ALIVE_SECONDS",
    "SSE_RESPONSE_HEADERS",
    "SSE_STREAM_PATH",
    "code_sync_sse_broker",
    "code_sync_transport_status",
    "encode_sse_frame",
]
