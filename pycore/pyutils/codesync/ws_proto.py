# -*- coding: utf-8 -*-
"""
Minimal RFC 6455 WebSocket protocol (stdlib only).

Just enough for Code Sync's dev→client push channel: a text-frame transport with
the handshake, frame encode/decode (incl. 16/64-bit lengths), client-side masking,
fragmentation reassembly, and ping/pong/close control frames. No third-party
`websockets`/`wsproto` — so the standalone codesync daemon stays pip-free, and the
full-pycore side can reuse the same client to dial out.

Used by:
  * ws_server.py  — server side (accepts; sends UNMASKED frames).
  * ws_client.py  — client side (dials; sends MASKED frames per spec).
"""

import base64
import hashlib
import os
import struct

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

OP_CONT = 0x0
OP_TEXT = 0x1
OP_BIN = 0x2
OP_CLOSE = 0x8
OP_PING = 0x9
OP_PONG = 0xA


def accept_key(client_key: str) -> str:
    return base64.b64encode(
        hashlib.sha1((client_key + WS_GUID).encode("ascii")).digest()
    ).decode("ascii")


def server_handshake_response(client_key: str) -> bytes:
    return (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept_key(client_key)}\r\n\r\n"
    ).encode("ascii")


def client_handshake_request(host: str, path: str):
    """Return (request_bytes, sent_key) for the client side."""
    key = base64.b64encode(os.urandom(16)).decode("ascii")
    req = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    )
    return req.encode("ascii"), key


def encode_frame(payload: bytes, opcode: int = OP_TEXT, mask: bool = False) -> bytes:
    b = bytearray()
    b.append(0x80 | opcode)  # FIN + opcode (we never fragment outbound)
    n = len(payload)
    mbit = 0x80 if mask else 0
    if n < 126:
        b.append(mbit | n)
    elif n < 65536:
        b.append(mbit | 126)
        b += struct.pack(">H", n)
    else:
        b.append(mbit | 127)
        b += struct.pack(">Q", n)
    if mask:
        mk = os.urandom(4)
        b += mk
        b += bytes(payload[i] ^ mk[i % 4] for i in range(n))
    else:
        b += payload
    return bytes(b)


def read_exact(read, n: int) -> bytes:
    """read(n)->bytes (may return <n); loop until n bytes or EOF."""
    buf = b""
    while len(buf) < n:
        chunk = read(n - len(buf))
        if not chunk:
            raise ConnectionError("websocket closed")
        buf += chunk
    return buf


def read_message(read):
    """Read one full application message. Returns (opcode, payload_bytes).
    Reassembles fragments; returns CLOSE/PING control frames to the caller so it
    can reply (PONG) or stop (CLOSE). PONG frames are swallowed."""
    data = b""
    first_opcode = None
    while True:
        h = read_exact(read, 2)
        b0, b1 = h[0], h[1]
        fin = b0 & 0x80
        opcode = b0 & 0x0F
        masked = b1 & 0x80
        ln = b1 & 0x7F
        if ln == 126:
            ln = struct.unpack(">H", read_exact(read, 2))[0]
        elif ln == 127:
            ln = struct.unpack(">Q", read_exact(read, 8))[0]
        mk = read_exact(read, 4) if masked else None
        payload = read_exact(read, ln) if ln else b""
        if mk:
            payload = bytes(payload[i] ^ mk[i % 4] for i in range(ln))
        if opcode == OP_CLOSE:
            return OP_CLOSE, payload
        if opcode == OP_PING:
            return OP_PING, payload
        if opcode == OP_PONG:
            continue
        if first_opcode is None:
            first_opcode = opcode
        data += payload
        if fin:
            return first_opcode, data
