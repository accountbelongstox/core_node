# -*- coding: utf-8 -*-
"""
Qwen3-TTS engine - HTTP client to the isolated-venv API server (class C).

qwen-tts owns transformer dependencies that may not coexist with the main
interpreter's pin (parler/bark -> 4.46.x). Therefore qwen-tts is NEVER imported
in this (main) interpreter. Instead it runs as
pycore/tts_install_assets/qwen3tts_api_server.py inside a DEDICATED venv; that
server is launched + lifecycle-managed as a class-C
service by tts_service_manager.py / managed_service.py. This module talks to it over
HTTP GET/POST for synthesis, queue control, and status probes.

See development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5.

Config:
  QWEN3TTS_HOST / QWEN3TTS_PORT - server bind + client target (default 0.0.0.0:57210)
  QWEN3TTS_MODEL                - HF id or local path (resolved in the server env)
  QWEN3TTS_DEVICE               - cpu | cuda:0 | auto (applied in the server env)
  QWEN3TTS_SPEAKER              - preset speaker override (per-call speaker wins)
  QWEN3TTS_INSTRUCT             - optional style/emotion instruction
  QWEN3TTS_QUEUE_MAX            - maximum active queued/running jobs
  QWEN3TTS_QUEUE_RESULT_TTL_S   - completed audio retention in seconds
  QWEN3TTS_TASK_TIMEOUT_S       - queued batch timeout in seconds
"""

import base64
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyutils.common.python_env.isolated_venv import venv_ready as isolated_venv_ready
from pycore.pyutils.tts.qwen.client import (
    base_url,
    get_json as http_get_json,
    queue_submit_and_wait,
    synthesize_batch as http_synthesize_batch,
)
from pycore.pyutils.tts.qwen.config import (
    ENGINE_NAME,
    INSTALL_HINT,
    request_timeout_seconds,
)

_HEALTH_TIMEOUT_S = 3.0
_REQUEST_TIMEOUT_S = request_timeout_seconds()

_LAST_SYNTH_ERROR = SerializedValue(None, "Qwen3TTSErrorState")


def available() -> bool:
    """The engine is usable when the isolated venv is provisioned (the managed
    service starts/loads the server on demand)."""
    return isolated_venv_ready(ENGINE_NAME)


def disabled_reason() -> Optional[str]:
    if isolated_venv_ready(ENGINE_NAME):
        return None
    return (
        f"Qwen3-TTS isolated venv not built - run {INSTALL_HINT}"
    )


def last_synth_error() -> Optional[str]:
    return _LAST_SYNTH_ERROR.get()


def health() -> Optional[Dict[str, Any]]:
    ok, info, _error = http_get_json("/health", timeout=_HEALTH_TIMEOUT_S)
    return info if ok and isinstance(info, dict) else None


def is_model_loaded() -> bool:
    """Best-effort: GET /health -> model_loaded. Swallows all errors (server down /
    not started yet) -> False."""
    info = health()
    return bool(info and info.get("model_loaded"))


def load_model(timeout: float = 1200.0) -> Optional[Dict[str, Any]]:
    ok, info, _error = http_get_json("/load", timeout=timeout)
    return info if ok and isinstance(info, dict) else None


def get_capabilities() -> Optional[Dict[str, Any]]:
    """GET /capabilities -> {languages, speakers, default_speakers}"""
    ok, info, _error = http_get_json("/capabilities", timeout=_HEALTH_TIMEOUT_S)
    return info if ok and isinstance(info, dict) and info.get("ok") else None


def get_status() -> Optional[Dict[str, Any]]:
    """GET /status without starting or loading the managed service."""
    ok, info, _error = http_get_json("/status", timeout=_HEALTH_TIMEOUT_S)
    return info if ok and isinstance(info, dict) and info.get("ok") else None


def get_queue_status() -> Optional[Dict[str, Any]]:
    """GET the authoritative in-memory queue snapshot when the server is online."""
    ok, info, _error = http_get_json("/queue/status", timeout=_HEALTH_TIMEOUT_S)
    return info if ok and isinstance(info, dict) and info.get("ok") else None


def model_loaded() -> bool:
    return is_model_loaded()


def unload_model() -> None:
    """No-op: the server process lifecycle (start/stop/idle-unload) is owned by
    managed_service, which terminates the subprocess. Kept for API symmetry."""
    return None


def _fmt_for(path: Path) -> str:
    return "wav" if path.suffix.lower() == ".wav" else "mp3"


