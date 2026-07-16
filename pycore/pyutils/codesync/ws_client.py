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

import sys



class WSClient:
    def __init__(self, host: str, port: int, path: str = "/code-sync/ws",
                 timeout: float = 10.0, io_timeout: float = 120.0):
        self.host = host
        self.port = port
        self.path = path
        self.timeout = timeout          # connect + handshake (short)
        self.io_timeout = io_timeout    # persistent session reads (generous)
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
        # Switch from the short connect timeout to a generous I/O timeout for the
        # persistent push session: a large batch or a busy/slow client must not trip
        # a short read timeout and flap the link. Enable + TUNE TCP keepalive so a
        # SILENTLY dropped link (a NAT/VPN flap that never sends a RST) is detected
        # by the OS in ~60s instead of the recv hanging until io_timeout (120s) — so
        # a flapping peer is retried sooner and progress resumes faster.
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
            self._tune_keepalive(s, idle=30, interval=10, count=3)
        except Exception:
            pass
        s.settimeout(self.io_timeout)
        self._sock = s

    @staticmethod
    def _tune_keepalive(sock, idle: int = 30, interval: int = 10, count: int = 3) -> None:
        """Best-effort, cross-platform TCP keepalive tuning. Detects a dead peer in
        ~idle + interval*count seconds (~60s) rather than the OS default (often 2h).
        No-op where a knob/platform is unavailable (wrapped by the caller's try)."""
        plat = sys.platform
        try:
            if plat.startswith("linux"):
                sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, idle)
                sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, interval)
                sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPCNT, count)
            elif plat == "darwin":
                # macOS: TCP_KEEPALIVE is the idle time in seconds.
                tcp_keepalive = getattr(socket, "TCP_KEEPALIVE", 0x10)
                sock.setsockopt(socket.IPPROTO_TCP, tcp_keepalive, idle)
            elif plat.startswith("win"):
                # Windows: SIO_KEEPALIVE_VALS = (onoff, idle_ms, interval_ms).
                sock.ioctl(socket.SIO_KEEPALIVE_VALS, (1, idle * 1000, interval * 1000))
        except Exception:
            pass

    def _read(self, n: int) -> bytes:
        if self._leftover:
            take = self._leftover[:n]
            self._leftover = self._leftover[n:]
            return take
        return self._sock.recv(n)

    def send_text(self, text: str) -> None:
        self._sock.sendall(encode_frame(text.encode("utf-8"), OP_TEXT, mask=True))

    def ping(self) -> None:
        """Send a WS PING keepalive. Raises on a dead socket so the caller can
        reconnect promptly; the peer replies PONG (swallowed on the next read).
        Keeps NAT/proxy mappings warm during idle so the link does not flap."""
        self._sock.sendall(encode_frame(b"", OP_PING, mask=True))

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
