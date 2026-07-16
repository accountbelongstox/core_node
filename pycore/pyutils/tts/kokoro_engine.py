"""
Kokoro-82M offline TTS via sherpa-onnx (dedicated priority slot).

Uses sherpa-onnx with the Kokoro-82M multi-lang model (zh/en). Installed by
117_install_kokoro.sh; falls back to the sherpa offline prerequisite cache.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  sherpa-onnx pip package; GPU -> kokoro-multi-lang-v1_1; CPU -> kokoro-int8-multi-lang-v1_1.
  Model dir: KOKORO_TTS_MODEL_DIR or sherpa cache fallback.

Official: https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/kokoro-multi-lang-v1_1.html

Config:
  KOKORO_TTS_MODEL_DIR  - model root (default: <cache>/tts/kokoro, else sherpa dir)
  KOKORO_TTS_SID        - speaker id (default 0)
"""

import os
from pathlib import Path
from typing import Any

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_shared_download_cache_dir
from pycore.pyfoundations.third_party import get_third_package_sherpa_onnx
from pycore.pyutils.tts import sherpa_engine
from pycore.pyutils.tts.audio_utils import samples_to_mp3

_tts: Any = None


def model_dir() -> Path:
    env = (os.environ.get("KOKORO_TTS_MODEL_DIR") or "").strip()
    if env:
        return Path(env)
    dedicated = get_shared_download_cache_dir() / "tts" / "kokoro"
    if dedicated.is_dir() and sherpa_engine._find(dedicated, "*.onnx"):
        return dedicated
    return sherpa_engine.model_dir()


def available() -> bool:
    if get_third_package_sherpa_onnx() is None:
        return False
    root = model_dir()
    return (
        root.is_dir()
        and sherpa_engine._find(root, "*.onnx") is not None
        and sherpa_engine._find(root, "tokens.txt") is not None
    )


def _get_tts() -> Any:
    global _tts
    if _tts is not None:
        return _tts
    root = model_dir()
    config = sherpa_engine._build_config(root)
    if config is None:
        return None
    sherpa = get_third_package_sherpa_onnx()
    if sherpa is None:
        return None
    try:
        _tts = sherpa.OfflineTts(config)
        ColorPrint.green(f"[kokoro-tts] loaded model from {root}")
        return _tts
    except Exception as e:
        ColorPrint.red(f"[kokoro-tts] model load failed: {e}")
        return None


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    tts = _get_tts()
    if tts is None:
        return False
    try:
        sid = int(os.environ.get("KOKORO_TTS_SID", os.environ.get("SHERPA_TTS_SID", "0")) or "0")
    except ValueError:
        sid = 0
    try:
        try:
            audio = tts.generate(text, sid, speed=float(speed))
        except TypeError:
            sherpa = get_third_package_sherpa_onnx()
            gen = sherpa.GenerationConfig()
            gen.sid = sid
            gen.speed = float(speed)
            audio = tts.generate(text, gen)
    except Exception as e:
        ColorPrint.red(f"[kokoro-tts] generate failed: {e}")
        return False
    samples = getattr(audio, "samples", None)
    sample_rate = getattr(audio, "sample_rate", 22050)
    if samples is None:
        return False
    return samples_to_mp3(samples, sample_rate, output_mp3)


def is_model_loaded() -> bool:
    return _tts is not None


def unload_model() -> None:
    global _tts
    _tts = None


__all__ = ["available", "synthesize", "model_dir", "is_model_loaded", "unload_model"]
