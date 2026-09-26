"""
Sherpa-ONNX offline TTS engine wrapper.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  pip install sherpa-onnx; optional +cuda wheel via SHERPA_ONNX_CUDA_SPEC.
  GPU hosts may use the full Kokoro model and CPU-only hosts the int8 model;
  this wrapper explicitly selects the CPU execution provider for both.
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
from typing import Any, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, call_serialized
from pycore.pyfoundations.system_paths import get_shared_download_cache_dir
from pycore.pyfoundations.third_party.api import get_third_package_sherpa_onnx
from pycore.pyutils.tts.audio_utils import samples_to_mp3
from pycore.pyutils.tts.tts_text_sanitize import sanitize_tts_text

_MODEL_QUEUE = "tts.sherpa.model"
_MODEL_WORKER = SerializedWorkerThread(_MODEL_QUEUE, "SherpaTTSModelThread")
_MODEL_WORKER.start()
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


def _kokoro_lexicons(model_root: Path) -> List[Path]:
    """Kokoro multi-lang lexicons to load: us-en + zh by default.

    The official package ships BOTH lexicon-us-en.txt and lexicon-gb-en.txt,
    whose headwords overlap ~159k (both literally start with `kokoro`), and
    sherpa logs "Duplicated word ... Ignore it." for every overlap at load —
    pure noise: the FIRST loaded pronunciation wins. Upstream guidance
    (k2-fsa sherpa-onnx kokoro docs): pass only the lexicons you need.
    SHERPA_KOKORO_LEXICON_GB=1 swaps us-en for gb-en (British G2P also avoids
    the U+025A phoneme the v1_1 vocab lacks); SHERPA_KOKORO_LEXICONS=a,b gives
    a full explicit filename list."""
    all_lex = sorted(model_root.rglob("lexicon-*.txt"))
    explicit = (os.environ.get("SHERPA_KOKORO_LEXICONS") or "").strip()
    if explicit:
        wanted = {name.strip() for name in explicit.split(",") if name.strip()}
        return [path for path in all_lex if path.name in wanted]
    use_gb = (os.environ.get("SHERPA_KOKORO_LEXICON_GB") or "").strip() == "1"
    picked = [
        path for path in all_lex
        if path.name != ("lexicon-us-en.txt" if use_gb else "lexicon-gb-en.txt")
    ]
    return picked or all_lex


def _build_config(model_root: Path) -> Any:
    """Auto-detect Kokoro / VITS / Matcha layout in the model dir -> config."""
    sherpa = get_third_package_sherpa_onnx()
    if sherpa is None:
        return None

    onnx = _find(model_root, "*.onnx")
    tokens = _find(model_root, "tokens.txt")
    if not onnx or not tokens:
        return None

    # Kokoro multi-lang ships lexicon-us-en.txt / lexicon-gb-en.txt /
    # lexicon-zh.txt; the official config passes the needed ones comma-joined
    # so Chinese token ids resolve. Passing only one (e.g. lexicon-us-en.txt)
    # makes Chinese text fail with "unknown token". Single-lexicon models
    # (lexicon.txt) pass it as-is.
    multi_lex = _kokoro_lexicons(model_root)
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
        return sherpa.OfflineTtsConfig(
            model=sherpa.OfflineTtsModelConfig(kokoro=kokoro, provider="cpu")
        )

    vits = sherpa.OfflineTtsVitsModelConfig(
        model=str(onnx),
        tokens=str(tokens),
        lexicon=str(_find(model_root, "lexicon.txt") or ""),
        data_dir=str(_find(model_root, "espeak-ng-data") or model_root),
        dict_dir=str(_find(model_root, "dict") or ""),
    )
    return sherpa.OfflineTtsConfig(
        model=sherpa.OfflineTtsModelConfig(vits=vits, provider="cpu")
    )


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


def _synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    """Synthesize `text` to `output_mp3` (offline). Returns False on failure."""
    tts = _get_tts()
    if tts is None:
        return False
    # VITS drops the WHOLE word on one unknown token (lexicon.cc
    # ConvertTokensToIds) — strip unpronounceable characters caller-side.
    text = sanitize_tts_text(text)
    if not text:
        ColorPrint.yellow("[sherpa-tts] text empty after sanitization; skipped")
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


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    return call_serialized(
        _MODEL_QUEUE,
        _synthesize,
        text,
        lang,
        output_mp3,
        speed,
        timeout=900.0,
    )


def _is_model_loaded() -> bool:
    return _tts is not None


def is_model_loaded() -> bool:
    return call_serialized(_MODEL_QUEUE, _is_model_loaded)


def _unload_model() -> None:
    global _tts
    _tts = None


def unload_model() -> None:
    call_serialized(_MODEL_QUEUE, _unload_model)


__all__ = ["available", "synthesize", "model_dir", "is_model_loaded", "unload_model"]
