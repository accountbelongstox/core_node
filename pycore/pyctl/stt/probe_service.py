"""Cross-domain STT round-trip test orchestration."""

import array
import time
import wave
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.third_party.api import get_third_package_sherpa_onnx
from pycore.pyutils.stt.stt_orchestrator import (
    best_engine,
    engine_available,
    transcribe,
)
import pycore.pyutils.tts.sherpa_engine as sherpa_engine
from pycore.pyutils.tts.tts_orchestrator import synthesize as tts_synthesize


_SAMPLE_PHRASE = "the quick brown fox jumps over the lazy dog"
_WAV_ENGINES = {"vosk", "azure"}


def _make_wav_sample(phrase: str, output_path: Path) -> Optional[Path]:
    if not sherpa_engine.available() or get_third_package_sherpa_onnx() is None:
        return None
    tts = sherpa_engine._get_tts()
    if tts is None:
        return None
    audio = tts.generate(phrase, 0, speed=1.0)
    samples = getattr(audio, "samples", None)
    if samples is None:
        return None
    sample_rate = int(getattr(audio, "sample_rate", 22050))
    pcm_samples = array.array(
        "h",
        (max(-32768, min(32767, int(sample * 32767))) for sample in samples),
    )
    with wave.open(str(output_path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_samples.tobytes())
    return output_path


def _make_sample_clip(language: str, engine: str, phrase: str) -> Optional[Path]:
    output_dir = TMP_DIR / "pycore_stt_test"
    output_dir.mkdir(parents=True, exist_ok=True)
    if engine in _WAV_ENGINES:
        return _make_wav_sample(phrase, output_dir / "sample.wav")
    output_path = output_dir / "sample.mp3"
    result = tts_synthesize(phrase, language, output_path)
    if result.get("success") and output_path.exists() and output_path.stat().st_size > 0:
        return output_path
    return None


def test(
    engine: Optional[str] = None,
    language: str = "en",
    text: Optional[str] = None,
    model: Optional[str] = None,
    **extra_params: Any,
) -> Dict[str, Any]:
    """Synthesize a phrase and recognize it through one STT engine."""
    del extra_params
    name = engine or best_engine()
    if not name:
        return {
            "success": False,
            "engine": None,
            "text": "",
            "latency_ms": 0,
            "route": "local.stt.test",
            "error": "no STT engine available",
        }
    if not engine_available(name):
        return {
            "success": False,
            "engine": name,
            "text": "",
            "latency_ms": 0,
            "route": "local.stt.test",
            "error": f"{name} unavailable",
        }

    phrase = (text or "").strip() or _SAMPLE_PHRASE
    sample = _make_sample_clip(language, name, phrase)
    if sample is None:
        ColorPrint.yellow("[stt] Could not produce the round-trip sample clip")
        return {
            "success": False,
            "engine": name,
            "text": "",
            "latency_ms": 0,
            "route": "local.stt.test",
            "error": "could not produce a sample clip",
        }

    started_at = time.monotonic()
    recognized = transcribe(name, sample, language, model=model)
    latency_ms = round((time.monotonic() - started_at) * 1000)
    success = bool((recognized or "").strip())
    result: Dict[str, Any] = {
        "success": success,
        "engine": name,
        "text": recognized,
        "latency_ms": latency_ms,
        "route": "local.stt.test",
        "phrase": phrase,
        "path": str(sample),
        "language": language,
        "error": None if success else "engine returned empty text",
    }
    if model:
        result["model"] = model
    return result


__all__ = ["test"]
