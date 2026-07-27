# -*- coding: utf-8 -*-
"""
Qwen3-TTS engine - HTTP client to the isolated-venv api server (class C).

qwen-tts owns transformer dependencies that may not coexist with the main
interpreter's pin (parler/bark -> 4.46.x). Therefore qwen-tts is NEVER imported
in this (main) interpreter. Instead it runs as
pycore/tts_install_assets/qwen3tts_api_server.py inside a DEDICATED venv (see
qwen3tts_venv.py); that server is launched + lifecycle-managed as a class-C
service by tts_service_manager.py / managed_service.py. This module only POSTs to
it over stdlib HTTP (urllib), keeping the same public API the orchestrator,
capabilities probe and engine probe already call.

See development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5.

Config:
  QWEN3TTS_HOST / QWEN3TTS_PORT - server bind + client target (default 127.0.0.1:57210)
  QWEN3TTS_MODEL                - HF id or local path (resolved in the server env)
  QWEN3TTS_DEVICE               - cpu | cuda:0 | auto (applied in the server env)
  QWEN3TTS_SPEAKER              - preset speaker override (per-call speaker wins)
  QWEN3TTS_INSTRUCT             - optional style/emotion instruction
"""

import base64
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.isolated_venv import venv_ready as isolated_venv_ready
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue

_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 57210
_HEALTH_TIMEOUT_S = 3.0
_REQUEST_TIMEOUT_S = float(os.environ.get("QWEN3TTS_HTTP_TIMEOUT_S", "900") or "900")

_LAST_SYNTH_ERROR = SerializedValue(None, "Qwen3TTSErrorState")


def base_url() -> str:
    """HTTP base for the managed qwen3tts api server. Single source of truth for
    both the client (here) and the server bind env built in tts_service_manager."""
    host = (os.environ.get("QWEN3TTS_HOST") or _DEFAULT_HOST).strip() or _DEFAULT_HOST
    raw_port = (os.environ.get("QWEN3TTS_PORT") or "").strip()
    try:
        port = int(raw_port) if raw_port else _DEFAULT_PORT
    except ValueError:
        port = _DEFAULT_PORT
    return f"http://{host}:{port}"


def available() -> bool:
    """The engine is usable when the isolated venv is provisioned (the managed
    service starts/loads the server on demand)."""
    return isolated_venv_ready("qwen3tts")


def disabled_reason() -> Optional[str]:
    if isolated_venv_ready("qwen3tts"):
        return None
    return (
        "Qwen3-TTS isolated venv not built - run Step61_InstallQwen3Tts.ps1 / "
        "140_install_qwen3tts.sh"
    )


def last_synth_error() -> Optional[str]:
    return _LAST_SYNTH_ERROR.get()


def is_model_loaded() -> bool:
    """Best-effort: GET /health -> model_loaded. Swallows all errors (server down /
    not started yet) -> False."""
    try:
        with urllib.request.urlopen(base_url() + "/health", timeout=_HEALTH_TIMEOUT_S) as resp:
            info = json.loads(resp.read().decode("utf-8"))
        return bool(isinstance(info, dict) and info.get("model_loaded"))
    except Exception:  # noqa: BLE001
        return False

def get_capabilities() -> Optional[Dict[str, Any]]:
    """GET /capabilities -> {languages, speakers, default_speakers}"""
    try:
        with urllib.request.urlopen(base_url() + "/capabilities", timeout=_HEALTH_TIMEOUT_S) as resp:
            info = json.loads(resp.read().decode("utf-8"))
        return info if isinstance(info, dict) and info.get("ok") else None
    except Exception:  # noqa: BLE001
        return None


def model_loaded() -> bool:
    return is_model_loaded()


def unload_model() -> None:
    """No-op: the server process lifecycle (start/stop/idle-unload) is owned by
    managed_service, which terminates the subprocess. Kept for API symmetry."""
    return None


# --------------------------------------------------------------------------- #
# HTTP helpers (stdlib urllib; same shape as qwen3tts_service._post)            #
# --------------------------------------------------------------------------- #
def _extract_error(data: bytes) -> str:
    try:
        parsed = json.loads(data.decode("utf-8"))
        if isinstance(parsed, dict) and parsed.get("error"):
            return str(parsed["error"])
    except Exception:  # noqa: BLE001
        pass
    return data.decode("utf-8", "replace") if data else "request failed"


def _post(path: str, payload: Dict[str, Any]) -> "tuple[int, bytes]":
    url = base_url() + path
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": "application/json", "Accept": "*/*"},
    )
    with urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT_S) as resp:
        return resp.status, resp.read()


def _http_error_detail(exc: urllib.error.HTTPError) -> str:
    """Human-readable synth failure: HTTP status + server-provided error body.
    A bare 'Internal Server Error' body means the server crashed OUTSIDE its
    endpoint guards (e.g. an orphaned process with a broken stdout pipe) —
    say so explicitly so the log points at the server console, not the model."""
    detail = _extract_error(exc.read())
    prefix = f"HTTP {exc.code}"
    if detail.strip() == "Internal Server Error":
        return (
            f"{prefix}: unhandled server-side crash (no detail; check the "
            "qwen3tts server console/[managed] log — the running server may be "
            "a stale orphan, restart it)"
        )
    return f"{prefix}: {detail}"


def _post_bytes(path: str, payload: Dict[str, Any]) -> "tuple[bool, bytes, Optional[str]]":
    try:
        _status, data = _post(path, payload)
        return True, data, None
    except urllib.error.HTTPError as exc:
        return False, b"", _http_error_detail(exc)
    except Exception as exc:  # noqa: BLE001
        return False, b"", str(exc)


def _post_json(path: str, payload: Dict[str, Any]) -> "tuple[bool, Any, Optional[str]]":
    try:
        _status, data = _post(path, payload)
        return True, json.loads(data.decode("utf-8")), None
    except urllib.error.HTTPError as exc:
        return False, None, _http_error_detail(exc)
    except Exception as exc:  # noqa: BLE001
        return False, None, str(exc)


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
) -> bool:
    """POST /synthesize and write the returned audio bytes to output_mp3. The wire
    format follows the output suffix ('wav' for .wav, else 'mp3'). ``speed`` is
    accepted for API symmetry but not supported by the qwen3tts server."""
    del speed
    _LAST_SYNTH_ERROR.set(None)
    cleaned = (text or "").strip()
    if not cleaned:
        _LAST_SYNTH_ERROR.set("empty text")
        return False
    out = Path(output_mp3)
    payload: Dict[str, Any] = {"text": cleaned, "language": (lang or "en"), "format": _fmt_for(out)}
    picked = (speaker or "").strip()
    if picked:
        payload["speaker"] = picked
    style = (instruct or os.environ.get("QWEN3TTS_INSTRUCT") or "").strip()
    if style:
        payload["instruct"] = style
    ok, data, err = _post_bytes("/synthesize", payload)
    if not ok or not data:
        synth_error = err or "qwen3tts synthesize failed"
        _LAST_SYNTH_ERROR.set(synth_error)
        ColorPrint.red(f"[qwen3tts] synth failed: {synth_error}")
        return False
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
    except OSError as exc:
        _LAST_SYNTH_ERROR.set(f"write failed: {exc}")
        return False
    return True


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
    ok, body, err = _post_json("/synthesize_batch", payload)
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
    "unload_model",
    "last_synth_error",
    "synthesize",
    "synthesize_variants",
]
