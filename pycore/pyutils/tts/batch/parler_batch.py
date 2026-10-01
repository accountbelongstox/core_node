# -*- coding: utf-8 -*-
"""Parler-TTS batch word synthesis (strategy 3: native batched generate).

Uses the official Parler-TTS batch pattern (left-padding + one batched
``model.generate`` over the word list, sliced per item via ``audios_length``)
implemented in ``ParlerEngine.synthesize_batch``. Each word comes back as its
own wav and is converted to mp3. Fallback: serial per-word synthesis.
"""

from pathlib import Path
from typing import List, Optional, Sequence

from pycore.pyutils.tts.batch import batch_common
from pycore.pyutils.tts.batch.batch_common import BatchItem, BatchResult
from pycore.pyutils.tts.parler_engine import parler_engine


def _synthesize_group(
    group: Sequence[str], lang: str, out_dir: Path, start_index: int, speed: float, result: BatchResult,
) -> List[BatchItem]:
    wav_paths = [
        batch_common.temp_wav(".parler_batch.wav", f"{batch_common.safe_name(start_index + offset, word)}_")
        for offset, word in enumerate(group)
    ]
    if parler_engine.synthesize_batch(list(group), lang, wav_paths, speed):
        result.merged_used = True
        return batch_common.convert_wav_items_mp3(wav_paths, group, out_dir, start_index)
    for wav_path in wav_paths:
        wav_path.unlink(missing_ok=True)
    result.fallback_used = True
    return batch_common.serial_fallback(parler_engine, group, lang, out_dir, start_index, speed)


def synthesize_words(
    words: Sequence[str],
    lang: str = "en",
    out_dir: Optional[Path] = None,
    speed: float = 1.0,
) -> BatchResult:
    """Batch-synthesize words to per-word mp3 files in out_dir."""
    return batch_common.run_synthesize_words(
        parler_engine, words, lang, out_dir, speed, parler_engine.available, _synthesize_group,
    )


__all__ = ["synthesize_words"]
