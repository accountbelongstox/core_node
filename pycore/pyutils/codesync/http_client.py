# -*- coding: utf-8 -*-
"""DEV-side HTTP frame client with a persistent CLIENT SSE reply stream."""

import json
import time
import urllib.parse
import urllib.request
import uuid
from typing import Any, Optional

from pycore.pyfoundations.http_sse import (
    SSE_REQUEST_HEADERS,
    is_sse_content_type,
    read_sse_event,
)
import pycore.pyutils.codesync.routes as routes
from pycore.pyutils.codesync.runtime import http
from pycore.pyutils.codesync.sse_transport import (
    SSE_EVENT_NAME,
)


class HttpFrameClient:
    """Send frames to a CLIENT and receive replies on one SSE connection."""

    def __init__(
        self,
        host: str,
        port: int,
        sender_id: str,
        stream_timeout: float = 30.0,
        frame_timeout: float = 900.0,
    ) -> None:
        self.host = str(host or "").strip()
        self.port = int(port)
        self.sender_id = str(sender_id or "").strip()
        self.stream_timeout = float(stream_timeout)
        self.frame_timeout = float(frame_timeout)
        self._response: Optional[Any] = None
        self._frame_id = ""
        self._session_id = ""

    def _url(self, path: str) -> str:
        return f"http://{self.host}:{self.port}{path}"

    def connect(self) -> None:
        self._session_id = f"{self.sender_id}:{uuid.uuid4().hex}"
        query = urllib.parse.urlencode({
            "session_id": self._session_id,
            "sender_id": self.sender_id,
        })
        request = urllib.request.Request(
            f"{self._url(routes.EVENTS_PATH)}?{query}",
            headers=SSE_REQUEST_HEADERS,
            method="GET",
        )
        self._response = urllib.request.urlopen(request, timeout=self.stream_timeout)
        content_type = str(self._response.headers.get("Content-Type") or "")
        if not is_sse_content_type(content_type):
            self.close()
            raise ConnectionError(f"Unexpected Code Sync content type: {content_type}")

    def _ensure_connected(self) -> None:
        if self._response is None or not self._session_id:
            raise ConnectionError("Code Sync SSE session is not connected")

    def send_text(self, text: str) -> None:
        self._ensure_connected()
        self._frame_id = uuid.uuid4().hex
        response = http.post(
            self._url(routes.EVENTS_FRAME_PATH),
            json={
                "session_id": self._session_id,
                "frame_id": self._frame_id,
                "sender_id": self.sender_id,
                "frame": str(text or ""),
            },
            timeout=self.frame_timeout,
        )
        if response.status_code != 200:
            raise ConnectionError(
                f"Code Sync frame rejected: HTTP {response.status_code}"
            )

    def recv_text(self) -> Optional[str]:
        self._ensure_connected()
        deadline = time.monotonic() + self.stream_timeout
        while time.monotonic() < deadline:
            event_name, data, _event_id = read_sse_event(self._response)
            if event_name != SSE_EVENT_NAME or not data:
                continue
            payload = json.loads(data)
            if str(payload.get("frame_id") or "") != self._frame_id:
                continue
            reply = str(payload.get("reply") or "")
            self._frame_id = ""
            return reply
        raise ConnectionError("Code Sync SSE reply timed out")

    def ping(self) -> None:
        self.send_text(json.dumps({"type": "ping"}))
        reply = self.recv_text()
        try:
            reply_type = (json.loads(reply or "") or {}).get("type")
        except (TypeError, ValueError):
            reply_type = ""
        if reply_type != "pong":
            raise ConnectionError("Code Sync SSE heartbeat failed")

    def close(self) -> None:
        response = self._response
        self._response = None
        self._frame_id = ""
        self._session_id = ""
        if response is not None:
            response.close()


__all__ = ["HttpFrameClient"]
