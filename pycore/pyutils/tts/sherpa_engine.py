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
from typing import Any, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_shared_download_cache_dir
from pycore.pyfoundations.third_party.api import get_third_package_sherpa_onnx
from pycore.pyutils.tts import chunked_synthesis
from pycore.pyutils.tts.audio_utils import samples_to_mp3
from pycore.pyutils.tts.tts_engine import SerializedModelEngine
from pycore.pyutils.tts.tts_text_sanitize import sanitize_tts_text

_KOKORO_PHONEMIZER_LANGUAGE_ENV = "SHERPA_KOKORO_LANG"
_KOKORO_PHONEMIZER_LANGUAGE_DEFAULT = "en-gb-x-rp"
_DEFAULT_SID_ENV = "SHERPA_TTS_SID"


def find_model_file(root: Path, pattern: str) -> Optional[Path]:
    if not root.is_dir():
        return None
    matches = sorted(root.rglob(pattern))
    return matches[0] if matches else None


def model_files_present(root: Path) -> bool:
    return (
        root.is_dir()
        and find_model_file(root, "*.onnx") is not None
        and find_model_file(root, "tokens.txt") is not None
    )


def _kokoro_phonemizer_language() -> str:
    return (
        os.environ.get(_KOKORO_PHONEMIZER_LANGUAGE_ENV)
        or _KOKORO_PHONEMIZER_LANGUAGE_DEFAULT
    ).strip()


def _kokoro_lexicons(model_root: Path) -> List[Path]:
    """Kokoro multi-lang lexicons to load: gb-en + zh by default.

    The official package ships BOTH lexicon-us-en.txt and lexicon-gb-en.txt,
    whose headwords overlap ~159k, and sherpa logs "Duplicated word ... Ignore
    it." for every overlap at load - pure noise: the FIRST loaded pronunciation
    wins. Upstream guidance (k2-fsa sherpa-onnx kokoro docs): pass only the
    lexicons you need. The configured phonemizer dialect selects the matching
    English lexicon; SHERPA_KOKORO_LEXICONS=a,b gives a full explicit list."""
    all_lex = sorted(model_root.rglob("lexicon-*.txt"))
    explicit = (os.environ.get("SHERPA_KOKORO_LEXICONS") or "").strip()
    if explicit:
        wanted = {name.strip() for name in explicit.split(",") if name.strip()}
        return [path for path in all_lex if path.name in wanted]
    use_gb = (
        _kokoro_phonemizer_language().lower().startswith("en-gb")
        or (os.environ.get("SHERPA_KOKORO_LEXICON_GB") or "").strip() == "1"
    )
    skipped = "lexicon-us-en.txt" if use_gb else "lexicon-gb-en.txt"
    picked = [path for path in all_lex if path.name != skipped]
    return picked or all_lex


# sherpa-onnx runs one inference thread unless told otherwise; measured per
# word (Kokoro, CPU): 1 thread 1.62s, 2 threads 0.92s, 4 threads 0.77s, 8
# threads 0.83s, so more than a few threads only steals cores from the GPU
# engines' host threads.
_INFERENCE_THREADS_MIN = 2
_INFERENCE_THREADS_MAX = 4


