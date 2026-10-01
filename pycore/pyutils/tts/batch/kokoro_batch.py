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
KOKORO_BATCH_MERGED=1. There is no per-word fallback: a failed group reports
every word as failed. Languages Kokoro does not support (engine_policy) fail
explicitly instead of being read with the English phonemizer.
"""

import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.tts import runtime_profile, word_audio_cache
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.tts.batch import batch_common
from pycore.pyutils.tts.batch import batch_constants as const
from pycore.pyutils.tts.batch import resource_monitor
from pycore.pyutils.tts.batch.batch_common import BatchItem, BatchResult
from pycore.pyutils.tts.batch.kokoro_live import kokoro_live
from pycore.pyutils.tts.engine_policy import tts_engine_supports_language
from pycore.pyutils.tts.kokoro_engine import kokoro_engine

_ENGINE = "kokoro"
ERROR_GROUP_FAILED = "kokoro_batch_group_failed"
ERROR_LANGUAGE_UNSUPPORTED = "word_batch_language_unsupported"
ERROR_EMPTY_WORD = "word_batch_empty_word"
_MERGED_ENV = "KOKORO_BATCH_MERGED"
_ENCODE_WORKERS = 4


def _merged_enabled() -> bool:
    return (os.environ.get(_MERGED_ENV) or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _generate_merged_on_owner(merged_text: str, speed: float) -> Optional[Tuple[Any, int]]:
    """Run inside the kokoro serialized worker thread; returns raw samples."""
    tts = kokoro_engine.resource()
    if tts is None:
        return None
    return kokoro_engine.generate_samples(tts, merged_text, speed)


def _generate_group_on_owner(
    texts: Sequence[str],
    speed: float,
    start_index: int = 0,
) -> Optional[Tuple[List[Any], int]]:
    """Serial per-word generation in ONE serialized-queue call (batched serial)."""
    tts = kokoro_engine.resource()
    if tts is None:
        return None
    samples_list: List[Any] = []
    sample_rate = 0
    for offset, text in enumerate(texts):
        began = time.monotonic()
        generated = kokoro_engine.generate_samples(tts, text, speed)
        if generated is None:
            return None
        samples, sample_rate = generated
        elapsed_ms = int((time.monotonic() - began) * 1000)
        duration_ms = int(len(samples) * 1000 / sample_rate) if sample_rate > 0 else 0
        kokoro_live.word_generated(start_index + offset, text, elapsed_ms, duration_ms)
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
    kokoro_live.group_started(start_index, group)
    items = _synthesize_group_items(group, lang, out_dir, start_index, speed, result)
    kokoro_live.group_finished([
        {
            "index": item.index,
            "word": item.text,
            "ok": item.ok,
            "encode_ms": item.duration_ms,
            "error": item.error,
        }
        for item in items
    ])
    return items


def _synthesize_group_items(
    group: Sequence[str],
    lang: str,
    out_dir: Path,
    start_index: int,
    speed: float,
    result: BatchResult,
) -> List[BatchItem]:
    if _merged_enabled():
        merged = batch_common.merge_words(group, lang)
        generated = kokoro_engine.call_on_owner(_generate_merged_on_owner, merged, speed)
        if generated is not None:
            samples, sample_rate = generated
            ranges = batch_common.split_merged_samples(samples, sample_rate, len(group))
            if ranges is not None and batch_common.plausible_ranges(ranges, sample_rate):
                result.merged_used = True
                return batch_common.write_segments_mp3(
                    samples, sample_rate, ranges, group, out_dir, start_index
                )
            ColorPrint.yellow("[kokoro-batch] merged split rejected; batched serial fallback")

    batched = kokoro_engine.call_on_owner(_generate_group_on_owner, list(group), speed, start_index)
    if batched is not None:
        samples_list, sample_rate = batched
        return batch_common.write_word_samples_mp3(
            samples_list, sample_rate, group, out_dir, start_index, _ENCODE_WORKERS
        )

    return [
        BatchItem(index=start_index + offset, text=word, output_path="", error=ERROR_GROUP_FAILED)
        for offset, word in enumerate(group)
    ]


def synthesize_words(
    words: Sequence[str],
    lang: str = "en",
    out_dir: Optional[Path] = None,
    speed: float = 1.0,
    md5s: Sequence[str] = (),
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
        snap_end = resource_monitor.snapshot()
        result.resources = resource_monitor.run_resources(snap_start, snap_end)
        resource_monitor.log_run(_ENGINE, snap_start, snap_end)
        return result

    # Busy-protect the run: without a lease the managed-service watchdog can
    # idle-unload kokoro MID-BATCH (the batch path bypasses the orchestrator's
    # activity tracking), forcing an expensive unload+reload between groups.
    # No-op when kokoro is not registered (plain CLI use).
    index = 0
    kokoro_live.begin_batch(
        sum(1 for word in words if word and word.strip()),
        const.group_size(),
        runtime_profile.WORD_BATCH_DEVICE,
        md5s,
    )
    try:
        with managed_services.lease(_ENGINE):
            for group in batch_common.group_words(words):
                result.items.extend(
                    _synthesize_group(group, lang, target_dir, index, speed, result)
                )
                index += len(group)
    finally:
        result.elapsed_ms = int((time.time() - began) * 1000)
        snap_end = resource_monitor.snapshot()
        result.resources = resource_monitor.run_resources(snap_start, snap_end)
        kokoro_live.end_batch(
            result.elapsed_ms,
            result.merged_used,
            result.fallback_used,
            result.resources,
        )
    resource_monitor.log_run(_ENGINE, snap_start, snap_end)
    ColorPrint.green(
        f"[kokoro-batch] {sum(1 for i in result.items if i.ok)}/{len(result.items)} "
        f"words ok in {result.elapsed_ms}ms (merged={result.merged_used}, "
        f"fallback={result.fallback_used})"
    )
    return result


def synthesize_words_to_cache(
    words: Sequence[str], lang: str, out_dir: Path, md5s: Sequence[str] = (),
) -> List[Dict[str, Any]]:
    """The ONE pinned word-batch entry (word_audio lane + audio orchestration).

    Runs a single Kokoro batch, validates every clip and stores it in the
    unified word_audio_cache under ``runtime_profile.WORD_BATCH_ENGINE``.
    Returns one ``{text, ok, audio_path, scratch, provider, error}`` per input
    word, in order; ``scratch`` marks an ``out_dir`` file the caller owns
    (only when the cache store failed). ``md5s`` holds the Laravel md5 of
    each word, by index, when the caller has it.
    """
    provider = runtime_profile.WORD_BATCH_ENGINE
    supported = tts_engine_supports_language(provider, lang)
    # group_words drops empty words, so items align with the non-empty inputs only.
    synthesized = [index for index, word in enumerate(words) if word and word.strip()]
    result = (
        synthesize_words(
            [words[index] for index in synthesized],
            lang,
            out_dir,
            md5s=[str(md5s[index]) if index < len(md5s) else "" for index in synthesized],
        )
        if supported and synthesized
        else BatchResult(engine=_ENGINE)
    )
    items = {index: result.items[position] for position, index in enumerate(synthesized) if position < len(result.items)}
    outcomes: List[Dict[str, Any]] = []
    for index, word in enumerate(words):
        item = items.get(index)
        outcome: Dict[str, Any] = {
            "text": word, "ok": False, "audio_path": "", "scratch": False, "provider": provider, "error": "",
        }
        outcomes.append(outcome)
        if not supported:
            outcome["error"] = f"{ERROR_LANGUAGE_UNSUPPORTED}: {provider} {lang}"
            continue
        if index not in synthesized:
            outcome["error"] = ERROR_EMPTY_WORD
            continue
        if item is None or not item.ok:
            outcome["error"] = item.error if item is not None and item.error else "Kokoro batch synthesis produced no audio"
            continue
        output_path = str(item.output_path)
        valid, detail = validate_mp3(output_path)
        if not valid:
            outcome["error"] = f"invalid Kokoro batch audio: {detail}"
            continue
        word_audio_cache.save_to_cache(
            word, lang, provider, output_path, str(md5s[index] or "") if index < len(md5s) else "",
        )
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


__all__ = ["synthesize_words", "synthesize_words_to_cache"]
