# -*- coding: utf-8 -*-

import os
from pathlib import Path

from pycore.pyfoundations.network_constants import (
    HTTP_BIND_HOST,
    QWEN3TTS_DEFAULT_SPEED,
    QWEN3TTS_HTTP_PORT,
    QWEN3TTS_HTTP_TIMEOUT_SECONDS,
    QWEN3TTS_JOB_TEXT_MAX_CHARS,
    QWEN3TTS_SPEED_MAX,
    QWEN3TTS_SPEED_MIN,
)
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.common.http_client import build_http_base_url


ENGINE_NAME = "qwen3tts"
API_SERVER_FILENAME = "qwen3tts_api_server.py"

# The audio pipeline is single-version: every synthesis is sentence-chunked
# and concatenated (multi-sentence audio). pycore never mirrors any version -
# records carry the "tts_chunked" marker stamped from the engine identity,
# and audio that predates the marker is the legacy audio rebuilt by the
# agent-history piggyback lane.
DEFAULT_HOST = HTTP_BIND_HOST
DEFAULT_PORT = QWEN3TTS_HTTP_PORT
INSTALL_HINT = "Step61_InstallQwen3Tts.ps1 / 183_install_qwen3tts.sh"
QUEUE_EVENT_NAME = BusSignals.QWEN_QUEUE_EVENT
# Speed factor bounds accepted from QWEN3TTS_SPEED / request overrides.
_SPEED_MIN = QWEN3TTS_SPEED_MIN
_SPEED_MAX = QWEN3TTS_SPEED_MAX
# Bounded wait budgets (seconds) for the single-active-job service queue: the
# server deliberately 429s concurrent submits ("callers retain and retry"),
# but a pycore caller must give up inside a budget so one busy queue fails
# the task retryable instead of blocking a serial worker lane forever.
_QUEUE_CAPACITY_WAIT_DEFAULT_S = 900.0
_QUEUE_RECOVERY_BUDGET_DEFAULT_S = 300.0


def default_speed() -> float:
    """Playback-speed factor applied to every qwen3tts generation by default.

    Reads QWEN3TTS_SPEED (same env the isolated api server reads; the managed
    launch inherits the environment), falls back to the shared
    QWEN3TTS_DEFAULT_SPEED constant. Values are clamped to sane bounds."""
    raw = (os.environ.get("QWEN3TTS_SPEED") or "").strip()
    try:
        value = float(raw) if raw else QWEN3TTS_DEFAULT_SPEED
    except ValueError:
        value = QWEN3TTS_DEFAULT_SPEED
    return min(_SPEED_MAX, max(_SPEED_MIN, value))


def service_host() -> str:
    return (os.environ.get("QWEN3TTS_HOST") or DEFAULT_HOST).strip() or DEFAULT_HOST


def service_port() -> int:
    raw_port = (os.environ.get("QWEN3TTS_PORT") or "").strip()
    return int(raw_port) if raw_port.isdigit() else DEFAULT_PORT


def service_base_url() -> str:
    return build_http_base_url(service_host(), service_port())


def request_timeout_seconds() -> float:
    value = os.environ.get(
        "QWEN3TTS_HTTP_TIMEOUT_S",
        str(QWEN3TTS_HTTP_TIMEOUT_SECONDS),
    )
    return float(value or QWEN3TTS_HTTP_TIMEOUT_SECONDS)


def queue_capacity_wait_seconds() -> float:
    """Total seconds one submit may wait for the single-job queue to drain."""
    raw = (os.environ.get("QWEN3TTS_QUEUE_CAPACITY_WAIT_S") or "").strip()
    try:
        value = float(raw) if raw else _QUEUE_CAPACITY_WAIT_DEFAULT_S
    except ValueError:
        value = _QUEUE_CAPACITY_WAIT_DEFAULT_S
    return max(10.0, value)


def queue_recovery_budget_seconds() -> float:
    """Total seconds one call may spend recovering from transport failures."""
    raw = (os.environ.get("QWEN3TTS_QUEUE_RECOVERY_BUDGET_S") or "").strip()
    try:
        value = float(raw) if raw else _QUEUE_RECOVERY_BUDGET_DEFAULT_S
    except ValueError:
        value = _QUEUE_RECOVERY_BUDGET_DEFAULT_S
    return max(10.0, value)


def job_text_max_chars() -> int:
    """Maximum characters accepted for one qwen3tts job (shared default)."""
    raw = (os.environ.get("QWEN3TTS_JOB_MAX_CHARS") or "").strip()
    return int(raw) if raw.isdigit() else QWEN3TTS_JOB_TEXT_MAX_CHARS


def api_server_path() -> Path:
    return Path(__file__).resolve().parents[3] / "tts_install_assets" / API_SERVER_FILENAME


__all__ = [
    "API_SERVER_FILENAME",
    "DEFAULT_HOST",
    "DEFAULT_PORT",
    "ENGINE_NAME",
    "INSTALL_HINT",
    "QUEUE_EVENT_NAME",
    "api_server_path",
    "default_speed",
    "job_text_max_chars",
    "queue_capacity_wait_seconds",
    "queue_recovery_budget_seconds",
    "request_timeout_seconds",
    "service_base_url",
    "service_host",
    "service_port",
]
