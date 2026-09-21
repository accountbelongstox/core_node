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
from typing import Any, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import call_serialized
from pycore.pyfoundations.third_party.api import (
    get_third_package_parler_tts,
    get_third_package_soundfile,
    get_third_package_torch,
    get_third_package_transformers,
)

from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.common.hf_local_weights import resolve_model_id
from pycore.pyutils.tts.serialized_model_engine import SerializedModelEngine
from pycore.pyutils.tts.batch import batch_constants as batch_const

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


def _dtype() -> Any:
    torch = get_third_package_torch()
    if not _device().startswith("cuda"):
        return torch.float32
    return torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16


def _load_kwargs(dev: str) -> dict:
    if importlib.util.find_spec("accelerate") is None:
        return {}
    if dev.startswith("cuda"):
        return {"device_map": dev}
    return {"low_cpu_mem_usage": True}


class ParlerEngine(SerializedModelEngine):
    def available(self) -> bool:
        return (
            importlib.util.find_spec("parler_tts") is not None
            and importlib.util.find_spec("soundfile") is not None
            and importlib.util.find_spec("transformers") is not None
        )

    def load_resource(self) -> Any:
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
        model = model_class.from_pretrained(model_id, torch_dtype=_dtype(), **_load_kwargs(dev))
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
        description_inputs = tokenizer(
            _description(),
            return_tensors="pt",
        ).to(dev)
        prompt_inputs = tokenizer(text, return_tensors="pt").to(dev)
        generation = model.generate(
            input_ids=description_inputs.input_ids,
            attention_mask=description_inputs.attention_mask,
            prompt_input_ids=prompt_inputs.input_ids,
            prompt_attention_mask=prompt_inputs.attention_mask,
        )
        # The CUDA path loads the model in bfloat16; numpy has no bf16 dtype,
        # so cast before the handoff ("Got unsupported ScalarType BFloat16").
        arr = generation.float().cpu().numpy().squeeze()
        rate = int(getattr(model.config, "sampling_rate", 44100))
        soundfile = get_third_package_soundfile()
        if soundfile is None:
            ColorPrint.red("[parler] soundfile is unavailable")
            return False
        soundfile.write(str(output_wav), arr, rate)
        return True

    def render_wav_batch(
        self,
        resource: Any,
        texts: List[str],
        lang: str,
        output_wavs: List[Path],
        speed: float,
    ) -> bool:
        """Official Parler-TTS batch generation (left-padding + audios_length).

        See the "Batch generation" section of the official INFERENCE.md:
        https://github.com/huggingface/parler-tts/blob/main/INFERENCE.md
        """
        del lang, speed
        tokenizer, model = resource
        dev = _device()
        soundfile = get_third_package_soundfile()
        if soundfile is None:
            ColorPrint.red("[parler] soundfile is unavailable")
            return False
        description = _description()
        previous_padding_side = getattr(tokenizer, "padding_side", "right")
        try:
            tokenizer.padding_side = "left"
            description_inputs = tokenizer(
                [description] * len(texts),
                return_tensors="pt",
                padding=True,
            ).to(dev)
            prompt_inputs = tokenizer(
                list(texts),
                return_tensors="pt",
                padding=True,
            ).to(dev)
            generation = model.generate(
                input_ids=description_inputs.input_ids,
                attention_mask=description_inputs.attention_mask,
                prompt_input_ids=prompt_inputs.input_ids,
                prompt_attention_mask=prompt_inputs.attention_mask,
                do_sample=True,
                return_dict_in_generate=True,
            )
            rate = int(getattr(model.config, "sampling_rate", 44100))
            audios_length = getattr(generation, "audios_length", None)
            for index, output_wav in enumerate(output_wavs):
                if audios_length is not None:
                    audio = generation.sequences[index, : audios_length[index]]
                else:
                    audio = generation.sequences[index]
                # bf16 (CUDA dtype) has no numpy counterpart; cast to float32.
                arr = audio.float().cpu().numpy().squeeze()
                output_wav.parent.mkdir(parents=True, exist_ok=True)
                soundfile.write(str(output_wav), arr, rate)
            return True
        except Exception as exc:  # noqa: BLE001
            ColorPrint.red(f"[parler] batch render failed: {exc}")
            return False
        finally:
            tokenizer.padding_side = previous_padding_side

    def _render_batch_on_owner(
        self,
        texts: List[str],
        lang: str,
        output_wavs: List[Path],
        speed: float,
    ) -> bool:
        resource = self._load_on_owner()
        if resource is None:
            return False
        ok_all = True
        size = batch_const.parler_batch_size()
        for offset in range(0, len(texts), size):
            chunk_texts = texts[offset:offset + size]
            chunk_out = output_wavs[offset:offset + size]
            if not self.render_wav_batch(resource, chunk_texts, lang, chunk_out, speed):
                ok_all = False
        return ok_all

    def synthesize_batch(
        self,
        texts: List[str],
        lang: str,
        output_wavs: List[Path],
        speed: float = 1.0,
    ) -> bool:
        """Batched wav synthesis on the serialized worker; True when every wav
        was written. Callers pair the returned wavs with their texts by index."""
        cleaned = [(t or "").strip() for t in texts]
        if not cleaned or len(cleaned) != len(output_wavs) or not self.available():
            return False
        return bool(call_serialized(
            self._queue_name,
            self._render_batch_on_owner,
            cleaned,
            lang,
            list(output_wavs),
            speed,
            timeout=self._timeout,
        ))


parler_engine = ParlerEngine(_MODEL_QUEUE, _MODEL_THREAD, _WAV_SUFFIX)


def available() -> bool:
    return parler_engine.available()


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    return parler_engine.synthesize(text, lang, output_mp3, speed)


def is_model_loaded() -> bool:
    return parler_engine.is_loaded()


def synthesize_batch(texts: List[str], lang: str, output_wavs: List[Path], speed: float = 1.0) -> bool:
    return parler_engine.synthesize_batch(texts, lang, output_wavs, speed)


def unload_model() -> None:
    parler_engine.unload()


__all__ = ["available", "synthesize", "synthesize_batch", "is_model_loaded", "unload_model"]
