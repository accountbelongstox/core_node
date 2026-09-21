# -*- coding: utf-8 -*-
"""Parler-TTS batch word synthesis (strategy 3: native batched generate).

Uses the official Parler-TTS batch pattern (left-padding + one batched
``model.generate`` over the word list, sliced per item via ``audios_length``)
implemented in ``parler_engine.synthesize_batch``. Each word comes back as its
own wav and is converted to mp3. Fallback: serial per-word synthesis.

Standalone:
  python -m pycore.pyutils.tts.batch.parler_batch words.txt --lang en
"""

import os
import tempfile
import time
from pathlib import Path
from typing import List, Optional, Sequence

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
import pycore.pyutils.tts.parler_engine as parler_engine
from pycore.pyutils.tts.batch import batch_common
from pycore.pyutils.tts.batch import batch_constants as const
from pycore.pyutils.tts.batch import resource_monitor
from pycore.pyutils.tts.batch.batch_common import BatchItem, BatchResult

_ENGINE = "parler"


def _synthesize_group(
    group: Sequence[str],
    lang: str,
    out_dir: Path,
    start_index: int,
    speed: float,
    result: BatchResult,
) -> List[BatchItem]:
    wav_paths: List[Path] = []
    for offset, word in enumerate(group):
        fd, tmp_name = tempfile.mkstemp(
            suffix=".parler_batch.wav",
            prefix=f"{batch_common.safe_name(start_index + offset, word)}_",
            dir=str(TMP_DIR),
        )
        os.close(fd)
        wav_paths.append(Path(tmp_name))
    if parler_engine.synthesize_batch(list(group), lang, wav_paths, speed):
        result.merged_used = True
        return batch_common.convert_wav_items_mp3(wav_paths, group, out_dir, start_index)
    for wav_path in wav_paths:
        try:
            wav_path.unlink()
        except OSError:
            pass
    result.fallback_used = True
    return batch_common.serial_fallback(
        parler_engine.synthesize, group, lang, out_dir, start_index, speed
    )


def synthesize_words(
    words: Sequence[str],
    lang: str = "en",
    out_dir: Optional[Path] = None,
    speed: float = 1.0,
) -> BatchResult:
    """Batch-synthesize words to per-word mp3 files in out_dir."""
    began = time.time()
    snap_start = resource_monitor.snapshot()
    target_dir = Path(out_dir) if out_dir else const.engine_output_dir(_ENGINE)
    target_dir.mkdir(parents=True, exist_ok=True)
    result = BatchResult(engine=_ENGINE)
    if not parler_engine.available():
        ColorPrint.yellow("[parler-batch] engine unavailable")
        result.elapsed_ms = int((time.time() - began) * 1000)
        resource_monitor.log_run(_ENGINE, snap_start, resource_monitor.snapshot())
        return result

    index = 0
    for group in batch_common.group_words(words):
        result.items.extend(
            _synthesize_group(group, lang, target_dir, index, speed, result)
        )
        index += len(group)
    result.elapsed_ms = int((time.time() - began) * 1000)
    resource_monitor.log_run(_ENGINE, snap_start, resource_monitor.snapshot())
    ColorPrint.green(
        f"[parler-batch] {sum(1 for i in result.items if i.ok)}/{len(result.items)} "
        f"words ok in {result.elapsed_ms}ms (batch={result.merged_used}, "
        f"fallback={result.fallback_used})"
    )
    return result


if __name__ == "__main__":
    batch_common.run_batch_cli(_ENGINE, synthesize_words)


__all__ = ["synthesize_words"]
