# -*- coding: utf-8 -*-

import os
from pathlib import Path

from pycore.pyfoundations.network_constants import (
    HTTP_BIND_HOST,
    QWEN3TTS_HTTP_PORT,
    QWEN3TTS_HTTP_TIMEOUT_SECONDS,
)
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.common.http_client import build_http_base_url


ENGINE_NAME = "qwen3tts"
API_SERVER_FILENAME = "qwen3tts_api_server.py"
DEFAULT_HOST = HTTP_BIND_HOST
DEFAULT_PORT = QWEN3TTS_HTTP_PORT
INSTALL_HINT = "Step61_InstallQwen3Tts.ps1 / 140_install_qwen3tts.sh"
QUEUE_EVENT_NAME = BusSignals.QWEN_QUEUE_EVENT


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
    "request_timeout_seconds",
    "service_base_url",
    "service_host",
    "service_port",
]
