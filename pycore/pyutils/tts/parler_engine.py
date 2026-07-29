"""
Parler-TTS offline engine (Hugging Face parler-tts).

Category 1 — Python 3.13 native: lightweight transformers stack maintained by
Hugging Face audio lab. Official: https://github.com/huggingface/parler-tts
  pip install git+https://github.com/huggingface/parler-tts.git

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.10+; transformers; soundfile.
  GPU: parler-tts/parler-tts-large-v1; CPU: parler-tts/parler-tts-mini-v1.

Config:
  PARLER_MODEL        - HF id (default tier by GPU/CPU)
  PARLER_DEVICE       - cpu | cuda:0 | auto (default auto)
  PARLER_DESCRIPTION  - natural-language voice/style prompt for the speaker
"""

import os
from pathlib import Path
from typing import Any, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.tts.audio_utils import wav_to_mp3

from pycore.pyfoundations.third_party.api import get_third_package_torch

from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.common.hf_local_weights import resolve_model_id
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

import importlib.util




_MODEL_QUEUE = 'pyutils.tts.parler.model'
_MODEL_WORKER = SerializedWorkerThread(_MODEL_QUEUE, 'ParlerModelThread')
_MODEL_WORKER.start()
_tokenizer: Any = None
_model: Any = None

_DEFAULT_DESCRIPTION = (
    "A clear, very close recording with no background noise. "
    "The speaker delivers the words at a moderate speed with a neutral tone."
)


def _device() -> str:
    want = (os.environ.get("PARLER_DEVICE") or "auto").strip() or "auto"
    if want != "auto":
        return want
    try:
        torch = get_third_package_torch()
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def _model_id() -> str:
    explicit = (os.environ.get("PARLER_MODEL") or "").strip()
    if explicit:
        return explicit
    try:
        tier = runtime_engine_model("parler")
    except Exception:
        tier = "parler-tts/parler-tts-large-v1"
    return resolve_model_id("PARLER_DIR", "parler", tier)


def _description() -> str:
    return (os.environ.get("PARLER_DESCRIPTION") or _DEFAULT_DESCRIPTION).strip() or _DEFAULT_DESCRIPTION


def available() -> bool:
    try:
        return importlib.util.find_spec("parler_tts") is not None
    except Exception:
        return False


def _load_model() -> tuple[Any, Any]:
    global _tokenizer, _model
    if _model is not None and _tokenizer is not None:
        return _tokenizer, _model
    get_third_package_torch()
    model_id = _model_id()
    dev = _device()
    _tokenizer = AutoTokenizer.from_pretrained(model_id)
    _model = ParlerTTSForConditionalGeneration.from_pretrained(model_id).to(dev)
    ColorPrint.green(f"[parler] loaded {model_id} (device={dev})")
    return _tokenizer, _model


def _get_model() -> tuple[Any, Any]:
    """Load or read the model through its owner thread."""
    return call_serialized(_MODEL_QUEUE, _load_model, timeout=900.0)


def _generate_audio(model: Any, input_ids: Any, prompt_input_ids: Any) -> Any:
    """Generate audio on the model-owner thread."""
    return model.generate(input_ids=input_ids, prompt_input_ids=prompt_input_ids)


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    del lang, speed
    cleaned = (text or "").strip()
    if not cleaned or not available():
        return False
    tmp_wav = output_mp3.with_suffix(".parler.wav")
    try:
        torch = get_third_package_torch()
        tokenizer, model = _get_model()
        dev = _device()
        description = _description()
        input_ids = tokenizer(description, return_tensors="pt").input_ids.to(dev)
        prompt_input_ids = tokenizer(cleaned, return_tensors="pt").input_ids.to(dev)
        generation = call_serialized(
            _MODEL_QUEUE,
            _generate_audio,
            model,
            input_ids,
            prompt_input_ids,
            timeout=900.0,
        )
        arr = generation.cpu().numpy().squeeze()
        rate = int(getattr(model.config, "sampling_rate", 44100))
        tmp_wav.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(tmp_wav), arr, rate)
    except Exception as exc:
        ColorPrint.red(f"[parler] synth failed: {exc}")
        return False
    try:
        return wav_to_mp3(tmp_wav, output_mp3)
    finally:
        try:
            tmp_wav.unlink()
        except OSError:
            pass


def is_model_loaded() -> bool:
    return _model is not None


def _unload_model() -> None:
    global _tokenizer, _model
    _tokenizer = None
    _model = None


def unload_model() -> None:
    """Unload model state through its owner thread."""
    call_serialized(_MODEL_QUEUE, _unload_model)


__all__ = ["available", "synthesize", "is_model_loaded", "unload_model"]
