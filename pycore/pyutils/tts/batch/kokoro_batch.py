# -*- coding: utf-8 -*-
"""Kokoro batch word synthesis (primary: batched serial; merged split opt-in).

Kokoro-82M (sherpa-onnx) has no official batch API and NO pause/break control
token — pauses come from punctuation alone (official: hexgrad/kokoro). Measured
on word lists ("apple, banana, orange, grape"): the merged reading is ~2x
faster than solo readings with irregular 30-160ms pauses, the same range as
MID-WORD stop closures ("banana" carries an ~80ms internal silence even solo),
so silence-ranked splitting can cut inside a word and the plausibility guard
then rejects the split ("merged split rejected; batched serial fallback").

Primary path is therefore batched serial: all words of the group are generated
in ONE call on the kokoro serialized worker and encoded to mp3 in parallel
(ffmpeg startup dominates short clips) — deterministic per-word boundaries by
construction. The merge-then-split experiment remains available via
KOKORO_BATCH_MERGED=1; plain per-word serial is the last fallback.

Standalone:
  python -m pycore.pyutils.tts.batch.kokoro_batch words.txt --lang en
  python -m pycore.pyutils.tts.batch.kokoro_batch --words apple banana orange
"""

import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import call_serialized
import pycore.pyutils.tts.kokoro_engine as kokoro_engine
import pycore.pyutils.tts.sherpa_engine as sherpa_engine
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.tts import runtime_profile, word_audio_cache
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.tts.batch import batch_common
from pycore.pyutils.tts.batch import batch_constants as const
from pycore.pyutils.tts.batch import resource_monitor
from pycore.pyutils.tts.batch.batch_common import BatchItem, BatchResult

_ENGINE = "kokoro"
_SYNTH_TIMEOUT_S = 900.0
_ENCODE_WORKERS = 4
_MERGED_ENV = "KOKORO_BATCH_MERGED"


def _merged_enabled() -> bool:
    return (os.environ.get(_MERGED_ENV) or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _speaker_id() -> int:
    return sherpa_engine._speaker_id("KOKORO_TTS_SID")


def _generate_on_owner(tts: Any, text: str, sid: int, speed: float) -> Optional[Tuple[Any, int]]:
    return sherpa_engine._generate_samples(
        tts,
        text,
        sid,
        speed,
        True,
        "kokoro",
        "kokoro-batch",
    )


def _generate_merged_on_owner(merged_text: str, speed: float) -> Optional[Tuple[Any, int]]:
    """Run inside the kokoro serialized worker thread; returns raw samples."""
    tts = kokoro_engine._get_tts()
    if tts is None:
        return None
    return _generate_on_owner(tts, merged_text, _speaker_id(), speed)


def _generate_group_on_owner(texts: Sequence[str], speed: float) -> Optional[Tuple[List[Any], int]]:
    """Serial per-word generation in ONE serialized-queue call (batched serial)."""
    tts = kokoro_engine._get_tts()
    if tts is None:
        return None
    sid = _speaker_id()
    samples_list: List[Any] = []
    sample_rate = 0
    for text in texts:
        generated = _generate_on_owner(tts, text, sid, speed)
        if generated is None:
            return None
        samples, sample_rate = generated
        samples_list.append(samples)
    return samples_list, sample_rate


def _synthesize_group(
    group: Sequence[str],
    lang: str,
    out_dir: Path,
    start_index: int,
    speed: float,
    result: BatchResult,
) -> List[BatchItem]:
    if _merged_enabled():
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
            if ranges is not None and batch_common.plausible_ranges(ranges, sample_rate):
                result.merged_used = True
                return batch_common.write_segments_mp3(
                    samples, sample_rate, ranges, group, out_dir, start_index
                )
            ColorPrint.yellow("[kokoro-batch] merged split rejected; batched serial fallback")

    batched = call_serialized(
        kokoro_engine._MODEL_QUEUE,
        _generate_group_on_owner,
        list(group),
        speed,
        timeout=_SYNTH_TIMEOUT_S,
    )
    if batched is not None:
        samples_list, sample_rate = batched
        return batch_common.write_word_samples_mp3(
            samples_list, sample_rate, group, out_dir, start_index, _ENCODE_WORKERS
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
    snap_start = resource_monitor.snapshot()
    target_dir = Path(out_dir) if out_dir else const.engine_output_dir(_ENGINE)
    target_dir.mkdir(parents=True, exist_ok=True)
    result = BatchResult(engine=_ENGINE)
    if not kokoro_engine.available():
        ColorPrint.yellow("[kokoro-batch] engine unavailable")
        result.elapsed_ms = int((time.time() - began) * 1000)
        resource_monitor.log_run(_ENGINE, snap_start, resource_monitor.snapshot())
        return result

    # Busy-protect the run: without a lease the managed-service watchdog can
    # idle-unload kokoro MID-BATCH (the batch path bypasses the orchestrator's
    # activity tracking), forcing an expensive unload+reload between groups.
    # No-op when kokoro is not registered (plain CLI use).
    index = 0
    with managed_services.lease(_ENGINE):
        for group in batch_common.group_words(words):
            result.items.extend(
                _synthesize_group(group, lang, target_dir, index, speed, result)
            )
            index += len(group)
    result.elapsed_ms = int((time.time() - began) * 1000)
    resource_monitor.log_run(_ENGINE, snap_start, resource_monitor.snapshot())
    ColorPrint.green(
        f"[kokoro-batch] {sum(1 for i in result.items if i.ok)}/{len(result.items)} "
        f"words ok in {result.elapsed_ms}ms (merged={result.merged_used}, "
        f"fallback={result.fallback_used})"
    )
    return result


def synthesize_words_to_cache(words: Sequence[str], lang: str, out_dir: Path) -> List[Dict[str, Any]]:
    """The ONE pinned word-batch entry (word_audio lane + audio orchestration).

    Runs a single Kokoro batch, validates every clip and stores it in the
    unified word_audio_cache under ``runtime_profile.WORD_BATCH_ENGINE``.
    Returns one ``{text, ok, audio_path, scratch, provider, error}`` per input
    word, in order; ``scratch`` marks an ``out_dir`` file the caller owns
    (only when the cache store failed).
    """
    provider = runtime_profile.WORD_BATCH_ENGINE
    result = synthesize_words(list(words), lang, out_dir)
    outcomes: List[Dict[str, Any]] = []
    for index, word in enumerate(words):
        item = result.items[index] if index < len(result.items) else None
        outcome: Dict[str, Any] = {
            "text": word, "ok": False, "audio_path": "", "scratch": False, "provider": provider, "error": "",
        }
        outcomes.append(outcome)
        if item is None or not item.ok:
            outcome["error"] = item.error if item is not None and item.error else "Kokoro batch synthesis produced no audio"
            continue
        output_path = str(item.output_path)
        valid, detail = validate_mp3(output_path)
        if not valid:
            outcome["error"] = f"invalid Kokoro batch audio: {detail}"
            continue
        word_audio_cache.save_to_cache(word, lang, provider, output_path)
        cache_path = word_audio_cache.get_cache_path(word, lang, provider)
        outcome["ok"] = True
        if os.path.exists(cache_path) and validate_mp3(cache_path)[0]:
            try:
                os.remove(output_path)
            except OSError:
                pass
            outcome["audio_path"] = cache_path
        else:
            outcome["audio_path"] = output_path
            outcome["scratch"] = True
    return outcomes


if __name__ == "__main__":
    batch_common.run_batch_cli(_ENGINE, synthesize_words)


__all__ = ["synthesize_words", "synthesize_words_to_cache"]
