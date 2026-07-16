"""
Sherpa-ONNX offline TTS engine wrapper.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  pip install sherpa-onnx; optional +cuda wheel via SHERPA_ONNX_CUDA_SPEC.
  GPU model: kokoro-multi-lang-v1_1 (full); CPU model: kokoro-int8-multi-lang-v1_1.
  SHERPA_TTS_MODEL_DIR defaults to <cache>/tts/sherpa.

Pure-offline, CPU, zero-cost, identical on Windows/Linux (`pip install
sherpa-onnx`, no system deps — espeak data ships inside the model). The model is
downloaded by the offline-TTS prerequisite into a model dir; this wrapper
auto-detects Kokoro (multi-lang zh/en) or VITS/Piper layout there and synthesizes
to MP3.

Config (all optional):
  SHERPA_TTS_MODEL_DIR  - model directory (default: <cache>/tts/sherpa)
  SHERPA_TTS_SID        - speaker id (default 0)
"""

import os
from pathlib import Path
from typing import Any, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_shared_download_cache_dir
from pycore.pyfoundations.third_party import get_third_package_sherpa_onnx
from pycore.pyutils.tts.audio_utils import samples_to_mp3

_tts: Any = None


def model_dir() -> Path:
    env = (os.environ.get("SHERPA_TTS_MODEL_DIR") or "").strip()
    if env:
        return Path(env)
    return get_shared_download_cache_dir() / "tts" / "sherpa"


def _find(root: Path, pattern: str) -> Optional[Path]:
    if not root.is_dir():
        return None
    matches = sorted(root.rglob(pattern))
    return matches[0] if matches else None


def _build_config(model_root: Path) -> Any:
    """Auto-detect Kokoro / VITS / Matcha layout in the model dir -> config."""
    sherpa = get_third_package_sherpa_onnx()
    if sherpa is None:
        return None

    onnx = _find(model_root, "*.onnx")
    tokens = _find(model_root, "tokens.txt")
    if not onnx or not tokens:
        return None

    # Kokoro multi-lang ships BOTH lexicon-us-en.txt and lexicon-zh.txt; the
    # official config passes them comma-joined so Chinese token ids resolve.
    # Passing only one (e.g. lexicon-us-en.txt) makes Chinese text fail with
    # "unknown token". Single-lexicon models (lexicon.txt) pass it as-is.
    multi_lex = sorted(model_root.rglob("lexicon-*.txt"))
    single_lex = _find(model_root, "lexicon.txt")
    if multi_lex:
        lexicon = ",".join(str(p) for p in multi_lex)
    elif single_lex:
        lexicon = str(single_lex)
    else:
        lexicon = None

    if lexicon:
        kokoro = sherpa.OfflineTtsKokoroModelConfig(
            model=str(onnx),
            tokens=str(tokens),
            lexicon=lexicon,
            voices=str(_find(model_root, "voices.bin") or ""),
            data_dir=str(_find(model_root, "espeak-ng-data") or model_root),
            dict_dir=str(_find(model_root, "dict") or ""),
        )
        return sherpa.OfflineTtsConfig(model=sherpa.OfflineTtsModelConfig(kokoro=kokoro))

    vits = sherpa.OfflineTtsVitsModelConfig(
        model=str(onnx),
        tokens=str(tokens),
        lexicon=str(_find(model_root, "lexicon.txt") or ""),
        data_dir=str(_find(model_root, "espeak-ng-data") or model_root),
        dict_dir=str(_find(model_root, "dict") or ""),
    )
    return sherpa.OfflineTtsConfig(model=sherpa.OfflineTtsModelConfig(vits=vits))


def _get_tts() -> Any:
    global _tts
    if _tts is not None:
        return _tts
    root = model_dir()
    config = _build_config(root)
    if config is None:
        ColorPrint.red(f"[sherpa-tts] no usable model in {root}")
        return None
    sherpa = get_third_package_sherpa_onnx()
    if sherpa is None:
        return None
    try:
        _tts = sherpa.OfflineTts(config)
        ColorPrint.green(f"[sherpa-tts] loaded model from {root}")
        return _tts
    except Exception as e:
        ColorPrint.red(f"[sherpa-tts] model load failed: {e}")
        return None


def available() -> bool:
    """sherpa-onnx importable AND a model (.onnx + tokens.txt) is present."""
    if get_third_package_sherpa_onnx() is None:
        return False
    root = model_dir()
    return root.is_dir() and _find(root, "*.onnx") is not None and _find(root, "tokens.txt") is not None


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    """Synthesize `text` to `output_mp3` (offline). Returns False on failure."""
    tts = _get_tts()
    if tts is None:
        return False
    try:
        sid = int(os.environ.get("SHERPA_TTS_SID", "0") or "0")
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
        ColorPrint.red(f"[sherpa-tts] generate failed: {e}")
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
