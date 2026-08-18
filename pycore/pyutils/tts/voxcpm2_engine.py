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

import importlib.util
import os
import sys
from pathlib import Path
from typing import Any

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_soundfile,
    get_third_package_torch,
    get_third_package_voxcpm,
)
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.common.hf_local_weights import resolve_model_id
from pycore.pyutils.common.python_env.runtime_policy import engine_compatibility
from pycore.pyutils.tts.serialized_model_engine import SerializedModelEngine

_MODEL_QUEUE = 'pyutils.tts.voxcpm2.model'
_MODEL_THREAD = 'VoxCPM2ModelThread'
_WAV_SUFFIX = '.voxcpm2.wav'


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


class VoxCPM2Engine(SerializedModelEngine):
    def available(self) -> bool:
        python_version = f"{sys.version_info.major}.{sys.version_info.minor}"
        compatibility = engine_compatibility("voxcpm2", python_version)
        return bool(
            compatibility["compatible"]
            and importlib.util.find_spec("voxcpm") is not None
            and importlib.util.find_spec("soundfile") is not None
        )

    def load_resource(self) -> Any:
        dev = _device()
        model_id = _model_id()
        kwargs = {"load_denoiser": False}
        if dev != "auto":
            kwargs["device"] = dev
        voxcpm = get_third_package_voxcpm()
        model_class = getattr(voxcpm, "VoxCPM", None)
        if model_class is None:
            ColorPrint.red("[voxcpm2] VoxCPM class is unavailable")
            return None
        model = model_class.from_pretrained(model_id, **kwargs)
        ColorPrint.green(f"[voxcpm2] loaded {model_id} (device={dev})")
        return model

    def render_wav(
        self,
        resource: Any,
        text: str,
        lang: str,
        output_wav: Path,
        speed: float,
    ) -> bool:
        del lang, speed
        wav = resource.generate(
            text=text,
            cfg_value=_cfg_value(),
            inference_timesteps=_timesteps(),
        )
        rate = getattr(getattr(resource, "tts_model", None), "sample_rate", 44100)
        soundfile = get_third_package_soundfile()
        if soundfile is None:
            ColorPrint.red("[voxcpm2] soundfile is unavailable")
            return False
        soundfile.write(str(output_wav), wav, rate)
        return True


voxcpm2_engine = VoxCPM2Engine(_MODEL_QUEUE, _MODEL_THREAD, _WAV_SUFFIX)


def available() -> bool:
    return voxcpm2_engine.available()


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    return voxcpm2_engine.synthesize(text, lang, output_mp3, speed)


def is_model_loaded() -> bool:
    return voxcpm2_engine.is_loaded()


def unload_model() -> None:
    voxcpm2_engine.unload()


__all__ = ["available", "synthesize", "is_model_loaded", "unload_model"]
