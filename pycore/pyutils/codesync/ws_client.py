# -*- coding: utf-8 -*-
"""
Outbound WebSocket client (stdlib socket only).

The DEV side dials this OUT to each client's `/code-sync/ws` server and pushes
file changes — because the dev is behind NAT and cannot be reached, while the
clients (public / tailscale) accept connections. So in the file-push channel the
*clients are the servers* and the dev is the connecting party.

Sends MASKED frames (RFC 6455 requires client→server masking); reads UNMASKED
server frames; answers PINGs with PONGs.
"""

import socket

from .ws_proto import (
    client_handshake_request, encode_frame, read_message,
    OP_TEXT, OP_PING, OP_PONG, OP_CLOSE,
)


class WSClient:
    def __init__(self, host: str, port: int, path: str = "/code-sync/ws",
                 timeout: float = 10.0):
        self.host = host
        self.port = port
        self.path = path
        self.timeout = timeout
        self._sock = None
        self._leftover = b""

    def connect(self) -> None:
        s = socket.create_connection((self.host, self.port), timeout=self.timeout)
        s.settimeout(self.timeout)
        req, _key = client_handshake_request(f"{self.host}:{self.port}", self.path)
        s.sendall(req)
        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = s.recv(4096)
            if not chunk:
                raise ConnectionError("no handshake response")
            resp += chunk
        status_line = resp.split(b"\r\n", 1)[0]
        if b" 101 " not in status_line:
            raise ConnectionError(f"ws handshake failed: {status_line[:120]!r}")
        # Any bytes past the header terminator are early frame data — keep them.
        self._leftover = resp.split(b"\r\n\r\n", 1)[1]
        self._sock = s

    def _read(self, n: int) -> bytes:
        if self._leftover:
            take = self._leftover[:n]
            self._leftover = self._leftover[n:]
            return take
        return self._sock.recv(n)

    def send_text(self, text: str) -> None:
        self._sock.sendall(encode_frame(text.encode("utf-8"), OP_TEXT, mask=True))

    def recv_text(self):
        """Return the next text message (str), or None on close."""
        while True:
            op, payload = read_message(self._read)
            if op == OP_PING:
                self._sock.sendall(encode_frame(payload, OP_PONG, mask=True))
                continue
            if op == OP_CLOSE:
                return None
            return payload.decode("utf-8")

    def close(self) -> None:
        try:
            if self._sock is not None:
                self._sock.sendall(encode_frame(b"", OP_CLOSE, mask=True))
                self._sock.close()
        except Exception:
            pass
        finally:
            self._sock = None