# --------------------------------------------------------------------------- #
# Synthesis                                                                     #
# --------------------------------------------------------------------------- #
def synthesize(
    text: str,
    lang: str,
    output_mp3: Path,
    speed: float = 1.0,
    speaker: Optional[str] = None,
    instruct: Optional[str] = None,
    client_job_id: Optional[str] = None,
) -> bool:
    """Queue one normal Pycore synthesis and write its retained audio result.

    The standalone Qwen console keeps ``POST /synthesize`` as its explicit
    interactive fast path. Pycore work uses the queue so GPU concurrency,
    cancellation, status, and HTTP event reporting share one lifecycle.
    """
    del speed
    return synthesize_queued(
        text,
        lang,
        output_mp3,
        client_job_id=client_job_id,
        timeout=_REQUEST_TIMEOUT_S,
        speaker=speaker,
        instruct=(instruct or os.environ.get("QWEN3TTS_INSTRUCT") or ""),
    )


def synthesize_queued(
    text: str,
    lang: str,
    output_path: Path,
    client_job_id: Optional[str] = None,
    timeout: float = _REQUEST_TIMEOUT_S,
    priority: int = 0,
    speaker: Optional[str] = None,
    instruct: Optional[str] = None,
) -> bool:
    """Submit through the service queue, wait by HTTP long poll, and write audio."""

    _LAST_SYNTH_ERROR.set(None)
    cleaned = (text or "").strip()
    if not cleaned:
        _LAST_SYNTH_ERROR.set("empty text")
        return False
    output = Path(output_path)
    stable_id = str(client_job_id or "").strip() or uuid.uuid4().hex
    payload: Dict[str, Any] = {
        "text": cleaned,
        "language": lang or "en",
        "format": _fmt_for(output),
        "priority": int(priority),
    }
    if (speaker or "").strip():
        payload["speaker"] = speaker
    if (instruct or "").strip():
        payload["instruct"] = instruct
    ok, audio, error = queue_submit_and_wait(payload, stable_id, timeout)
    if not ok or not audio:
        _LAST_SYNTH_ERROR.set(error or "qwen3tts queued synthesis failed")
        return False
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(audio)
        return True
    except OSError as exc:
        _LAST_SYNTH_ERROR.set(f"write failed: {exc}")
        return False


def synthesize_variants(
    text: str,
    lang: str,
    variants: List[Dict[str, Any]],
    out_paths: List[Path],
) -> List[bool]:
    """POST /synthesize_batch (one server call generating N voice variants at the
    GPU's max parallel speed), base64-decode each result, write files in order.
    Returns one bool per variant (index-aligned with ``variants`` / ``out_paths``)."""
    _LAST_SYNTH_ERROR.set(None)
    cleaned = (text or "").strip()
    n = min(len(variants), len(out_paths))
    results = [False] * max(n, 0)
    if not cleaned or n == 0:
        _LAST_SYNTH_ERROR.set("empty text" if not cleaned else "no variants")
        return results
    # The server applies ONE format to the whole batch; take it from the first path.
    fmt = _fmt_for(Path(out_paths[0]))
    wire_variants: List[Dict[str, Any]] = []
    for i in range(n):
        v = variants[i] or {}
        wire_variants.append({
            "key": str(v.get("key") or f"v{i}"),
            "accent": v.get("accent"),
            "gender": v.get("gender") or "female",
        })
    payload = {"text": cleaned, "language": (lang or "en"), "variants": wire_variants, "format": fmt}
    ok, body, err = http_synthesize_batch(payload, timeout=_REQUEST_TIMEOUT_S)
    if not ok or not isinstance(body, dict):
        synth_error = err or "qwen3tts batch failed"
        _LAST_SYNTH_ERROR.set(synth_error)
        ColorPrint.red(f"[qwen3tts] batch synth failed: {synth_error}")
        return results
    rows = body.get("results")
    if not isinstance(rows, list):
        _LAST_SYNTH_ERROR.set("malformed batch response")
        return results
    for i in range(n):
        row = rows[i] if i < len(rows) else None
        if not isinstance(row, dict) or not row.get("ok"):
            continue
        audio_b64 = row.get("audio_base64")
        if not audio_b64:
            continue
        try:
            audio = base64.b64decode(audio_b64)
            path = Path(out_paths[i])
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(audio)
            results[i] = bool(audio)
        except (ValueError, OSError):
            results[i] = False
    if not all(results):
        _LAST_SYNTH_ERROR.set("one or more Qwen3-TTS variants failed")
    return results


__all__ = [
    "available",
    "disabled_reason",
    "base_url",
    "model_loaded",
    "is_model_loaded",
    "get_capabilities",
    "get_status",
    "get_queue_status",
    "health",
    "load_model",
    "unload_model",
    "last_synth_error",
    "synthesize",
    "synthesize_queued",
    "synthesize_variants",
]
