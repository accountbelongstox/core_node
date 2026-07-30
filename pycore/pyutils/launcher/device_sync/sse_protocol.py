# -*- coding: utf-8 -*-
"""Shared HTTP SSE protocol for the simple device-sync client and servers."""

import time
import urllib.request
from typing import Any, Callable

from pycore.pyfoundations.http_sse import (
    SSE_REQUEST_HEADERS,
    encode_sse_event,
    is_sse_content_type,
    read_sse_event,
    send_sse_headers,
)
from pycore.pyutils.launcher.device_sync.core.config import DEFAULT_SYNC_INTERVAL
from pycore.pyutils.launcher.device_sync.routes import EVENTS_PATH


SYNC_EVENT_PATH = EVENTS_PATH
SYNC_EVENT_NAME = "sync"
SSE_READ_TIMEOUT_SECONDS = max(30, DEFAULT_SYNC_INTERVAL * 3)
SSE_CONNECTION_ERRORS = (ConnectionError, OSError)


def serve_sync_events(
    handler: Any,
    config: Any,
    keep_running: Callable[[], bool],
) -> None:
    client_ip = handler.client_address[0]
    send_sse_headers(handler)
    try:
        while keep_running():
            now = time.time()
            handler.wfile.write(encode_sse_event(SYNC_EVENT_NAME, {"timestamp": now}))
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
        if not is_sse_content_type(content_type):
            raise ConnectionError(f"Unexpected sync stream content type: {content_type}")
        while keep_running():
            event_name, _data, _event_id = read_sse_event(response)
            if event_name == SYNC_EVENT_NAME:
                on_sync()


__all__ = [
    "SSE_READ_TIMEOUT_SECONDS",
    "SYNC_EVENT_NAME",
    "SYNC_EVENT_PATH",
    "consume_sync_events",
    "serve_sync_events",
]
