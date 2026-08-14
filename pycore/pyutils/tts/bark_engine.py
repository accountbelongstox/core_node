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

import importlib.util
import os
from pathlib import Path
from typing import Any

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_numpy,
    get_third_package_scipy,
    get_third_package_torch,
    get_third_package_transformers,
)
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.common.hf_local_weights import resolve_model_id
from pycore.pyutils.tts.serialized_model_engine import SerializedModelEngine

_MODEL_QUEUE = 'pyutils.tts.bark.model'
_MODEL_THREAD = 'BarkModelThread'
_WAV_SUFFIX = '.bark.wav'
_STATIC_MODEL_MIN_BYTES = {
    "suno/bark": {"pytorch_model.bin": 4_000_000_000},
    "suno/bark-small": {"pytorch_model.bin": 1_500_000_000},
}


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
    return resolve_model_id(
        "BARK_DIR",
        "bark",
        tier,
        static_sizes=_STATIC_MODEL_MIN_BYTES.get(tier),
    )


def _voice_preset() -> str:
    return (os.environ.get("BARK_VOICE_PRESET") or "v2/en_speaker_6").strip() or "v2/en_speaker_6"


class BarkEngine(SerializedModelEngine):
    def available(self) -> bool:
        return (
            importlib.util.find_spec("transformers") is not None
            and importlib.util.find_spec("scipy") is not None
        )

    def load_resource(self) -> Any:
        model_id = _model_id()
        dev = _device()
        transformers = get_third_package_transformers()
        processor_class = getattr(transformers, "AutoProcessor", None)
        model_class = getattr(transformers, "BarkModel", None)
        if processor_class is None or model_class is None:
            ColorPrint.red("[bark] transformers Bark classes are unavailable")
            return None
        processor = processor_class.from_pretrained(model_id)
        model = model_class.from_pretrained(model_id)
        if dev != "cpu":
            model = model.to(dev)
        ColorPrint.green(f"[bark] loaded {model_id} (device={dev})")
        return processor, model

    def render_wav(
        self,
        resource: Any,
        text: str,
        lang: str,
        output_wav: Path,
        speed: float,
    ) -> bool:
        del lang, speed
        processor, model = resource
        dev = _device()
        inputs = processor(
            text,
            voice_preset=_voice_preset(),
            return_tensors="pt",
        )
        if dev != "cpu":
            inputs = {key: value.to(dev) for key, value in inputs.items()}
        audio = model.generate(**inputs)
        np = get_third_package_numpy()
        arr = audio.cpu().numpy().squeeze()
        if arr.ndim > 1:
            arr = arr.reshape(-1)
        rate = getattr(model.generation_config, "sample_rate", 24000)
        scipy = get_third_package_scipy()
        if scipy is None:
            ColorPrint.red("[bark] scipy is unavailable")
            return False
        scipy.io.wavfile.write(str(output_wav), int(rate), arr.astype(np.float32))
        return True


bark_engine = BarkEngine(_MODEL_QUEUE, _MODEL_THREAD, _WAV_SUFFIX)


def available() -> bool:
    return bark_engine.available()


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    return bark_engine.synthesize(text, lang, output_mp3, speed)


def is_model_loaded() -> bool:
    return bark_engine.is_loaded()


def unload_model() -> None:
    bark_engine.unload()


__all__ = ["available", "synthesize", "is_model_loaded", "unload_model"]
