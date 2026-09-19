# -*- coding: utf-8 -*-
"""Kokoro batch word synthesis (strategy 1: merge text + silence split).

Kokoro-82M (sherpa-onnx) has no official batch API, but it is near-instant per
word on CPU. This library merges a group of words into ONE synthesis (so the
per-call overhead is paid once), then splits the merged audio back into
per-word mp3 files with the shared silence splitter. When the split does not
recover exactly one segment per word, it falls back to serial per-word
synthesis — the result set is identical either way.

Standalone:
  python -m pycore.pyutils.tts.batch.kokoro_batch words.txt --lang en
  python -m pycore.pyutils.tts.batch.kokoro_batch --words apple banana orange
"""

import os
import time
from pathlib import Path
from typing import Any, List, Optional, Sequence, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import call_serialized
from pycore.pyfoundations.third_party.api import get_third_package_sherpa_onnx
import pycore.pyutils.tts.kokoro_engine as kokoro_engine
from pycore.pyutils.tts.batch import batch_common
from pycore.pyutils.tts.batch import batch_constants as const
from pycore.pyutils.tts.batch.batch_common import BatchItem, BatchResult

_ENGINE = "kokoro"
_SYNTH_TIMEOUT_S = 900.0


def _speaker_id() -> int:
    try:
        return int(os.environ.get("KOKORO_TTS_SID", os.environ.get("SHERPA_TTS_SID", "0")) or "0")
    except ValueError:
        return 0


def _generate_merged_on_owner(merged_text: str, speed: float) -> Optional[Tuple[Any, int]]:
    """Run inside the kokoro serialized worker thread; returns raw samples."""
    tts = kokoro_engine._get_tts()
    if tts is None:
        return None
    sid = _speaker_id()
    try:
        try:
            audio = tts.generate(merged_text, sid, speed=float(speed))
        except TypeError:
            sherpa = get_third_package_sherpa_onnx()
            if sherpa is None:
                return None
            gen = sherpa.GenerationConfig()
            gen.sid = sid
            gen.speed = float(speed)
            audio = tts.generate(merged_text, gen)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[kokoro-batch] merged generate failed: {exc}")
        return None
    samples = getattr(audio, "samples", None)
    sample_rate = int(getattr(audio, "sample_rate", 22050) or 22050)
    if samples is None:
        return None
    return samples, sample_rate


def _synthesize_group(
    group: Sequence[str],
    lang: str,
    out_dir: Path,
    start_index: int,
    speed: float,
    result: BatchResult,
) -> List[BatchItem]:
    merged = batch_common.merge_words(group, lang)
    generated = call_serialized(
        kokoro_engine._MODEL_QUEUE,
        _generate_merged_on_owner,
        merged,
        speed,
        timeout=_SYNTH_TIMEOUT_S,
    )
    if generated is not None:
        samples, sample_rate = generated
        ranges = batch_common.split_merged_samples(samples, sample_rate, len(group))
        if ranges is not None:
            result.merged_used = True
            return batch_common.write_segments_mp3(
                samples, sample_rate, ranges, group, out_dir, start_index
            )
    result.fallback_used = True
    return batch_common.serial_fallback(
        kokoro_engine.synthesize, group, lang, out_dir, start_index, speed
    )


def synthesize_words(
    words: Sequence[str],
    lang: str = "en",
    out_dir: Optional[Path] = None,
    speed: float = 1.0,
) -> BatchResult:
    """Batch-synthesize words to per-word mp3 files in out_dir."""
    began = time.time()
    target_dir = Path(out_dir) if out_dir else const.engine_output_dir(_ENGINE)
    target_dir.mkdir(parents=True, exist_ok=True)
    result = BatchResult(engine=_ENGINE)
    if not kokoro_engine.available():
        ColorPrint.yellow("[kokoro-batch] engine unavailable")
        result.elapsed_ms = int((time.time() - began) * 1000)
        return result

    index = 0
    for group in batch_common.group_words(words):
        result.items.extend(
            _synthesize_group(group, lang, target_dir, index, speed, result)
        )
        index += len(group)
    result.elapsed_ms = int((time.time() - began) * 1000)
    ColorPrint.green(
        f"[kokoro-batch] {sum(1 for i in result.items if i.ok)}/{len(result.items)} "
        f"words ok in {result.elapsed_ms}ms (merged={result.merged_used}, "
        f"fallback={result.fallback_used})"
    )
    return result


if __name__ == "__main__":
    batch_common.run_batch_cli(_ENGINE, synthesize_words)


__all__ = ["synthesize_words"]
