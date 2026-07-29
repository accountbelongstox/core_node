"""
GPT-SoVITS TTS engine wrapper (HTTP client to a LOCALLY-RUN api server).

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.9–3.11; git RVC-Boss/GPT-SoVITS; lj1995/GPT-SoVITS HF models.
  GPU: CUDA torch + GPTSOVITS_HF_ALLOW=* (all pretrained); CPU: v2 set (~1.2GB).
  Server: api_v2.py :9880; GPTSOVITS_REF_AUDIO required.

GPT-SoVITS is NOT a pip package — it's a cloned repo + conda env + multi-GB
models + GPU. We therefore do NOT install it; instead, if the user has it running
(its `api_v2.py` FastAPI server, default 127.0.0.1:9880), we route synthesis to
it for voice-cloned, emotion-rich output. When the server is unreachable this
engine simply reports unavailable and the orchestrator falls through.

Config:
  GPTSOVITS_URL          - base url (default: http://127.0.0.1:9880)
  GPTSOVITS_REF_AUDIO    - path to a short reference clip (REQUIRED for synth;
                           defines the cloned timbre)
  GPTSOVITS_PROMPT_TEXT  - transcript of the reference clip
  GPTSOVITS_PROMPT_LANG  - language of the reference clip (default: same as text)
"""

import os
import time
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyutils.tts.audio_utils import wav_to_mp3

_LANG_MAP = {"en": "en", "zh": "zh", "ja": "ja", "ko": "ko", "yue": "yue"}

_AVAIL_SIGNAL = 'pyutils.tts.gptsovits.available'
_AVAIL_TTL_S = 30.0


def base_url() -> str:
    return (os.environ.get("GPTSOVITS_URL") or "http://127.0.0.1:9880").rstrip("/")


def _ref_audio() -> Optional[Path]:
    ref = (os.environ.get("GPTSOVITS_REF_AUDIO") or "").strip()
    if not ref:
        return None
    path = Path(ref)
    return path if path.exists() else None


def available() -> bool:
    """
    True only if a ref audio is configured AND the api server answers.

    Cached ~30s so a status poll doesn't hammer the local server. Without a
    reference clip GPT-SoVITS cannot synthesize, so we report unavailable.
    """
    if _ref_audio() is None:
        return False
    now = time.time()
    cache = THREAD_BUS.get_signal(_AVAIL_SIGNAL, {}) or {}
    if now - float(cache.get("ts", 0.0)) < _AVAIL_TTL_S:
        return bool(cache.get("ok"))
    ok = False
    try:
        requests = get_third_package_requests()
        if requests is None:
            ok = False
        else:
            resp = requests.get(f"{base_url()}/", timeout=2)
            ok = resp.status_code < 500
    except Exception:
        ok = False
    THREAD_BUS.signal(_AVAIL_SIGNAL, {"ts": now, "ok": ok})
    return ok


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    """Synthesize via the GPT-SoVITS api_v2 /tts endpoint. Returns False on failure."""
    ref = _ref_audio()
    if ref is None:
        return False
    text_lang = _LANG_MAP.get((lang or "en").lower(), "en")
    prompt_lang = (os.environ.get("GPTSOVITS_PROMPT_LANG") or text_lang).strip()
    body = {
        "text": text,
        "text_lang": text_lang,
        "ref_audio_path": str(ref),
        "prompt_text": os.environ.get("GPTSOVITS_PROMPT_TEXT", ""),
        "prompt_lang": prompt_lang,
        "speed_factor": float(speed),
        "media_type": "wav",
        "streaming_mode": False,
    }
    try:
        requests = get_third_package_requests()
        if requests is None:
            return False
        resp = requests.post(f"{base_url()}/tts", json=body, timeout=120)
        if resp.status_code != 200 or not resp.content:
            ColorPrint.red(
                f"[gptsovits] /tts HTTP {resp.status_code}: {resp.text[:160]}"
            )
            return False
        tmp_wav = output_mp3.with_suffix(".gsv.wav")
        tmp_wav.parent.mkdir(parents=True, exist_ok=True)
        tmp_wav.write_bytes(resp.content)
        try:
            return wav_to_mp3(tmp_wav, output_mp3)
        finally:
            try:
                tmp_wav.unlink()
            except OSError:
                pass
    except Exception as e:
        ColorPrint.red(f"[gptsovits] synth failed: {e}")
        return False


__all__ = ["available", "synthesize", "base_url"]
