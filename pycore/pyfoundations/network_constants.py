# -*- coding: utf-8 -*-
"""Canonical Pycore HTTP and Server-Sent Events constants."""

from pycore.pyfoundations.service_contract import host, port

HTTP_BIND_HOST = host("any")
HTTP_LOOPBACK_HOST = host("loopback")
HTTP_DEFAULT_TIMEOUT_SECONDS = 10.0
EXTERNAL_API_HTTP_TIMEOUT = (8, 25)
HTTP_JSON_CONTENT_TYPE = "application/json"
HTTP_OCTET_STREAM_CONTENT_TYPE = "application/octet-stream"
STATIC_ASSET_CONTENT_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}
HTTP_PROTOCOL_VERSION = "2.0"
HTTP_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
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

PYCORE_HTTP_PORT = port("pycore_backend")
QWEN3TTS_HTTP_PORT = 57210
QWEN3TTS_HTTP_TIMEOUT_SECONDS = 900.0
# Maximum characters accepted for ONE qwen3tts job (queued or direct). Single
# source shared by pycore (qwen.config.job_text_max_chars) and the isolated
# api server (loaded from source); overridable via the QWEN3TTS_JOB_MAX_CHARS
# env. One job owns the whole GPU queue, so an unbounded text squats the
# service for days.
QWEN3TTS_JOB_TEXT_MAX_CHARS = 100000
# Default playback-speed factor for every Qwen3-TTS generation (1.0 = natural).
# Single source shared by pycore (qwen.config.default_speed) and the isolated
# api server (loaded from source); overridable via the QWEN3TTS_SPEED env.
QWEN3TTS_DEFAULT_SPEED = 0.75
# Playback-speed bounds accepted from QWEN3TTS_SPEED / request overrides.
# Single source shared by pycore (qwen.config) and the isolated api server.
QWEN3TTS_SPEED_MIN = 0.25
QWEN3TTS_SPEED_MAX = 3.0
# qwen3tts VRAM launch policy (MiB). qwen3tts is the ONLY engine that uses the
# GPU by design, so when free VRAM is below the recommended floor the launcher
# and the startup profile forcibly stop OTHER GPU-holding processes
# (memory_gate.reclaim_vram); after reclaim, a GPU with at least the minimum
# free VRAM takes the model, below it the server starts on CPU. Single source
# shared by pycore (memory_gate, tts_service_manager) and the isolated api
# server (loaded from source). Env overrides: QWEN3TTS_MIN_FREE_VRAM_MB /
# QWEN3TTS_RECOMMENDED_FREE_VRAM_MB / QWEN3TTS_VRAM_RECLAIM=0.
QWEN3TTS_MIN_FREE_VRAM_MB = 800
QWEN3TTS_RECOMMENDED_FREE_VRAM_MB = 6144
QWEN3TTS_MIN_FREE_VRAM_MB_ENV = "QWEN3TTS_MIN_FREE_VRAM_MB"
QWEN3TTS_RECOMMENDED_FREE_VRAM_MB_ENV = "QWEN3TTS_RECOMMENDED_FREE_VRAM_MB"
QWEN3TTS_VRAM_RECLAIM_ENV = "QWEN3TTS_VRAM_RECLAIM"
QWEN3TTS_CHUNK_MAX_CHARS = 280
QWEN3TTS_CHUNK_PAUSE_MS = 150

# ChatTTS class-C HTTP server (staging copy under the main interpreter).
CHATTTS_HTTP_PORT = 8000
# Free-VRAM floor (MiB) for auto->cuda (ChatTTS official FAQ: at least 4 GB of
# GPU memory for a 30-second clip). Single source shared by pycore
# (tts_service_manager) and the staging api server (loaded from source via
# PYCORE_PROJECT_ROOT). Env override: CHATTTS_MIN_FREE_VRAM_MB.
CHATTTS_MIN_FREE_VRAM_MB = 4096

# MeloTTS class-C HTTP server (isolated per-engine venv; managed lifecycle).
MELOTTS_HTTP_PORT = 57212
MELOTTS_HTTP_TIMEOUT_SECONDS = 300.0

