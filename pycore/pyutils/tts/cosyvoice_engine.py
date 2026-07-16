"""
CosyVoice engine wrapper (HTTP client to a LOCALLY-RUN FunAudioLLM FastAPI server).

CosyVoice is a multi-GB Alibaba open-source TTS stack (multilingual, voice clone,
emotion control). pycore does NOT embed it; when the user runs the official
runtime FastAPI server we route synthesis to it.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.10+; git FunAudioLLM/CosyVoice; modelscope iic/CosyVoice2-0.5B.
  GPU: CUDA torch recommended; CPU supported but slow.
  Server: runtime/python/fastapi/server.py --port 50000 --model_dir iic/CosyVoice2-0.5B

Official server: FunAudioLLM/CosyVoice runtime/python/fastapi/server.py
  python runtime/python/fastapi/server.py --port 50000 --model_dir iic/CosyVoice2-0.5B
  POST /inference_sft        tts_text, spk_id
  POST /inference_zero_shot  tts_text, prompt_text, prompt_wav (file)
  POST /inference_instruct   tts_text, spk_id, instruct_text

Config:
  COSYVOICE_URL         - base url (default: http://127.0.0.1:50000)
  COSYVOICE_MODE        - sft | zero_shot | instruct (default: sft when spk set)
  COSYVOICE_SPK_ID      - speaker id for SFT/instruct (e.g. 中文女)
  COSYVOICE_REF_AUDIO   - reference wav for zero_shot / instruct2
  COSYVOICE_PROMPT_TEXT - transcript of reference clip (zero_shot)
  COSYVOICE_INSTRUCT    - instruct_text for instruct mode
"""

import os
import threading
import time
import wave
from pathlib import Path
from typing import Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.tts.audio_utils import wav_to_mp3

_avail_lock = threading.Lock()
_avail_cache = {"ts": 0.0, "ok": False}
_AVAIL_TTL_S = 30.0
_SAMPLE_RATE = 22050


def base_url() -> str:
    return (os.environ.get("COSYVOICE_URL") or "http://127.0.0.1:50000").rstrip("/")


def _ref_audio() -> Optional[Path]:
    ref = (os.environ.get("COSYVOICE_REF_AUDIO") or "").strip()
    if not ref:
        return None
    path = Path(ref)
    return path if path.exists() else None


def _mode() -> str:
    explicit = (os.environ.get("COSYVOICE_MODE") or "").strip().lower()
    if explicit in ("sft", "zero_shot", "instruct", "instruct2"):
        return explicit
    if _ref_audio() is not None:
        return "zero_shot"
    if (os.environ.get("COSYVOICE_INSTRUCT") or "").strip():
        return "instruct"
    return "sft"


def _spk_id() -> str:
    return (os.environ.get("COSYVOICE_SPK_ID") or "").strip()


def _configured() -> bool:
    mode = _mode()
    if mode == "zero_shot":
        return _ref_audio() is not None
    if mode in ("instruct", "instruct2"):
        return bool(_spk_id()) or _ref_audio() is not None
    return bool(_spk_id())


def disabled_reason() -> Optional[str]:
    if _configured():
        return None
    return "Set COSYVOICE_SPK_ID or COSYVOICE_REF_AUDIO (+ COSYVOICE_PROMPT_TEXT)"


def available() -> bool:
    """True when server answers AND synthesis config is present (cached ~30s)."""
    if not _configured():
        return False
    now = time.time()
    with _avail_lock:
        if now - _avail_cache["ts"] < _AVAIL_TTL_S:
            return _avail_cache["ok"]
    ok = False
    requests = get_third_package_requests()
    if requests is not None:
        try:
            resp = requests.get(f"{base_url()}/docs", timeout=2)
            ok = resp.status_code < 500
        except Exception:
            try:
                resp = requests.get(f"{base_url()}/inference_sft", timeout=2)
                ok = resp.status_code < 500
            except Exception:
                ok = False
    with _avail_lock:
        _avail_cache.update(ts=now, ok=ok)
    return ok


def _pcm_bytes_to_mp3(pcm_bytes: bytes, output_mp3: Path) -> bool:
    if not pcm_bytes:
        return False
    tmp_wav = output_mp3.with_suffix(".cosy.wav")
    tmp_wav.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(tmp_wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(_SAMPLE_RATE)
        w.writeframes(pcm_bytes)
    try:
        return wav_to_mp3(tmp_wav, output_mp3)
    finally:
        try:
            tmp_wav.unlink()
        except OSError:
            pass


def _endpoint_and_form(text: str) -> Tuple[str, dict, Optional[dict]]:
    mode = _mode()
    if mode == "zero_shot":
        ref = _ref_audio()
        data = {
            "tts_text": text,
            "prompt_text": (os.environ.get("COSYVOICE_PROMPT_TEXT") or "").strip(),
        }
        files = {"prompt_wav": (ref.name, ref.read_bytes(), "audio/wav")} if ref else None
        return "/inference_zero_shot", data, files
    if mode == "instruct":
        data = {
            "tts_text": text,
            "spk_id": _spk_id(),
            "instruct_text": (os.environ.get("COSYVOICE_INSTRUCT") or "").strip(),
        }
        return "/inference_instruct", data, None
    if mode == "instruct2":
        ref = _ref_audio()
        data = {
            "tts_text": text,
            "instruct_text": (os.environ.get("COSYVOICE_INSTRUCT") or "").strip(),
        }
        files = {"prompt_wav": (ref.name, ref.read_bytes(), "audio/wav")} if ref else None
        return "/inference_instruct2", data, files
    data = {"tts_text": text, "spk_id": _spk_id()}
    return "/inference_sft", data, None


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    """Synthesize via the CosyVoice FastAPI server. Returns False on failure."""
    cleaned = (text or "").strip()
    if not cleaned or not _configured():
        return False
    path, data, files = _endpoint_and_form(cleaned)
    requests = get_third_package_requests()
    if requests is None:
        return False
    try:
        if files:
            resp = requests.post(
                f"{base_url()}{path}",
                data=data,
                files=files,
                timeout=180,
            )
        else:
            resp = requests.post(
                f"{base_url()}{path}",
                data=data,
                timeout=180,
            )
        if resp.status_code != 200 or not resp.content:
            ColorPrint.red(
                f"[cosyvoice] {path} HTTP {resp.status_code}: {resp.text[:160]}"
            )
            return False
        return _pcm_bytes_to_mp3(resp.content, output_mp3)
    except Exception as e:
        ColorPrint.red(f"[cosyvoice] synth failed: {e}")
        return False


__all__ = ["available", "synthesize", "base_url", "disabled_reason"]
