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

import importlib.util
import os
from pathlib import Path
from typing import Any

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_parler_tts,
    get_third_package_soundfile,
    get_third_package_torch,
    get_third_package_transformers,
)

from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.common.hf_local_weights import resolve_model_id
from pycore.pyutils.tts.serialized_model_engine import SerializedModelEngine

_MODEL_QUEUE = 'pyutils.tts.parler.model'
_MODEL_THREAD = 'ParlerModelThread'
_WAV_SUFFIX = '.parler.wav'

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


class ParlerEngine(SerializedModelEngine):
    def available(self) -> bool:
        return (
            importlib.util.find_spec("parler_tts") is not None
            and importlib.util.find_spec("soundfile") is not None
            and importlib.util.find_spec("transformers") is not None
        )

    def load_resource(self) -> Any:
        get_third_package_torch()
        model_id = _model_id()
        dev = _device()
        transformers = get_third_package_transformers()
        parler_tts = get_third_package_parler_tts()
        tokenizer_class = getattr(transformers, "AutoTokenizer", None)
        model_class = getattr(parler_tts, "ParlerTTSForConditionalGeneration", None)
        if tokenizer_class is None or model_class is None:
            ColorPrint.red("[parler] model classes are unavailable")
            return None
        tokenizer = tokenizer_class.from_pretrained(model_id)
        model = model_class.from_pretrained(model_id).to(dev)
        ColorPrint.green(f"[parler] loaded {model_id} (device={dev})")
        return tokenizer, model

    def render_wav(
        self,
        resource: Any,
        text: str,
        lang: str,
        output_wav: Path,
        speed: float,
    ) -> bool:
        del lang, speed
        tokenizer, model = resource
        dev = _device()
        input_ids = tokenizer(
            _description(),
            return_tensors="pt",
        ).input_ids.to(dev)
        prompt_input_ids = tokenizer(text, return_tensors="pt").input_ids.to(dev)
        generation = model.generate(
            input_ids=input_ids,
            prompt_input_ids=prompt_input_ids,
        )
        arr = generation.cpu().numpy().squeeze()
        rate = int(getattr(model.config, "sampling_rate", 44100))
        soundfile = get_third_package_soundfile()
        if soundfile is None:
            ColorPrint.red("[parler] soundfile is unavailable")
            return False
        soundfile.write(str(output_wav), arr, rate)
        return True


parler_engine = ParlerEngine(_MODEL_QUEUE, _MODEL_THREAD, _WAV_SUFFIX)


def available() -> bool:
    return parler_engine.available()


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    return parler_engine.synthesize(text, lang, output_mp3, speed)


def is_model_loaded() -> bool:
    return parler_engine.is_loaded()


def unload_model() -> None:
    parler_engine.unload()


__all__ = ["available", "synthesize", "is_model_loaded", "unload_model"]
