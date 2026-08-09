"""
VoxCPM2 offline TTS engine (OpenBMB in-process).

VoxCPM2: multilingual voice clone / design, ~8GB VRAM recommended on GPU.
Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.10–3.12; pip install voxcpm; model openbmb/VoxCPM2; VOXCPM2_DEVICE=auto.

Official: https://voxcpm.readthedocs.io/en/latest/quickstart.html
  pip install voxcpm

Config:
  VOXCPM2_MODEL   - HuggingFace id or local path (default openbmb/VoxCPM2)
  VOXCPM2_DEVICE  - cpu | cuda | cuda:0 | auto (default auto)
  VOXCPM2_CFG       - cfg_value float (default 2.0)
  VOXCPM2_TIMESTEPS - inference_timesteps int (default 10)
"""

import os
from pathlib import Path
from typing import Any, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.tts.audio_utils import wav_to_mp3

from pycore.pyfoundations.third_party.api import (
    get_third_package_soundfile,
    get_third_package_torch,
    get_third_package_voxcpm,
)
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.common.hf_local_weights import resolve_model_id
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

import importlib.util



_MODEL_QUEUE = 'pyutils.tts.voxcpm2.model'
_MODEL_WORKER = SerializedWorkerThread(_MODEL_QUEUE, 'VoxCPM2ModelThread')
_MODEL_WORKER.start()
_model: Any = None


def _device() -> str:
    want = (os.environ.get("VOXCPM2_DEVICE") or "auto").strip() or "auto"
    if want != "auto":
        return want
    try:
        torch = get_third_package_torch()
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def _model_id() -> str:
    explicit = (os.environ.get("VOXCPM2_MODEL") or "").strip()
    if explicit:
        return explicit
    try:
        tier = runtime_engine_model("voxcpm2")
    except Exception:
        tier = "openbmb/VoxCPM2"
    return resolve_model_id("VOXCPM2_DIR", "voxcpm2", tier)


def _cfg_value() -> float:
    try:
        return float(os.environ.get("VOXCPM2_CFG", "2.0") or "2.0")
    except ValueError:
        return 2.0


def _timesteps() -> int:
    try:
        return max(1, int(os.environ.get("VOXCPM2_TIMESTEPS", "10") or "10"))
    except ValueError:
        return 10


def available() -> bool:
    try:
        return (
            importlib.util.find_spec("voxcpm") is not None
            and importlib.util.find_spec("soundfile") is not None
        )
    except Exception:
        return False


def _load_model() -> Any:
    global _model
    if _model is not None:
        return _model
    dev = _device()
    kwargs = {"load_denoiser": False}
    if dev != "auto":
        kwargs["device"] = dev
    voxcpm = get_third_package_voxcpm()
    model_class = getattr(voxcpm, "VoxCPM", None)
    if model_class is None:
        ColorPrint.red("[voxcpm2] VoxCPM class is unavailable")
        return None
    _model = model_class.from_pretrained(_model_id(), **kwargs)
    ColorPrint.green(f"[voxcpm2] loaded {_model_id()} (device={dev})")
    return _model


def _get_model() -> Any:
    """Load or read the model through its owner thread."""
    return call_serialized(_MODEL_QUEUE, _load_model, timeout=900.0)


def _generate_audio(model: Any, text: str) -> Any:
    """Generate audio on the model-owner thread."""
    return model.generate(
        text=text,
        cfg_value=_cfg_value(),
        inference_timesteps=_timesteps(),
    )


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    cleaned = (text or "").strip()
    if not cleaned or not available():
        return False
    tmp_wav = output_mp3.with_suffix(".voxcpm2.wav")
    try:
        model = _get_model()
        if model is None:
            return False
        wav = call_serialized(
            _MODEL_QUEUE,
            _generate_audio,
            model,
            cleaned,
            timeout=900.0,
        )
        tmp_wav.parent.mkdir(parents=True, exist_ok=True)
        rate = getattr(getattr(model, "tts_model", None), "sample_rate", 44100)
        soundfile = get_third_package_soundfile()
        if soundfile is None:
            ColorPrint.red("[voxcpm2] soundfile is unavailable")
            return False
        soundfile.write(str(tmp_wav), wav, rate)
    except Exception as e:
        ColorPrint.red(f"[voxcpm2] synth failed: {e}")
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
    global _model
    _model = None


def unload_model() -> None:
    """Unload model state through its owner thread."""
    call_serialized(_MODEL_QUEUE, _unload_model)


__all__ = ["available", "synthesize", "is_model_loaded", "unload_model"]
