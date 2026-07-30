# -*- coding: utf-8 -*-
"""Shared stdlib HTTP Server-Sent Events protocol primitives."""

import json
from typing import Any, Optional, Tuple


SSE_CONTENT_TYPE = "text/event-stream"
HTTP_EVENTS_PATH = "/api/events"
SSE_RESPONSE_HEADERS = (
    ("Cache-Control", "no-cache, no-transform"),
    ("Connection", "keep-alive"),
    ("X-Accel-Buffering", "no"),
)
SSE_REQUEST_HEADERS = {
    "Accept": SSE_CONTENT_TYPE,
    "Cache-Control": "no-cache",
}
SSE_KEEP_ALIVE = b": keep-alive\n\n"


class SseEventDecoder:
    """Incrementally decode SSE field lines into complete events."""

    def __init__(self) -> None:
        self._event = ""
        self._event_id = ""
        self._data = []

    def feed_line(self, raw_line: Any) -> Optional[Tuple[str, str, str]]:
        if raw_line is None:
            return None
        if isinstance(raw_line, (bytes, bytearray)):
            line = raw_line.decode("utf-8", "ignore").rstrip("\r\n")
        else:
            line = str(raw_line).rstrip("\r\n")
        if not line:
            if not self._event and not self._event_id and not self._data:
                return None
            event = self._event
            event_id = self._event_id
            data = "\n".join(self._data)
            self._event = ""
            self._event_id = ""
            self._data = []
            return event, data, event_id
        if line.startswith(":"):
            return None
        field, separator, value = line.partition(":")
        if not separator:
            value = ""
        elif value.startswith(" "):
            value = value[1:]
        if field == "event":
            self._event = value
        elif field == "data":
            self._data.append(value)
        elif field == "id":
            self._event_id = value
        return None


def read_sse_event(stream: Any) -> Tuple[str, str, str]:
    decoder = SseEventDecoder()
    while True:
        raw_line = stream.readline()
        if not raw_line:
            raise ConnectionError("SSE stream closed")
        event = decoder.feed_line(raw_line)
        if event is not None:
            return event


def encode_sse_event(
    event: str,
    data: Any,
    event_id: Optional[Any] = None,
) -> bytes:
    lines = []
    if event_id is not None and str(event_id):
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    encoded = json.dumps(
        data,
        ensure_ascii=False,
        separators=(",", ":"),
        default=str,
    )
    for line in encoded.splitlines() or [""]:
        lines.append(f"data: {line}")
    return ("\n".join(lines) + "\n\n").encode("utf-8")


def send_sse_headers(handler: Any) -> None:
    handler.send_response(200)
    handler.send_header("Content-Type", f"{SSE_CONTENT_TYPE}; charset=utf-8")
    for name, value in SSE_RESPONSE_HEADERS:
        handler.send_header(name, value)
    handler.end_headers()


def is_sse_content_type(value: Any) -> bool:
    return SSE_CONTENT_TYPE in str(value or "").lower()


__all__ = [
    "HTTP_EVENTS_PATH",
    "SSE_CONTENT_TYPE",
    "SSE_KEEP_ALIVE",
    "SSE_REQUEST_HEADERS",
    "SSE_RESPONSE_HEADERS",
    "SseEventDecoder",
    "encode_sse_event",
    "is_sse_content_type",
    "read_sse_event",
    "send_sse_headers",
]
