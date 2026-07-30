# -*- coding: utf-8 -*-
"""Shared HTTP SSE protocol for the simple device-sync client and servers."""

import json
import time
import urllib.request
from typing import Any, Callable

from pycore.pyutils.launcher.device_sync.core.config import DEFAULT_SYNC_INTERVAL


SYNC_EVENT_PATH = "/api/events"
SYNC_EVENT_NAME = "sync"
SSE_CONTENT_TYPE = "text/event-stream"
SSE_RESPONSE_HEADERS = (
    ("Content-Type", f"{SSE_CONTENT_TYPE}; charset=utf-8"),
    ("Cache-Control", "no-cache, no-transform"),
    ("Connection", "keep-alive"),
    ("X-Accel-Buffering", "no"),
)
SSE_REQUEST_HEADERS = {
    "Accept": SSE_CONTENT_TYPE,
    "Cache-Control": "no-cache",
}
SSE_READ_TIMEOUT_SECONDS = max(30, DEFAULT_SYNC_INTERVAL * 3)
SSE_CONNECTION_ERRORS = (ConnectionError, OSError)


def encode_sync_event(timestamp: float) -> bytes:
    payload = json.dumps({"timestamp": timestamp}, separators=(",", ":"))
    return f"event: {SYNC_EVENT_NAME}\ndata: {payload}\n\n".encode("utf-8")


def serve_sync_events(
    handler: Any,
    config: Any,
    keep_running: Callable[[], bool],
) -> None:
    client_ip = handler.client_address[0]
    handler.send_response(200)
    for name, value in SSE_RESPONSE_HEADERS:
        handler.send_header(name, value)
    handler.end_headers()
    try:
        while keep_running():
            now = time.time()
            handler.wfile.write(encode_sync_event(now))
            handler.wfile.flush()
            config.upsert_connected_client({"ip": client_ip, "last_seen": now})
            time.sleep(DEFAULT_SYNC_INTERVAL)
    except SSE_CONNECTION_ERRORS:
        return


def consume_sync_events(
    host: str,
    port: int,
    keep_running: Callable[[], bool],
    on_sync: Callable[[], Any],
) -> None:
    url = f"http://{host}:{int(port)}{SYNC_EVENT_PATH}"
    request = urllib.request.Request(
        url,
        headers=SSE_REQUEST_HEADERS,
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=SSE_READ_TIMEOUT_SECONDS) as response:
        content_type = str(response.headers.get("Content-Type") or "")
        if SSE_CONTENT_TYPE not in content_type:
            raise ConnectionError(f"Unexpected sync stream content type: {content_type}")
        event_name = ""
        while keep_running():
            raw_line = response.readline()
            if not raw_line:
                raise ConnectionError("Sync SSE stream closed")
            line = raw_line.decode("utf-8").rstrip("\r\n")
            if not line:
                if event_name == SYNC_EVENT_NAME:
                    on_sync()
                event_name = ""
                continue
            if line.startswith("event:"):
                event_name = line[6:].strip()


__all__ = [
    "SSE_CONTENT_TYPE",
    "SSE_READ_TIMEOUT_SECONDS",
    "SSE_REQUEST_HEADERS",
    "SYNC_EVENT_NAME",
    "SYNC_EVENT_PATH",
    "consume_sync_events",
    "serve_sync_events",
]
