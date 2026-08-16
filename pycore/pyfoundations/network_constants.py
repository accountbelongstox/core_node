# -*- coding: utf-8 -*-
"""Canonical Pycore HTTP and Server-Sent Events constants."""

HTTP_BIND_HOST = "0.0.0.0"
HTTP_LOOPBACK_HOST = "127.0.0.1"
HTTP_DEFAULT_TIMEOUT_SECONDS = 10.0
HTTP_JSON_CONTENT_TYPE = "application/json"
HTTP_PROTOCOL_VERSION = "2.0"
HTTP_API_PREFIX = "/api"
HTTP_CLIENT_ID_PATH = f"{HTTP_API_PREFIX}/client-id"
HTTP_STATUS_PATH = f"{HTTP_API_PREFIX}/status"
HTTP_INFO_PATH = f"{HTTP_API_PREFIX}/info"
HTTP_ROUTES_PATH = f"{HTTP_API_PREFIX}/routes"
HTTP_EVENTS_PATH = f"{HTTP_API_PREFIX}/events"
HTTP_EXPECTED_DISCONNECT_ERRNOS = frozenset({32, 54, 104})
HTTP_EXPECTED_DISCONNECT_MESSAGES = frozenset(
    {
        "Fatal write error on socket transport",
        "socket.send() raised exception.",
    }
)
HTTP_EXPECTED_DISCONNECT_WINERRORS = frozenset({64, 10038, 10053, 10054})

PYCORE_HTTP_PORT = 59000
QWEN3TTS_HTTP_PORT = 57210
QWEN3TTS_HTTP_TIMEOUT_SECONDS = 900.0
# Default playback-speed factor for every Qwen3-TTS generation (1.0 = natural).
# Single source shared by pycore (qwen.config.default_speed) and the isolated
# api server (loaded from source); overridable via the QWEN3TTS_SPEED env.
QWEN3TTS_DEFAULT_SPEED = 0.75

SSE_CONTENT_TYPE = "text/event-stream"
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
SSE_KEEP_ALIVE_SECONDS = 15.0
SSE_STATE_EVENT_NAME = "sse.state"
SSE_RECORD_EVENT_NAME = "sse.event"
SSE_EVENT_JOURNAL_MAX = 5000
SSE_EVENT_MAX_AGE_SECONDS = 3600.0
SSE_EVENT_WAIT_SECONDS = 20.0
SSE_EVENT_MAX_WAIT_SECONDS = 30.0


__all__ = [
    "HTTP_API_PREFIX",
    "HTTP_BIND_HOST",
    "HTTP_CLIENT_ID_PATH",
    "HTTP_DEFAULT_TIMEOUT_SECONDS",
    "HTTP_EXPECTED_DISCONNECT_ERRNOS",
    "HTTP_EXPECTED_DISCONNECT_MESSAGES",
    "HTTP_EXPECTED_DISCONNECT_WINERRORS",
    "HTTP_EVENTS_PATH",
    "HTTP_INFO_PATH",
    "HTTP_JSON_CONTENT_TYPE",
    "HTTP_LOOPBACK_HOST",
    "HTTP_PROTOCOL_VERSION",
    "HTTP_ROUTES_PATH",
    "HTTP_STATUS_PATH",
    "PYCORE_HTTP_PORT",
    "QWEN3TTS_DEFAULT_SPEED",
    "QWEN3TTS_HTTP_PORT",
    "QWEN3TTS_HTTP_TIMEOUT_SECONDS",
    "SSE_CONTENT_TYPE",
    "SSE_EVENT_JOURNAL_MAX",
    "SSE_EVENT_MAX_AGE_SECONDS",
    "SSE_EVENT_MAX_WAIT_SECONDS",
    "SSE_EVENT_WAIT_SECONDS",
    "SSE_KEEP_ALIVE",
    "SSE_KEEP_ALIVE_SECONDS",
    "SSE_RECORD_EVENT_NAME",
    "SSE_REQUEST_HEADERS",
    "SSE_RESPONSE_HEADERS",
    "SSE_STATE_EVENT_NAME",
]