def inference_threads() -> int:
    """CPU inference threads of the sherpa-onnx model: half the host's logical
    cores, kept within the measured useful range."""
    return max(_INFERENCE_THREADS_MIN, min(_INFERENCE_THREADS_MAX, (os.cpu_count() or 1) // 2))


def build_offline_config(model_root: Path) -> Any:
    """Auto-detect the Kokoro / VITS layout in the model dir -> OfflineTtsConfig.

    Kokoro multi-lang ships lexicon-us-en/gb-en/zh; the official config passes
    the needed ones comma-joined so Chinese token ids resolve. Single-lexicon
    models (lexicon.txt) pass it as is."""
    sherpa = get_third_package_sherpa_onnx()
    onnx = find_model_file(model_root, "*.onnx")
    tokens = find_model_file(model_root, "tokens.txt")
    if sherpa is None or not onnx or not tokens:
        return None
    data_dir = str(find_model_file(model_root, "espeak-ng-data") or model_root)
    dict_dir = str(find_model_file(model_root, "dict") or "")
    multi_lex = _kokoro_lexicons(model_root)
    single_lex = find_model_file(model_root, "lexicon.txt")
    lexicon = ",".join(str(p) for p in multi_lex) if multi_lex else (str(single_lex) if single_lex else None)
    if lexicon:
        kokoro = sherpa.OfflineTtsKokoroModelConfig(
            model=str(onnx),
            tokens=str(tokens),
            lexicon=lexicon,
            voices=str(find_model_file(model_root, "voices.bin") or ""),
            data_dir=data_dir,
            dict_dir=dict_dir,
        )
        if hasattr(kokoro, "lang"):
            kokoro.lang = _kokoro_phonemizer_language()
        return sherpa.OfflineTtsConfig(
            model=sherpa.OfflineTtsModelConfig(kokoro=kokoro, num_threads=inference_threads(), provider="cpu")
        )
    vits = sherpa.OfflineTtsVitsModelConfig(
        model=str(onnx),
        tokens=str(tokens),
        lexicon=str(single_lex or ""),
        data_dir=data_dir,
        dict_dir=dict_dir,
    )
    return sherpa.OfflineTtsConfig(
        model=sherpa.OfflineTtsModelConfig(vits=vits, num_threads=inference_threads(), provider="cpu")
    )


class SherpaEngine(SerializedModelEngine):
    sid_env = _DEFAULT_SID_ENV
    release_gpu_on_unload = False
    unload_timeout = None

    def model_dir(self) -> Path:
        env = (os.environ.get("SHERPA_TTS_MODEL_DIR") or "").strip()
        return Path(env) if env else get_shared_download_cache_dir() / "tts" / "sherpa"

    def model_ready(self) -> bool:
        return model_files_present(self.model_dir())

    def is_kokoro(self) -> bool:
        return bool(_kokoro_lexicons(self.model_dir()))

    def runtime_reason(self) -> Optional[Any]:
        """Installed with model files present: no further hint (the memory
        gate is not reported for the sherpa family)."""
        return None

    def speaker_id(self) -> int:
        raw = os.environ.get(self.sid_env, os.environ.get(_DEFAULT_SID_ENV, "0")) or "0"
        return int(raw) if raw.strip().lstrip("-").isdigit() else 0

    def load_resource(self) -> Any:
        root = self.model_dir()
        config = build_offline_config(root)
        sherpa = get_third_package_sherpa_onnx()
        if config is None or sherpa is None:
            ColorPrint.red(f"[{self.name}] no usable model in {root}")
            return None
        try:
            tts = sherpa.OfflineTts(config)
        except Exception as exc:  # noqa: BLE001 - native model load boundary
            ColorPrint.red(f"[{self.name}] model load from {root} failed: {exc}")
            return None
        ColorPrint.green(f"[{self.name}] loaded model from {root}")
        return tts

    def _generate_one(self, tts: Any, text: str, speed: float) -> Optional[Tuple[Any, int]]:
        sherpa = get_third_package_sherpa_onnx()
        if sherpa is None:
            return None
        try:
            generation_config = sherpa.GenerationConfig()
            generation_config.sid = self.speaker_id()
            generation_config.speed = float(speed)
            if self.is_kokoro():
                generation_config.extra = {"lang": _kokoro_phonemizer_language()}
            audio = tts.generate(text, generation_config)
        except (AttributeError, TypeError):
            # sherpa-onnx builds without GenerationConfig take (text, sid, speed).
            try:
                audio = tts.generate(text, self.speaker_id(), speed=float(speed))
            except Exception as exc:  # noqa: BLE001 - native generation boundary
                ColorPrint.red(f"[{self.name}] generate failed for {len(text)} chars: {exc}")
                return None
        except Exception as exc:  # noqa: BLE001 - native generation boundary
            ColorPrint.red(f"[{self.name}] generate failed for {len(text)} chars: {exc}")
            return None
        samples = getattr(audio, "samples", None)
        if samples is None:
            return None
        return samples, int(getattr(audio, "sample_rate", 22050) or 22050)

    def generate_samples(self, tts: Any, text: str, speed: float) -> Optional[Tuple[Any, int]]:
        """Sanitized, protectively chunked generation; call on the owner thread."""
        cleaned = sanitize_tts_text(text)
        if not cleaned:
            ColorPrint.yellow(f"[{self.name}] text empty after sanitization; skipped")
            return None
        samples, sample_rate, error, stats = chunked_synthesis.synthesize_samples_chunked(
            self.name, cleaned, lambda chunk: self._generate_one(tts, chunk, speed),
        )
        if samples is None:
            ColorPrint.red(f"[{self.name}] generate failed: {error or 'no audio'}")
            return None
        if stats.get("chunked"):
            ColorPrint.gray(f"[{self.name}] generated {stats['chunk_count']} ordered text chunks")
        return samples, sample_rate

    def _generate_on_owner(self, text: str, speed: float) -> Optional[Tuple[Any, int]]:
        tts = self.resource()
        return None if tts is None else self.generate_samples(tts, text, speed)

    def generate(self, text: str, speed: float = 1.0) -> Optional[Tuple[Any, int]]:
        """(samples, sample_rate) of one text through the serialized owner."""
        if not self.available():
            return None
        return self.call_on_owner(self._generate_on_owner, text, speed)

    def render_output(self, resource: Any, text: str, lang: str, output: Path, speed: float) -> bool:
        generated = self.generate_samples(resource, text, speed)
        if generated is None:
            return False
        samples, sample_rate = generated
        return samples_to_mp3(samples, sample_rate, output)


sherpa_engine = SherpaEngine("sherpa")


__all__ = [
    "SherpaEngine",
    "build_offline_config",
    "find_model_file",
    "model_files_present",
    "sherpa_engine",
]
