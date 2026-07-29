"""
Bark offline TTS via Hugging Face Transformers (Suno suno/bark).

Category 1 — Python 3.13 native: pure PyTorch/Transformer stack, no special C
extensions. Official: https://huggingface.co/docs/transformers/model_doc/bark
  pip install transformers scipy
  Do NOT pip install bark (unrelated PyPI package per suno-ai/bark README).

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.10+; transformers; scipy.
  GPU: suno/bark (~2GB VRAM); CPU: suno/bark-small.

Config:
  BARK_MODEL          - HF id (default tier: suno/bark GPU, suno/bark-small CPU)
  BARK_DEVICE         - cpu | cuda | cuda:0 | auto (default auto)
  BARK_VOICE_PRESET   - voice preset string (default v2/en_speaker_6)
"""

from transformers import AutoProcessor, BarkModel
import os
from pathlib import Path
from typing import Any, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.tts.audio_utils import wav_to_mp3

from pycore.pyfoundations.third_party.api import get_third_package_torch
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.common.hf_local_weights import resolve_model_id
from pycore.pyfoundations.third_party.api import get_third_package_numpy
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

import importlib.util



_MODEL_QUEUE = 'pyutils.tts.bark.model'
_MODEL_WORKER = SerializedWorkerThread(_MODEL_QUEUE, 'BarkModelThread')
_MODEL_WORKER.start()
_processor: Any = None
_model: Any = None


def _device() -> str:
    want = (os.environ.get("BARK_DEVICE") or "auto").strip() or "auto"
    if want != "auto":
        return want
    try:
        torch = get_third_package_torch()
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def _model_id() -> str:
    explicit = (os.environ.get("BARK_MODEL") or "").strip()
    if explicit:
        return explicit
    try:
        tier = runtime_engine_model("bark")
    except Exception:
        tier = "suno/bark"
    return resolve_model_id("BARK_DIR", "bark", tier)


def _voice_preset() -> str:
    return (os.environ.get("BARK_VOICE_PRESET") or "v2/en_speaker_6").strip() or "v2/en_speaker_6"


def available() -> bool:
    try:
        return importlib.util.find_spec("transformers") is not None
    except Exception:
        return False


def _load_model() -> tuple[Any, Any]:
    global _processor, _model
    if _model is not None and _processor is not None:
        return _processor, _model
    model_id = _model_id()
    dev = _device()
    _processor = AutoProcessor.from_pretrained(model_id)
    _model = BarkModel.from_pretrained(model_id)
    if dev != "cpu":
        _model = _model.to(dev)
    ColorPrint.green(f"[bark] loaded {model_id} (device={dev})")
    return _processor, _model


def _get_model() -> tuple[Any, Any]:
    """Load or read the model through its owner thread."""
    return call_serialized(_MODEL_QUEUE, _load_model, timeout=900.0)


def _generate_audio(model: Any, inputs: dict[str, Any]) -> Any:
    """Generate audio on the model-owner thread."""
    return model.generate(**inputs)


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    del lang, speed
    cleaned = (text or "").strip()
    if not cleaned or not available():
        return False
    tmp_wav = output_mp3.with_suffix(".bark.wav")
    try:
        processor, model = _get_model()
        dev = _device()
        preset = _voice_preset()
        inputs = processor(cleaned, voice_preset=preset, return_tensors="pt")
        if dev != "cpu":
            inputs = {k: v.to(dev) for k, v in inputs.items()}
        audio = call_serialized(
            _MODEL_QUEUE,
            _generate_audio,
            model,
            inputs,
            timeout=900.0,
        )
        np = get_third_package_numpy()
        arr = audio.cpu().numpy().squeeze()
        if arr.ndim > 1:
            arr = arr.reshape(-1)
        rate = getattr(model.generation_config, "sample_rate", 24000)
        tmp_wav.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(tmp_wav), arr.astype(np.float32), int(rate))
    except Exception as exc:
        ColorPrint.red(f"[bark] synth failed: {exc}")
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
    global _processor, _model
    _processor = None
    _model = None


def unload_model() -> None:
    """Unload model state through its owner thread."""
    call_serialized(_MODEL_QUEUE, _unload_model)


__all__ = ["available", "synthesize", "is_model_loaded", "unload_model"]
