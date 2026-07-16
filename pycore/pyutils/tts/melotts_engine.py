"""
MeloTTS offline TTS engine wrapper.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.8+; pip/git myshell-ai/MeloTTS; unidic-lite on Windows.
  GPU preferred; HF models auto-download on first use; MELOTTS_DEVICE=auto|cuda|cpu.

Excellent zh/en mixed reading; torch-based (CPU or GPU). Models auto-download
from HuggingFace on first use (then fully offline). Installed from git by the
offline-TTS prerequisite (needs unidic-lite on Windows). Synthesizes to MP3.

Config (optional):
  MELOTTS_DEVICE   - 'cpu' | 'cuda:0' | 'auto' (default: 'auto')
"""

import os
import threading
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_melo
from pycore.pyutils.tts.audio_utils import wav_to_mp3

from pycore.pyfoundations.third_party import get_third_package_torch


_LANG_MAP: Dict[str, Tuple[str, str]] = {
    "en": ("EN", "EN-US"),
    "zh": ("ZH", "ZH"),
    "ja": ("JP", "JP"),
    "ko": ("KR", "KR"),
    "es": ("ES", "ES"),
    "fr": ("FR", "FR"),
}

_lock = threading.Lock()
_models: Dict[str, Any] = {}


def _device() -> str:
    want = (os.environ.get("MELOTTS_DEVICE") or "auto").strip() or "auto"
    if want != "auto":
        return want
    try:
        torch = get_third_package_torch()
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def available() -> bool:
    """MeloTTS importable (models download lazily on first synth)."""
    return get_third_package_melo() is not None


def _get_model(melo_lang: str) -> Any:
    with _lock:
        if melo_lang in _models:
            return _models[melo_lang]
        model = TTS(language=melo_lang, device=_device())
        _models[melo_lang] = model
        ColorPrint.green(f"[melo-tts] loaded {melo_lang} model (device={_device()})")
        return model


def _speaker_id(model: Any, spk_want: str) -> int:
    spk2id = model.hps.data.spk2id
    upper = spk_want.upper()
    for name, sid in spk2id.items():
        if name.upper() == upper or name.upper().startswith(upper):
            return sid
    return next(iter(spk2id.values()))


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    """Synthesize `text` to `output_mp3` via MeloTTS. Returns False on failure."""
    if get_third_package_melo() is None:
        return False
    melo_lang, spk_want = _LANG_MAP.get((lang or "en").lower(), ("EN", "EN-US"))
    tmp_wav = output_mp3.with_suffix(".melo.wav")
    try:
        model = _get_model(melo_lang)
        sid = _speaker_id(model, spk_want)
        tmp_wav.parent.mkdir(parents=True, exist_ok=True)
        model.tts_to_file(text, sid, str(tmp_wav), speed=float(speed))
    except Exception as e:
        ColorPrint.red(f"[melo-tts] synth failed: {e}")
        return False
    try:
        return wav_to_mp3(tmp_wav, output_mp3)
    finally:
        try:
            tmp_wav.unlink()
        except OSError:
            pass


def is_model_loaded() -> bool:
    return bool(_models)


def unload_model() -> None:
    with _lock:
        _models.clear()


__all__ = ["available", "synthesize", "is_model_loaded", "unload_model"]
