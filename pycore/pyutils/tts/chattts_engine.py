"""
ChatTTS engine wrapper (HTTP client to a LOCALLY-RUN OpenAI-compatible API).

ChatTTS is NOT a lightweight pip-only engine for production synth — it is a
dialogue-focused neural TTS model (laughs, sighs, oral tags). pycore talks to
its official FastAPI example server (examples/api/openai_api.py) when the user
has it running. When the server is unreachable this engine reports unavailable
and the orchestrator falls through.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Category 2 — Python 3.13 OK with current ChatTTS pip wheel; avoid legacy one-click
  bundles that pin old numba/slicer deps. pip install ChatTTS; GPU ~4GB VRAM.

Official docs: https://github.com/2noise/ChatTTS/blob/main/examples/api/README.md
  fastapi dev examples/api/openai_api.py --host 0.0.0.0 --port 8000
  POST /v1/audio/speech  { model, input, voice, response_format, speed }
  GET  /health

Config:
  CHATTTS_URL   - base url (default: http://127.0.0.1:8000)
  CHATTTS_VOICE - voice name (default: alloy)
  CHATTTS_PROMPT - oral tags prefix (optional; e.g. [oral_2][laugh_0][break_6])
"""

import os
import time
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyutils.tts.audio_utils import wav_to_mp3

_AVAIL_SIGNAL = 'pyutils.tts.chattts.available'
_AVAIL_TTL_S = 30.0
_LAST_SYNTH_ERROR = SerializedValue(None, "ChatTTSErrorState")


def base_url() -> str:
    return (os.environ.get("CHATTTS_URL") or "http://127.0.0.1:8000").rstrip("/")


def _voice() -> str:
    return (os.environ.get("CHATTTS_VOICE") or "alloy").strip() or "alloy"


def _prompt_prefix() -> str:
    return (os.environ.get("CHATTTS_PROMPT") or "").strip()


def _probe_health() -> tuple[bool, bool]:
    """Return (reachable, model_ready). Legacy servers without model_loaded count as ready."""
    requests = get_third_package_requests()
    if requests is None:
        return False, False
    for path in ("/health", "/"):
        try:
            resp = requests.get(f"{base_url()}{path}", timeout=2)
            if resp.status_code >= 500:
                continue
            model_ready = True
            try:
                body = resp.json()
                if isinstance(body, dict) and "model_loaded" in body:
                    model_ready = bool(body.get("model_loaded"))
            except ValueError:
                pass
            return True, model_ready
        except Exception:
            pass
    return False, False


def available() -> bool:
    """True when the ChatTTS API server answers and the model is loaded (cached ~30s)."""
    now = time.time()
    cache = THREAD_BUS.get_signal(_AVAIL_SIGNAL, {}) or {}
    if now - float(cache.get("ts", 0.0)) < _AVAIL_TTL_S:
        return bool(cache.get("ok"))
    reachable, model_ready = _probe_health()
    ok = reachable and model_ready
    THREAD_BUS.signal(_AVAIL_SIGNAL, {"ts": now, "ok": ok})
    return ok


def last_synth_error() -> Optional[str]:
    return _LAST_SYNTH_ERROR.get()


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    """Synthesize via POST /v1/audio/speech. Returns False on failure."""
    _LAST_SYNTH_ERROR.set(None)
    cleaned = (text or "").strip()
    if not cleaned:
        _LAST_SYNTH_ERROR.set("empty text")
        return False
    prompt = _prompt_prefix()
    payload_text = f"{prompt}{cleaned}" if prompt else cleaned
    body = {
        "model": "tts-1",
        "input": payload_text,
        "voice": _voice(),
        "response_format": "mp3",
        "speed": max(0.5, min(2.0, float(speed))),
    }
    requests = get_third_package_requests()
    if requests is None:
        _LAST_SYNTH_ERROR.set("requests package unavailable")
        return False
    try:
        resp = requests.post(
            f"{base_url()}/v1/audio/speech",
            json=body,
            timeout=120,
        )
        if resp.status_code != 200 or not resp.content:
            err = (resp.text or "").strip()[:160] or f"HTTP {resp.status_code}"
            _LAST_SYNTH_ERROR.set(err)
            ColorPrint.red(
                f"[chattts] /v1/audio/speech HTTP {resp.status_code}: {err}"
            )
            return False
        output_mp3.parent.mkdir(parents=True, exist_ok=True)
        ctype = (resp.headers.get("content-type") or "").lower()
        if "mpeg" in ctype or "mp3" in ctype or output_mp3.suffix.lower() == ".mp3":
            output_mp3.write_bytes(resp.content)
            ok = output_mp3.exists() and output_mp3.stat().st_size > 0
            if not ok:
                _LAST_SYNTH_ERROR.set("HTTP response was empty mp3")
            return ok
        tmp_wav = output_mp3.with_suffix(".chattts.wav")
        tmp_wav.write_bytes(resp.content)
        try:
            ok = wav_to_mp3(tmp_wav, output_mp3)
            if not ok:
                _LAST_SYNTH_ERROR.set("HTTP wav->mp3 conversion failed")
            return ok
        finally:
            try:
                tmp_wav.unlink()
            except OSError:
                pass
    except Exception as e:
        _LAST_SYNTH_ERROR.set(str(e))
        ColorPrint.red(f"[chattts] synth failed: {e}")
        return False


__all__ = ["available", "last_synth_error", "synthesize", "base_url"]
