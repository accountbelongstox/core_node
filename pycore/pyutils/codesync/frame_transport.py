# -*- coding: utf-8 -*-
"""Code Sync frame transport: request/response frames over signed HTTP.

The DEV POSTs each frame to the CLIENT; the CLIENT handles it synchronously
and returns its reply in the same HTTP response.
"""

import json
import uuid
from typing import Optional

import pycore.pyutils.codesync.routes as routes
from pycore.pyutils.codesync.peer_http import peer_url, signed_peer_request


class HttpFrameClient:
    """DEV side: send frames to one CLIENT and read each frame's reply."""

    def __init__(
        self,
        host: str,
        port: int,
        sender_id: str,
        frame_timeout: float = 900.0,
    ) -> None:
        self.host = str(host or "").strip()
        self.port = int(port)
        self.sender_id = str(sender_id or "").strip()
        self.frame_timeout = float(frame_timeout)
        self._session_id = ""
        self._reply: Optional[str] = None

    def connect(self) -> None:
        self._session_id = f"{self.sender_id}:{uuid.uuid4().hex}"
        self._reply = None

    def _ensure_connected(self) -> None:
        if not self._session_id:
            raise ConnectionError("Code Sync frame session is not connected")

    def send_text(self, text: str) -> None:
        self._ensure_connected()
        response = signed_peer_request(
            "POST",
            peer_url(self.host, self.port, routes.EVENTS_FRAME_PATH),
            {
                "session_id": self._session_id,
                "frame_id": uuid.uuid4().hex,
                "sender_id": self.sender_id,
                "frame": str(text or ""),
            },
            timeout=self.frame_timeout,
        )
        if response.status_code != 200:
            raise ConnectionError(f"Code Sync frame rejected: HTTP {response.status_code}")
        payload = response.json()
        self._reply = str(payload.get("reply") or "") if isinstance(payload, dict) else ""

    def recv_text(self) -> Optional[str]:
        self._ensure_connected()
        reply, self._reply = self._reply, None
        if reply is None:
            raise ConnectionError("Code Sync frame has no reply")
        return reply

    def ping(self) -> None:
        self.send_text(json.dumps({"type": "ping"}))
        reply = self.recv_text()
        try:
            reply_type = (json.loads(reply or "") or {}).get("type")
        except ValueError:
            reply_type = ""
        if reply_type != "pong":
            raise ConnectionError("Code Sync heartbeat failed")

    def close(self) -> None:
        self._session_id = ""
        self._reply = None


__all__ = ["HttpFrameClient"]
