# -*- coding: utf-8 -*-
"""One HTTP path from pycore to the local TTS servers: the shared HttpClient
instance, multipart encoding and the server error decoder."""

import http.client
import json
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.http_client import HttpClient, HttpResponse

DEFAULT_TTS_HTTP_TIMEOUT_SECONDS = 180.0
TTS_HTTP_TRANSPORT_ERRORS = (OSError, http.client.HTTPException)

tts_http_client = HttpClient(
    default_timeout=DEFAULT_TTS_HTTP_TIMEOUT_SECONDS,
    default_headers={"Accept": "*/*"},
)


@dataclass(frozen=True)
class TtsHttpReply:
    ok: bool
    status: int
    content_type: str
    content: bytes
    error: Optional[str]

    def json_body(self) -> Dict[str, Any]:
        if not self.content:
            return {}
        try:
            parsed = json.loads(self.content.decode("utf-8", "replace"))
        except ValueError:
            return {}
        return parsed if isinstance(parsed, dict) else {}


def http_error_message(status: int, body: bytes) -> str:
    """Server error text: the JSON ``error``/``detail``/``message`` field when
    present, else the raw body; prefixed with the HTTP status when known."""
    detail = body.decode("utf-8", "replace").strip() if body else ""
    if detail.startswith("{"):
        try:
            parsed = json.loads(detail)
        except ValueError:
            parsed = None
        if isinstance(parsed, dict):
            detail = str(
                parsed.get("error") or parsed.get("detail") or parsed.get("message") or detail
            )
    detail = detail[:500] or "request failed"
    return f"HTTP {status}: {detail}" if status else detail


def encode_multipart(
    fields: Mapping[str, Any],
    files: Mapping[str, Tuple[str, bytes, str]],
) -> Tuple[bytes, str]:
    """multipart/form-data body and its Content-Type header value."""
    boundary = f"pycore-{uuid.uuid4().hex}"
    parts = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n".encode("utf-8")
        )
    for name, (filename, data, content_type) in files.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; '
            f'filename="{filename}"\r\nContent-Type: {content_type}\r\n\r\n'.encode("utf-8")
            + data + b"\r\n"
        )
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def _reply(response: HttpResponse) -> TtsHttpReply:
    content_type = ""
    for key, value in response.headers.items():
        if key.lower() == "content-type":
            content_type = value.lower()
    ok = response.status_code == 200 and bool(response.content)
    return TtsHttpReply(
        ok,
        response.status_code,
        content_type,
        response.content,
        None if ok else http_error_message(response.status_code, response.content),
    )


def tts_post(
    url: str,
    *,
    json_body: Any = None,
    form: Optional[Mapping[str, Any]] = None,
    files: Optional[Mapping[str, Tuple[str, bytes, str]]] = None,
    timeout: float = DEFAULT_TTS_HTTP_TIMEOUT_SECONDS,
) -> TtsHttpReply:
    """POST JSON or a form to a local TTS server; transport failures become an
    error reply."""
    try:
        if form is not None or files is not None:
            body, content_type = encode_multipart(form or {}, files or {})
            response = tts_http_client.post(
                url, body=body, timeout=timeout, headers={"Content-Type": content_type},
            )
        else:
            response = tts_http_client.post(url, json=json_body, timeout=timeout)
    except TTS_HTTP_TRANSPORT_ERRORS as exc:
        ColorPrint.yellow(f"[tts-http] POST {url} failed: {exc}")
        return TtsHttpReply(False, 0, "", b"", str(exc))
    return _reply(response)


def tts_get(url: str, *, timeout: float) -> Optional[TtsHttpReply]:
    """GET a local TTS server; None when the server does not answer."""
    try:
        response = tts_http_client.get(url, timeout=timeout)
    except TTS_HTTP_TRANSPORT_ERRORS:
        return None
    return TtsHttpReply(
        response.status_code < 500,
        response.status_code,
        "",
        response.content,
        None,
    )


__all__ = [
    "DEFAULT_TTS_HTTP_TIMEOUT_SECONDS",
    "TTS_HTTP_TRANSPORT_ERRORS",
    "TtsHttpReply",
    "encode_multipart",
    "http_error_message",
    "tts_get",
    "tts_http_client",
    "tts_post",
]
