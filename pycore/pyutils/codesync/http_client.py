# -*- coding: utf-8 -*-
"""Code Sync DEV-side frame adapter over the local SSE broker."""

from typing import Optional

from pycore.pyutils.codesync.sse_transport import code_sync_sse_broker


class HttpFrameClient:
    """Publish protocol frames to one CLIENT's long-lived SSE stream."""

    def __init__(
        self,
        host: str,
        port: int,
        client_id: str,
        timeout: float = 10.0,
        io_timeout: float = 120.0,
    ) -> None:
        self.host = host
        self.port = port
        self.client_id = str(client_id or "").strip()
        self.timeout = timeout
        self.io_timeout = io_timeout
        self._reply: Optional[str] = None
        self._frame_id = ""
        self._session = 0

    def connect(self) -> None:
        if not code_sync_sse_broker.wait_connected(self.client_id, self.timeout):
            raise ConnectionError(
                f"Code Sync SSE client is not connected: {self.host}:{self.port}"
            )
        self._session = code_sync_sse_broker.session(self.client_id)

    def _ensure_session(self) -> None:
        if (
            not code_sync_sse_broker.is_connected(self.client_id)
            or code_sync_sse_broker.session(self.client_id) != self._session
        ):
            raise ConnectionError("Code Sync SSE client reconnected")

    def send_text(self, text: str) -> None:
        self._ensure_session()
        self._frame_id = code_sync_sse_broker.publish(self.client_id, text)
        self._reply = None

    def recv_text(self) -> Optional[str]:
        reply = code_sync_sse_broker.wait_ack(self._frame_id, self.io_timeout)
        self._ensure_session()
        if reply is None:
            raise ConnectionError("Code Sync SSE acknowledgement timed out")
        self._reply = str(reply)
        reply = self._reply
        self._reply = None
        self._frame_id = ""
        return reply

    def ping(self) -> None:
        self._ensure_session()

    def close(self) -> None:
        self._reply = None
        self._frame_id = ""
        self._session = 0


__all__ = ["HttpFrameClient"]
