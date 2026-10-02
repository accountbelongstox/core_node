# -*- coding: utf-8 -*-
"""TTS view of the shared HTTP client: local TTS server replies and the one
server error decoder."""

import json
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional, Tuple, Union

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.http_client import HttpConnectError, HttpError, HttpResponse, RESPONSE_TTS, http_client

TTS_HTTP_TRANSPORT_ERRORS = (HttpError, OSError)
# A refused or unresolvable peer: every other path of the same server fails too.
TTS_UNREACHABLE = "unreachable"


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


def content_type(response: HttpResponse) -> str:
    return str(response.headers.get("content-type") or "").lower()


def _reply(response: HttpResponse) -> TtsHttpReply:
    ok = response.status_code == 200 and bool(response.content)
    return TtsHttpReply(
        ok,
        response.status_code,
        content_type(response),
        response.content,
        None if ok else http_error_message(response.status_code, response.content),
    )


def tts_post(
    url: str,
    *,
    json_body: Any = None,
    form: Optional[Mapping[str, Any]] = None,
    files: Optional[Mapping[str, Tuple[str, bytes, str]]] = None,
) -> TtsHttpReply:
    """POST JSON or a multipart form to a local TTS server (``tts`` response
    profile: synthesis may run up to the contract response wait); a transport
    failure becomes an error reply."""
    try:
        response = http_client.post(
            url, json=json_body, form=form, files=files, headers={"Accept": "*/*"}, response=RESPONSE_TTS,
        )
    except TTS_HTTP_TRANSPORT_ERRORS as exc:
        ColorPrint.yellow(f"[tts-http] POST {url} failed: {exc}")
        return TtsHttpReply(False, 0, "", b"", str(exc))
    return _reply(response)


def tts_get(url: str, *, timeout: Union[float, Tuple[float, float]]) -> Union[TtsHttpReply, str, None]:
    """GET a local TTS server: the reply, ``TTS_UNREACHABLE`` when the peer
    cannot be reached, None on any other transport failure."""
    try:
        response = http_client.get(url, timeout=timeout)
    except HttpConnectError:
        return TTS_UNREACHABLE
    except TTS_HTTP_TRANSPORT_ERRORS:
        return None
    return TtsHttpReply(
        response.status_code < 500,
        response.status_code,
        content_type(response),
        response.content,
        None,
    )


__all__ = [
    "TTS_HTTP_TRANSPORT_ERRORS",
    "TTS_UNREACHABLE",
    "TtsHttpReply",
    "content_type",
    "http_error_message",
    "tts_get",
    "tts_post",
]
