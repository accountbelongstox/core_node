"""
F5-TTS engine wrapper (HTTP client to a LOCALLY-RUN clone/voice server).

F5-TTS (SWivid) is a flow-matching non-autoregressive TTS system with fast
voice cloning. The upstream repo ships a Python API and socket server, not a
production HTTP API; community FastAPI wrappers expose POST /process with
ref_audio + ref_text + gen_text. pycore targets that contract when configured.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.10+; pip install -e SWivid/F5-TTS; GPU recommended for real-time clone.
  HTTP: f5tts_api_server.py; F5TTS_REF_AUDIO + F5TTS_REF_TEXT required.

Official library: https://github.com/SWivid/F5-TTS (src/f5_tts/api.py)
Community HTTP pattern (issue #329): POST /process multipart ref_audio, ref_text, gen_text

Config:
  F5TTS_URL       - base url (default: http://127.0.0.1:7860)
  F5TTS_REF_AUDIO - path to a short reference clip (REQUIRED)
  F5TTS_REF_TEXT  - transcript of the reference clip (REQUIRED)
"""

import os
import time
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.tts.audio_utils import wav_to_mp3

_AVAIL_SIGNAL = 'pyutils.tts.f5tts.available'
_AVAIL_TTL_S = 30.0
_LAST_SYNTH_ERROR = SerializedValue(None, "F5TTSErrorState")


def base_url() -> str:
    return (os.environ.get("F5TTS_URL") or "http://127.0.0.1:7860").rstrip("/")


def _ref_audio() -> Optional[Path]:
    ref = (os.environ.get("F5TTS_REF_AUDIO") or "").strip()
    if not ref:
        return None
    path = Path(ref)
    return path if path.exists() else None


def _ref_text() -> str:
    return (os.environ.get("F5TTS_REF_TEXT") or "").strip()


def disabled_reason() -> Optional[str]:
    if _ref_audio() is None:
        return "Set F5TTS_REF_AUDIO to a reference clip"
    if not _ref_text():
        return "Set F5TTS_REF_TEXT to the reference transcript"
    return None


def available() -> bool:
    """True when ref audio + transcript are configured AND the server answers."""
    if _ref_audio() is None or not _ref_text():
        return False
    now = time.time()
    cache = THREAD_BUS.get_signal(_AVAIL_SIGNAL, {}) or {}
    if now - float(cache.get("ts", 0.0)) < _AVAIL_TTL_S:
        return bool(cache.get("ok"))
    ok = False
    requests = get_third_package_requests()
    if requests is not None:
        for path in ("/health", "/"):
            try:
                resp = requests.get(f"{base_url()}{path}", timeout=2)
                if resp.status_code < 500:
                    ok = True
                    break
            except Exception:
                pass
    THREAD_BUS.signal(_AVAIL_SIGNAL, {"ts": now, "ok": ok})
    return ok


def last_synth_error() -> Optional[str]:
    return _LAST_SYNTH_ERROR.get()


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    """Synthesize via POST /process (multipart). Returns False on failure."""
    _LAST_SYNTH_ERROR.set(None)
    ref = _ref_audio()
    ref_text = _ref_text()
    cleaned = (text or "").strip()
    if not ref or not ref_text or not cleaned:
        _LAST_SYNTH_ERROR.set(disabled_reason() or "missing reference audio/text or empty phrase")
        return False
    requests = get_third_package_requests()
    if requests is None:
        _LAST_SYNTH_ERROR.set("requests package unavailable")
        return False
    data = {"ref_text": ref_text, "gen_text": cleaned}
    files = {"ref_audio": (ref.name, ref.read_bytes(), "audio/wav")}
    try:
        resp = requests.post(
            f"{base_url()}/process",
            data=data,
            files=files,
            timeout=180,
        )
        if resp.status_code != 200 or not resp.content:
            err = (resp.text or "").strip()[:160] or f"HTTP {resp.status_code}"
            _LAST_SYNTH_ERROR.set(err)
            ColorPrint.red(
                f"[f5tts] /process HTTP {resp.status_code}: {err}"
            )
            return False
        ctype = (resp.headers.get("content-type") or "").lower()
        output_mp3.parent.mkdir(parents=True, exist_ok=True)
        if "mpeg" in ctype or "mp3" in ctype:
            output_mp3.write_bytes(resp.content)
            ok = output_mp3.stat().st_size > 0
            if not ok:
                _LAST_SYNTH_ERROR.set("HTTP response was empty mp3")
            return ok
        tmp_wav = output_mp3.with_suffix(".f5.wav")
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
        ColorPrint.red(f"[f5tts] synth failed: {e}")
        return False


__all__ = ["available", "last_synth_error", "synthesize", "base_url", "disabled_reason"]
