"""Cross-domain STT round-trip test orchestration: synthesize a phrase,
recognize it with ONE STT engine, and score the transcript against the phrase."""

import array
import difflib
import re
import time
import wave
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.stt.stt_orchestrator import stt_engine_registry, transcribe
from pycore.pyutils.tts.sherpa_engine import sherpa_engine
from pycore.pyutils.tts.tts_orchestrator import synthesize as tts_synthesize


_SAMPLE_PHRASE = "the quick brown fox jumps over the lazy dog"
_ROUTE = "local.stt.test"


def _normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", str(text or "").lower()).strip()


def similarity(expected: str, recognized: str) -> float:
    """0..1 similarity of the normalized phrase and transcript."""
    left, right = _normalize_text(expected), _normalize_text(recognized)
    if not left or not right:
        return 0.0
    return round(difflib.SequenceMatcher(None, left, right).ratio(), 4)


def _make_wav_sample(phrase: str, output_path: Path) -> Optional[Path]:
    generated = sherpa_engine.generate(phrase)
    if generated is None:
        return None
    samples, sample_rate = generated
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


def _make_sample_clip(language: str, needs_wav: bool, phrase: str) -> Optional[Path]:
    output_dir = TMP_DIR / "pycore_stt_test"
    output_dir.mkdir(parents=True, exist_ok=True)
    if needs_wav:
        return _make_wav_sample(phrase, output_dir / "sample.wav")
    output_path = output_dir / "sample.mp3"
    result = tts_synthesize(phrase, language, output_path)
    if result.get("success") and output_path.exists() and output_path.stat().st_size > 0:
        return output_path
    return None


def _failure(name: Optional[str], error: str) -> Dict[str, Any]:
    return {
        "success": False,
        "engine": name,
        "text": "",
        "latency_ms": 0,
        "route": _ROUTE,
        "error": error,
    }


def test(
    engine: Optional[str] = None,
    language: str = "en",
    text: Optional[str] = None,
    model: Optional[str] = None,
    **extra_params: Any,
) -> Dict[str, Any]:
    """Synthesize a phrase and recognize it through one STT engine; ``similarity``
    scores the transcript against the phrase (informational)."""
    del extra_params
    name = engine or stt_engine_registry.best()
    if not name:
        return _failure(None, "no STT engine available")
    if not stt_engine_registry.available(name):
        return _failure(name, f"{name} unavailable")

    phrase = (text or "").strip() or _SAMPLE_PHRASE
    sample = _make_sample_clip(language, stt_engine_registry.get(name).needs_wav, phrase)
    if sample is None:
        ColorPrint.yellow("[stt] Could not produce the round-trip sample clip")
        return _failure(name, "could not produce a sample clip")

    started_at = time.monotonic()
    recognized = transcribe(name, sample, language, model=model)
    latency_ms = round((time.monotonic() - started_at) * 1000)
    success = bool((recognized or "").strip())
    result: Dict[str, Any] = {
        "success": success,
        "engine": name,
        "text": recognized,
        "similarity": similarity(phrase, recognized),
        "latency_ms": latency_ms,
        "route": _ROUTE,
        "phrase": phrase,
        "path": str(sample),
        "language": language,
        "error": None if success else "engine returned empty text",
    }
    if model:
        result["model"] = model
    return result


__all__ = ["similarity", "test"]
