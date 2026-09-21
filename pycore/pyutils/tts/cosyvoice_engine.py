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
import time
import wave
from pathlib import Path
from typing import Optional, Tuple

from pycore.pyutils.common.http_progress_upload import http_progress_client
from pycore.pyfoundations.network_constants import COSYVOICE_HTTP_PORT
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.tts import chunked_synthesis
from pycore.pyutils.tts.audio_utils import wav_to_mp3

_AVAIL_SIGNAL = 'pyutils.tts.cosyvoice.available'
_AVAIL_TTL_S = 30.0
def _sample_rate() -> int:
    """PCM sample rate of the configured model's server output.

    The official fastapi server streams raw PCM without a header, so the rate
    must come from model metadata: the CosyVoice2 family generates 24 kHz,
    CosyVoice 1.x (300M/SFT) 22050 Hz. COSYVOICE_SAMPLE_RATE overrides.
    """
    explicit = (os.environ.get("COSYVOICE_SAMPLE_RATE") or "").strip()
    if explicit:
        try:
            rate = int(explicit)
            if rate > 0:
                return rate
        except ValueError:
            pass
    try:
        model = str(runtime_engine_model("cosyvoice") or "")
    except Exception:  # noqa: BLE001
        model = ""
    if "cosyvoice2" in model.lower().replace("-", ""):
        return 24000
    return 22050


def base_url() -> str:
    return (os.environ.get("COSYVOICE_URL") or f"http://127.0.0.1:{COSYVOICE_HTTP_PORT}").rstrip("/")


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
    cache = THREAD_BUS.get_signal(_AVAIL_SIGNAL, {}) or {}
    if now - float(cache.get("ts", 0.0)) < _AVAIL_TTL_S:
        return bool(cache.get("ok"))
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
    THREAD_BUS.signal(_AVAIL_SIGNAL, {"ts": now, "ok": ok})
    return ok


def _write_pcm_wav(pcm_bytes: bytes, wav_path: Path) -> bool:
    if not pcm_bytes:
        return False
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(_sample_rate())
        w.writeframes(pcm_bytes)
    return True


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


def _post_pcm(text: str) -> Optional[bytes]:
    """POST one (chunk) text to the configured endpoint; return raw PCM16 bytes."""
    path, data, files = _endpoint_and_form(text)
    requests = get_third_package_requests()
    if requests is None:
        return None
    try:
        resp = http_progress_client.post(
            f"{base_url()}{path}", data=data, files=files, timeout=180,
        )
        if resp.status_code != 200 or not resp.content:
            ColorPrint.red(
                f"[cosyvoice] {path} HTTP {resp.status_code}: {resp.text[:160]}"
            )
            return None
        return resp.content
    except Exception as e:
        ColorPrint.red(f"[cosyvoice] synth failed: {e}")
        return None


def _synthesize_chunk_to_wav(chunk_text: str, chunk_wav: Path) -> bool:
    return _write_pcm_wav(_post_pcm(chunk_text) or b"", chunk_wav)


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    """Synthesize via the CosyVoice FastAPI server. Returns False on failure.

    Long text: the official frontend already splits natively; the client only
    applies the protective guard (chunked_synthesis) for over-long inputs and
    concatenates the PCM chunks before the mp3 conversion."""
    cleaned = (text or "").strip()
    if not cleaned or not _configured():
        return False
    tmp_wav = output_mp3.with_suffix(".cosy.wav")
    ok, error, stats = chunked_synthesis.synthesize_chunked(
        "cosyvoice", cleaned, _synthesize_chunk_to_wav, tmp_wav
    )
    if not ok:
        ColorPrint.red(f"[cosyvoice] synth failed: {error}")
        try:
            tmp_wav.unlink()
        except OSError:
            pass
        return False
    if stats.get("chunked"):
        ColorPrint.blue(
            f"[cosyvoice] protective chunking: {stats.get('chunk_count')} chunks"
        )
    try:
        return wav_to_mp3(tmp_wav, output_mp3)
    finally:
        try:
            tmp_wav.unlink()
        except OSError:
            pass


__all__ = ["available", "synthesize", "base_url", "disabled_reason"]
