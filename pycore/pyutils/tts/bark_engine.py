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
  BARK_VOICE_PRESET   - voice preset string (default: v2/<language>_speaker_6)
Long text is split by the shared chunker (tts_text_chunking via
chunked_synthesis) so no chunk exceeds Bark's ~13 s generation window.
"""

import os
from pathlib import Path
from typing import Any, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.text_parsing import normalize_language_code
from pycore.pyfoundations.third_party.api import (
    get_third_package_numpy,
    get_third_package_scipy,
    get_third_package_torch,
    get_third_package_transformers,
)
from pycore.pyutils.common.model_tiers import hf_allow_patterns, runtime_engine_model
from pycore.pyutils.common.hf_local_weights import resolve_model_id
from pycore.pyutils.tts import chunked_synthesis
from pycore.pyutils.tts.tts_engine import SerializedModelEngine

_ENGINE = "bark"
_PRESET_SPEAKER = 6
# Languages with official v2 speaker presets (suno/bark voice library).
_PRESET_LANGUAGES = frozenset({
    "en", "de", "es", "fr", "hi", "it", "ja", "ko", "pl", "pt", "ru", "tr", "zh",
})
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


def _local_model_dir() -> Optional[str]:
    """Local weights dir (explicit BARK_MODEL dir or the verified staging
    weights); None when missing - runtime never downloads."""
    explicit = (os.environ.get("BARK_MODEL") or "").strip()
    if explicit:
        return explicit if Path(explicit).is_dir() else None
    try:
        tier = runtime_engine_model("bark")
    except Exception as exc:  # noqa: BLE001 - tier table boundary; keep the default model
        ColorPrint.gray(f"[bark] model tier lookup failed: {exc}")
        tier = "suno/bark"
    resolved = resolve_model_id(
        "BARK_DIR",
        "bark",
        tier,
        static_sizes=_STATIC_MODEL_MIN_BYTES.get(tier),
        allow_patterns=hf_allow_patterns("bark"),
    )
    return resolved if Path(resolved).is_dir() else None


def _voice_preset(lang: str) -> str:
    explicit = (os.environ.get("BARK_VOICE_PRESET") or "").strip()
    if explicit:
        return explicit
    code = normalize_language_code(lang)
    return f"v2/{code if code in _PRESET_LANGUAGES else 'en'}_speaker_{_PRESET_SPEAKER}"


class BarkEngine(SerializedModelEngine):
    boot_strict_install = True

    def model_ready(self) -> bool:
        return _local_model_dir() is not None

    def load_resource(self) -> Any:
        model_id = _local_model_dir()
        if model_id is None:
            ColorPrint.red(f"[bark] local weights missing; run {self.installer_hint()}")
            return None
        dev = _device()
        transformers = get_third_package_transformers()
        processor_class = getattr(transformers, "AutoProcessor", None)
        model_class = getattr(transformers, "BarkModel", None)
        if processor_class is None or model_class is None:
            ColorPrint.red("[bark] transformers Bark classes are unavailable")
            return None
        processor = processor_class.from_pretrained(model_id, local_files_only=True)
        model = model_class.from_pretrained(model_id, local_files_only=True)
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
        del speed
        scipy = get_third_package_scipy()
        if scipy is None:
            ColorPrint.red("[bark] scipy is unavailable")
            return False
        preset = _voice_preset(lang)
        samples, rate, error, _stats = chunked_synthesis.synthesize_samples_chunked(
            _ENGINE,
            text,
            lambda chunk: self._generate(resource, chunk, preset),
        )
        if samples is None:
            ColorPrint.red(f"[bark] generate failed: {error or 'no audio'}")
            return False
        np = get_third_package_numpy()
        scipy.io.wavfile.write(str(output_wav), int(rate), np.asarray(samples, dtype=np.float32))
        return True

    def _generate(self, resource: Any, text: str, preset: str) -> Optional[Tuple[Any, int]]:
        processor, model = resource
        dev = _device()
        inputs = processor(text, voice_preset=preset, return_tensors="pt")
        if dev != "cpu":
            inputs = {key: value.to(dev) for key, value in inputs.items()}
        audio = model.generate(**inputs)
        arr = audio.cpu().numpy().squeeze()
        if arr.ndim > 1:
            arr = arr.reshape(-1)
        return arr, int(getattr(model.generation_config, "sample_rate", 24000))


bark_engine = BarkEngine(_ENGINE)


__all__ = ["BarkEngine", "bark_engine"]
