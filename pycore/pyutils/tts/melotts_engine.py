# -*- coding: utf-8 -*-
"""
MeloTTS engine - HTTP client to the isolated-venv api server (class C).

MeloTTS pins an OLD transformers (~4.27.x), which cannot coexist with the main
interpreter's shared Bucket-A pin (~4.46.x for DeepSeek/Qwen2.5/NLLB/bark).
Therefore melo is NEVER imported in this (main) interpreter. Instead it runs as
pycore/tts_install_assets/melotts_api_server.py inside a DEDICATED per-engine venv
(see isolated_venv.py, engine "melotts"); that server is launched + lifecycle-
managed as a class-C service by tts_service_manager.py / managed_service.py. This
module only POSTs to it over stdlib HTTP (urllib), keeping the same public API the
orchestrator / capabilities probe / engine probe already call.

See development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5.

Config:
  MELOTTS_HOST / MELOTTS_PORT - server bind + client target (default 127.0.0.1:57212)
  MELOTTS_MODEL               - default MeloTTS language model (applied in server env)
  MELOTTS_DEVICE              - cpu | cuda:0 | auto (applied in the server env)
"""

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue
import pycore.pyutils.common.python_env.isolated_venv as isolated_venv

_ENGINE = "melotts"
_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 57212
_HEALTH_TIMEOUT_S = 3.0
_REQUEST_TIMEOUT_S = float(os.environ.get("MELOTTS_HTTP_TIMEOUT_S", "300") or "300")

_LAST_SYNTH_ERROR = SerializedValue(None, "MeloTTSErrorState")


def base_url() -> str:
    """HTTP base for the managed melotts api server. Single source of truth for
    both the client (here) and the server bind env built in tts_service_manager."""
    host = (os.environ.get("MELOTTS_HOST") or _DEFAULT_HOST).strip() or _DEFAULT_HOST
    raw_port = (os.environ.get("MELOTTS_PORT") or "").strip()
    try:
        port = int(raw_port) if raw_port else _DEFAULT_PORT
    except ValueError:
        port = _DEFAULT_PORT
    return f"http://{host}:{port}"


def available() -> bool:
    """The engine is usable when the isolated venv is provisioned (the managed
    service starts/loads the server on demand)."""
    return isolated_venv.venv_ready(_ENGINE)


def disabled_reason() -> Optional[str]:
    if isolated_venv.venv_ready(_ENGINE):
        return None
    return (
        "MeloTTS isolated venv not built - run Step55_InstallMelotts.ps1 -Full / "
        "139_install_melotts.sh (or it auto-builds via ensure_venv on install)"
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


def unload_model() -> None:
    """No-op: the server process lifecycle (start/stop/idle-unload) is owned by
    managed_service, which terminates the subprocess. Kept for API symmetry."""
    return None


# --------------------------------------------------------------------------- #
# HTTP helpers (stdlib urllib; same shape as qwen3tts_engine)                   #
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
        headers={"Content-Type": "application/json", "Accept": "*/*"},
    )
    try:
        with urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT_S) as resp:
            return True, resp.read(), None
    except urllib.error.HTTPError as exc:
        return False, b"", _extract_error(exc.read())
    except Exception as exc:  # noqa: BLE001
        return False, b"", str(exc)


def _fmt_for(path: Path) -> str:
    return "wav" if path.suffix.lower() == ".wav" else "mp3"


def synthesize(
    text: str,
    lang: str,
    output_mp3: Path,
    speed: float = 1.0,
    speaker: Optional[str] = None,
) -> bool:
    """POST /synthesize and write the returned audio bytes to output_mp3. The wire
    format follows the output suffix ('wav' for .wav, else 'mp3'). Returns False
    on failure (the orchestrator then falls through to the next engine)."""
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
        "format": _fmt_for(out),
    }
    picked = (speaker or "").strip()
    if picked:
        payload["speaker"] = picked
    ok, data, err = _post_bytes("/synthesize", payload)
    if not ok or not data:
        synth_error = err or "melotts synthesize failed"
        _LAST_SYNTH_ERROR.set(synth_error)
        ColorPrint.red(f"[melo-tts] synth failed: {synth_error}")
        return False
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
    except OSError as exc:
        _LAST_SYNTH_ERROR.set(f"write failed: {exc}")
        return False
    return True


__all__ = [
    "available",
    "disabled_reason",
    "base_url",
    "is_model_loaded",
    "unload_model",
    "last_synth_error",
    "synthesize",
]
