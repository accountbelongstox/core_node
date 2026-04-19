# Shared framing + path safety for pair-sync (stdlib only).

from __future__ import annotations

import json
import struct
from typing import Any

_JSON_LEN = struct.Struct("!I")


def recv_exact(sock, n: int) -> bytes:
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("peer closed")
        buf += chunk
    return bytes(buf)


def read_json_frame(sock) -> dict[str, Any]:
    raw_len = recv_exact(sock, _JSON_LEN.size)
    (ln,) = _JSON_LEN.unpack(raw_len)
    if ln > 256 * 1024 * 1024:
        raise ValueError("json frame too large")
    data = recv_exact(sock, ln)
    return json.loads(data.decode("utf-8"))


def read_file_payload(sock, size: int) -> bytes:
    if size < 0 or size > 512 * 1024 * 1024:
        raise ValueError("bad file size")
    return recv_exact(sock, size)


def write_json_frame(sock, obj: dict[str, Any]) -> None:
    b = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    sock.sendall(_JSON_LEN.pack(len(b)) + b)


def write_json_then_bytes(sock, obj: dict[str, Any], payload: bytes) -> None:
    write_json_frame(sock, obj)
    if payload:
        sock.sendall(payload)


def safe_rel(rel: str) -> str:
    rel = rel.replace("\\", "/").strip("/")
    parts: list[str] = []
    for p in rel.split("/"):
        if p in ("", "."):
            continue
        if p == "..":
            raise ValueError("path traversal")
        parts.append(p)
    return "/".join(parts)


def to_os_path(root: str, rel_unix: str) -> str:
    import os

    rel = rel_unix.replace("/", os.sep)
    return os.path.normpath(os.path.join(root, rel))


def load_json_config(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def resolve_path_against(base_dir: str, p: str) -> str:
    import os

    p = os.path.expanduser((p or "").strip())
    if not p:
        return ""
    if os.path.isabs(p):
        return os.path.normpath(p)
    return os.path.normpath(os.path.join(base_dir, p))