# VoxCPM2 class-C HTTP server (isolated Python 3.10 venv; managed lifecycle).
VOXCPM2_HTTP_PORT = 57214
VOXCPM2_HTTP_TIMEOUT_SECONDS = 900.0

# CosyVoice HTTP server (cloned repo / isolated venv).
COSYVOICE_HTTP_PORT = 50000

# F5-TTS HTTP server (staging copy under main interpreter).
F5TTS_HTTP_PORT = 7860

# Fish Speech HTTP bridge (isolated venv).
FISHSPEECH_HTTP_PORT = 8080

# GPT-SoVITS HTTP server (cloned repo / isolated venv).
GPTSOVITS_HTTP_PORT = 9880

# Shared TTS timeouts and probing budgets
TTS_AVAILABILITY_TTL_SECONDS = 30.0
TTS_REQUEST_TIMEOUT_SECONDS = 300.0
TTS_HEALTH_TIMEOUT_SECONDS = 3.0

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
# Events published before the first SSE server binds (process startup logs)
# are buffered here and flushed into the journal on the first bind, so the
# full startup output is replayable instead of silently dropped.
HTTP_EVENT_PRE_BIND_BUFFER_MAX = 2000
SSE_EVENT_MAX_WAIT_SECONDS = 30.0


__all__ = [
    "CHATTTS_HTTP_PORT",
    "CHATTTS_MIN_FREE_VRAM_MB",
    "COSYVOICE_HTTP_PORT",
    "EXTERNAL_API_HTTP_TIMEOUT",
    "F5TTS_HTTP_PORT",
    "FISHSPEECH_HTTP_PORT",
    "GPTSOVITS_HTTP_PORT",
    "HTTP_API_PREFIX",
    "HTTP_BIND_HOST",
    "HTTP_CLIENT_ID_PATH",
    "HTTP_DEFAULT_TIMEOUT_SECONDS",
    "HTTP_EVENT_PRE_BIND_BUFFER_MAX",
    "HTTP_EXPECTED_DISCONNECT_ERRNOS",
    "HTTP_EXPECTED_DISCONNECT_MESSAGES",
    "HTTP_EXPECTED_DISCONNECT_WINERRORS",
    "HTTP_EVENTS_PATH",
    "HTTP_INFO_PATH",
    "HTTP_JSON_CONTENT_TYPE",
    "HTTP_LOOPBACK_HOST",
    "HTTP_OCTET_STREAM_CONTENT_TYPE",
    "HTTP_PROTOCOL_VERSION",
    "HTTP_ROUTES_PATH",
    "HTTP_STATUS_PATH",
    "HTTP_USER_AGENT",
    "MELOTTS_HTTP_PORT",
    "MELOTTS_HTTP_TIMEOUT_SECONDS",
    "PYCORE_HTTP_PORT",
    "QWEN3TTS_CHUNK_MAX_CHARS",
    "QWEN3TTS_CHUNK_PAUSE_MS",
    "QWEN3TTS_DEFAULT_SPEED",
    "QWEN3TTS_HTTP_PORT",
    "QWEN3TTS_HTTP_TIMEOUT_SECONDS",
    "QWEN3TTS_JOB_TEXT_MAX_CHARS",
    "QWEN3TTS_MIN_FREE_VRAM_MB",
    "QWEN3TTS_MIN_FREE_VRAM_MB_ENV",
    "QWEN3TTS_RECOMMENDED_FREE_VRAM_MB",
    "QWEN3TTS_RECOMMENDED_FREE_VRAM_MB_ENV",
    "QWEN3TTS_SPEED_MAX",
    "QWEN3TTS_SPEED_MIN",
    "QWEN3TTS_VRAM_RECLAIM_ENV",
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
    "STATIC_ASSET_CONTENT_TYPES",
    "TTS_AVAILABILITY_TTL_SECONDS",
    "TTS_HEALTH_TIMEOUT_SECONDS",
    "TTS_REQUEST_TIMEOUT_SECONDS",
    "VOXCPM2_HTTP_PORT",
    "VOXCPM2_HTTP_TIMEOUT_SECONDS",
]

