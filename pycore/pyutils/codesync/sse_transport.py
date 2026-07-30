# -*- coding: utf-8 -*-
"""In-process Code Sync SSE frame broker."""

import time
import uuid
from typing import Any, Dict, Iterable, Optional, Tuple

from pycore.pyutils.codesync.routes import EVENTS_ACK_PATH, EVENTS_PATH
from pycore.pyutils.codesync.runtime import (
    THREAD_BUS,
    init_serialized_owner,
    serialized_method,
)


SSE_STREAM_PATH = EVENTS_PATH
SSE_ACK_PATH = EVENTS_ACK_PATH
SSE_EVENT_NAME = "code-sync.frame"
SSE_KEEP_ALIVE_SECONDS = 15.0
SSE_CLIENT_STALE_SECONDS = 45.0
SSE_ACK_TIMEOUT_SECONDS = 120.0
SSE_TRANSPORT_LABEL = (
    "HTTP SSE downlink + HTTP POST ACK; reconnect runs full manifest comparison"
)


class CodeSyncSseBroker:
    """Queue DEV frames for connected CLIENT SSE subscribers."""

    def __init__(self) -> None:
        self._frames: Dict[str, list] = {}
        self._connected: Dict[str, float] = {}
        self._sessions: Dict[str, int] = {}
        self._aliases: Dict[str, str] = {}
        init_serialized_owner(self, "codesync.sse_broker.state", "CodeSyncSseBrokerState")

    @staticmethod
    def _frame_signal(client_id: str) -> str:
        return f"codesync.sse.frame.{client_id}"

    @staticmethod
    def _ack_signal(frame_id: str) -> str:
        return f"codesync.sse.ack.{frame_id}"

    @serialized_method
    def connect(self, client_id: str, aliases: Iterable[str] = ()) -> int:
        normalized = str(client_id or "").strip()
        if not normalized:
            return 0
        session = self._sessions.get(normalized, 0) + 1
        self._sessions[normalized] = session
        self._connected[normalized] = time.monotonic()
        self._aliases[normalized] = normalized
        for alias in aliases:
            normalized_alias = str(alias or "").strip()
            if normalized_alias:
                self._aliases[normalized_alias] = normalized
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
            self._aliases = {
                alias: target
                for alias, target in self._aliases.items()
                if target != normalized
            }

    @serialized_method
    def resolve_client(self, client_id: str, host: str, port: int) -> str:
        now = time.monotonic()
        normalized_host = str(host or "").strip()
        candidates = (
            str(client_id or "").strip(),
            normalized_host,
            f"{normalized_host}:{int(port or 0)}",
        )
        for candidate in candidates:
            target = self._aliases.get(candidate, candidate)
            last_seen = self._connected.get(target, 0.0)
            if last_seen and now - last_seen <= SSE_CLIENT_STALE_SECONDS:
                return target
        return ""

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

    def acknowledge_payload(
        self,
        payload: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], int]:
        client_id = str((payload or {}).get("client_id") or "").strip()
        frame_id = str((payload or {}).get("frame_id") or "").strip()
        if not client_id or not frame_id:
            return (
                {"success": False, "error": "client_id and frame_id required"},
                400,
            )
        accepted = self.acknowledge(client_id, frame_id, (payload or {}).get("reply"))
        return {"success": accepted}, 200 if accepted else 404


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
    "SSE_EVENT_NAME",
    "SSE_KEEP_ALIVE_SECONDS",
    "SSE_STREAM_PATH",
    "code_sync_sse_broker",
    "code_sync_transport_status",
]
