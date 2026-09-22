# -*- coding: utf-8 -*-
"""
VoxCPM2 offline TTS engine - HTTP client to the isolated-venv api server
(class C).

VoxCPM2's official support window is Python 3.10-3.12 while the main
interpreter is 3.13, so voxcpm is NEVER imported here. It runs as
pycore/tts_install_assets/voxcpm2_api_server.py inside a DEDICATED
self-contained per-engine venv (see isolated_venv.py, engine "voxcpm2");
that server is launched + lifecycle-managed as a class-C service by
tts_service_manager.py / managed_service.py. Long-text chunking lives
server-side (tts_audio_assembly); this module only POSTs to it over stdlib
HTTP (urllib), keeping the same public API the orchestrator / capabilities
probe / engine probe already call.

See development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md
§5.

Config:
  VOXCPM2_HOST / VOXCPM2_PORT - server bind + client target
                                (default 127.0.0.1:57214)
  VOXCPM2_MODEL               - HuggingFace id or local path (server env)
  VOXCPM2_DEVICE              - cpu | cuda:0 | auto (server env)
  VOXCPM2_CFG / VOXCPM2_TIMESTEPS - generation defaults (server env)
  VOXCPM2_PROMPT_WAV / VOXCPM2_PROMPT_TEXT - voice clone reference
                                (forwarded per request when set)
"""

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.network_constants import (
    HTTP_JSON_CONTENT_TYPE,
    HTTP_LOOPBACK_HOST,
    TTS_HEALTH_TIMEOUT_SECONDS,
    VOXCPM2_HTTP_PORT,
    VOXCPM2_HTTP_TIMEOUT_SECONDS,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue
import pycore.pyutils.common.python_env.isolated_venv as isolated_venv
from pycore.pyutils.tts.audio_utils import wav_to_mp3

_ENGINE = "voxcpm2"
_DEFAULT_HOST = HTTP_LOOPBACK_HOST
_HEALTH_TIMEOUT_S = TTS_HEALTH_TIMEOUT_SECONDS
_REQUEST_TIMEOUT_S = float(
    os.environ.get("VOXCPM2_HTTP_TIMEOUT_S", "") or VOXCPM2_HTTP_TIMEOUT_SECONDS
)

_LAST_SYNTH_ERROR = SerializedValue(None, "VoxCPM2ErrorState")


def base_url() -> str:
    """HTTP base for the managed voxcpm2 api server. Single source of truth for
    both the client (here) and the server bind env built in
    tts_service_manager."""
    host = (os.environ.get("VOXCPM2_HOST") or _DEFAULT_HOST).strip() or _DEFAULT_HOST
    raw_port = (os.environ.get("VOXCPM2_PORT") or "").strip()
    try:
        port = int(raw_port) if raw_port else VOXCPM2_HTTP_PORT
    except ValueError:
        port = VOXCPM2_HTTP_PORT
    return f"http://{host}:{port}"


def available() -> bool:
    """The engine is usable when the isolated venv is provisioned (the managed
    service starts/loads the server on demand)."""
    return isolated_venv.venv_ready(_ENGINE)


def disabled_reason() -> Optional[str]:
    if isolated_venv.venv_ready(_ENGINE):
        return None
    return (
        "VoxCPM2 isolated venv not built - run Step58_InstallVoxcpm2.ps1 / "
        "147_install_voxcpm2.sh (requires the dedicated Python 3.12; "
        "Windows: Step13_InstallPython310_312.ps1 -Runtime 312)"
    )


def last_synth_error() -> Optional[str]:
    return _LAST_SYNTH_ERROR.get()


def is_model_loaded() -> bool:
    """Best-effort: GET /health -> model_loaded. Swallows all errors (server
    down / not started yet) -> False."""
    try:
        with urllib.request.urlopen(
            base_url() + "/health", timeout=_HEALTH_TIMEOUT_S
        ) as resp:
            info = json.loads(resp.read().decode("utf-8"))
        return bool(isinstance(info, dict) and info.get("model_loaded"))
    except Exception:  # noqa: BLE001
        return False


def unload_model() -> None:
    """No-op: the server process lifecycle (start/stop/idle-unload) is owned by
    managed_service, which terminates the subprocess. Kept for API symmetry."""
    return None


# --------------------------------------------------------------------------- #
# HTTP helpers (stdlib urllib; same shape as melotts_engine)                    #
# --------------------------------------------------------------------------- #
def _extract_error(data: bytes) -> str:
    try:
        parsed = json.loads(data.decode("utf-8"))
        if isinstance(parsed, dict) and parsed.get("error"):
            return str(parsed["error"])
    except Exception:  # noqa: BLE001
        pass
    return data.decode("utf-8", "replace") if data else "request failed"


def _post_bytes(path: str, payload: Dict[str, Any]) -> "tuple[bool, bytes, Optional[str]]":
    url = base_url() + path
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": HTTP_JSON_CONTENT_TYPE, "Accept": "*/*"},
    )
    try:
        with urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT_S) as resp:
            return True, resp.read(), None
    except urllib.error.HTTPError as exc:
        return False, b"", _extract_error(exc.read())
    except Exception as exc:  # noqa: BLE001
        return False, b"", str(exc)


def synthesize(
    text: str,
    lang: str,
    output_mp3: Path,
    speed: float = 1.0,
    speaker: Optional[str] = None,
) -> bool:
    """POST /synthesize and write the returned PCM16 WAV to output_mp3 (the
    server emits wav; mp3 targets are converted locally via ffmpeg). Returns
    False on failure (the orchestrator then falls through to the next
    engine)."""
    del speaker
    _LAST_SYNTH_ERROR.set(None)
    cleaned = (text or "").strip()
    if not cleaned:
        _LAST_SYNTH_ERROR.set("empty text")
        return False
    out = Path(output_mp3)
    payload: Dict[str, Any] = {
        "text": cleaned,
        "language": (lang or "en"),
        "speed": float(speed),
    }
    prompt_wav = (os.environ.get("VOXCPM2_PROMPT_WAV") or "").strip()
    if prompt_wav:
        payload["prompt_wav_path"] = prompt_wav
        prompt_text = (os.environ.get("VOXCPM2_PROMPT_TEXT") or "").strip()
        if prompt_text:
            payload["prompt_text"] = prompt_text
    ok, data, err = _post_bytes("/synthesize", payload)
    if not ok or not data:
        synth_error = err or "voxcpm2 synthesize failed"
        _LAST_SYNTH_ERROR.set(synth_error)
        ColorPrint.red(f"[voxcpm2] synth failed: {synth_error}")
        return False
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.suffix.lower() == ".wav":
            out.write_bytes(data)
            return True
        tmp_wav = out.with_suffix(".voxcpm2.wav")
        tmp_wav.write_bytes(data)
        try:
            if not wav_to_mp3(tmp_wav, out):
                _LAST_SYNTH_ERROR.set("wav->mp3 conversion failed")
                return False
            return True
        finally:
            try:
                tmp_wav.unlink()
            except OSError:
                pass
    except OSError as exc:
        _LAST_SYNTH_ERROR.set(f"write failed: {exc}")
        return False


__all__ = [
    "available",
    "disabled_reason",
    "base_url",
    "is_model_loaded",
    "unload_model",
    "last_synth_error",
    "synthesize",
]
