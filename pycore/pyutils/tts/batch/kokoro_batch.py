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
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.common.phrase_pipeline_contract import PHRASE_AUDIO_BATCH_CHUNK_SIZE
from pycore.pyutils.tts import phrase_audio_cache, runtime_profile, word_audio_cache
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
ERROR_PHRASE_LANGUAGE_UNSUPPORTED = "phrase_batch_language_unsupported"
ERROR_EMPTY_PHRASE = "phrase_batch_empty_phrase"
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
    group_size: Optional[int] = None,
) -> BatchResult:
    """Batch-synthesize words to per-word mp3 files in out_dir, in groups of
    ``group_size`` (default: the word batch group size)."""
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
        group_size or const.group_size(),
        runtime_profile.WORD_BATCH_DEVICE,
        md5s,
    )
    try:
        with managed_services.lease(_ENGINE):
            for group in batch_common.group_words(words, group_size):
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


def _synthesize_batch_to_cache(
    texts: Sequence[str],
    lang: str,
    out_dir: Optional[Path],
    md5s: Sequence[str],
    group_size: Optional[int],
    speakable: Callable[[str], bool],
    save: Callable[[int, str, str], None],
    cache_path: Callable[[str], str],
    empty_error: str,
    unsupported_error: str,
) -> List[Dict[str, Any]]:
    """The ONE Kokoro batch-to-cache run of every clip kind: synthesizes the
    speakable texts in one batch, validates each clip, ``save`` stores it in
    the kind's cache and ``cache_path`` names the stored file. One
    ``{text, ok, audio_path, scratch, provider, error}`` per input, in order;
    ``scratch`` marks an ``out_dir`` file the caller owns (only when the
    cache store failed)."""
    provider = runtime_profile.WORD_BATCH_ENGINE
    supported = tts_engine_supports_language(provider, lang)
    # group_words drops empty texts, so items align with the speakable inputs only.
    synthesized = [index for index, text in enumerate(texts) if speakable(text)]
    result = (
        synthesize_words(
            [texts[index] for index in synthesized],
            lang,
            out_dir,
            md5s=[str(md5s[index]) if index < len(md5s) else "" for index in synthesized],
            group_size=group_size,
        )
        if supported and synthesized
        else BatchResult(engine=_ENGINE)
    )
    items = {index: result.items[position] for position, index in enumerate(synthesized) if position < len(result.items)}
    outcomes: List[Dict[str, Any]] = []
    for index, text in enumerate(texts):
        item = items.get(index)
        outcome: Dict[str, Any] = {
            "text": text, "ok": False, "audio_path": "", "scratch": False, "provider": provider, "error": "",
        }
        outcomes.append(outcome)
        if not supported:
            outcome["error"] = f"{unsupported_error}: {provider} {lang}"
            continue
        if index not in synthesized:
            outcome["error"] = empty_error
            continue
        if item is None or not item.ok:
            outcome["error"] = item.error if item is not None and item.error else "Kokoro batch synthesis produced no audio"
            continue
        output_path = str(item.output_path)
        valid, detail = validate_mp3(output_path)
        if not valid:
            outcome["error"] = f"invalid Kokoro batch audio: {detail}"
            continue
        save(index, text, output_path)
        stored_path = cache_path(text)
        outcome["ok"] = True
        if os.path.exists(stored_path) and validate_mp3(stored_path)[0]:
            try:
                os.remove(output_path)
            except OSError:
                pass
            outcome["audio_path"] = stored_path
        else:
            outcome["audio_path"] = output_path
            outcome["scratch"] = True
    return outcomes


def synthesize_words_to_cache(
    words: Sequence[str], lang: str, out_dir: Path, md5s: Sequence[str] = (),
) -> List[Dict[str, Any]]:
    """The ONE pinned word-batch entry (word_audio lane + audio orchestration).

    Runs a single Kokoro batch, validates every clip and stores it in the
    unified word_audio_cache under ``runtime_profile.WORD_BATCH_ENGINE``
    (outcomes: see ``_synthesize_batch_to_cache``). ``md5s`` holds the Laravel
    md5 of each word, by index, when the caller has it.
    """
    provider = runtime_profile.WORD_BATCH_ENGINE
    return _synthesize_batch_to_cache(
        words, lang, out_dir, md5s, None,
        speakable=lambda word: bool(word and word.strip()),
        save=lambda index, word, path: word_audio_cache.save_to_cache(
            word, lang, provider, path, str(md5s[index] or "") if index < len(md5s) else "",
        ),
        cache_path=lambda word: word_audio_cache.get_cache_path(word, lang, provider),
        empty_error=ERROR_EMPTY_WORD,
        unsupported_error=ERROR_LANGUAGE_UNSUPPORTED,
    )


def _phrase_text(item: Any) -> str:
    value = item.get("text") if isinstance(item, dict) else item
    return str(value or "").strip()


def synthesize_phrases_to_cache(
    items: Sequence[Any], language: str, out_dir: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    """The ONE phrase-batch entry (phrase_audio lane + audio orchestration).

    ``items`` are phrase texts, or dicts carrying ``text``. Runs the word
    batch path in chunks of ``phrase_pipeline.audio.batch_chunk_size``,
    validates every clip and stores it in the permanent phrase_audio_cache
    under ``runtime_profile.WORD_BATCH_ENGINE``. Outcomes (in input order) are
    ``_synthesize_batch_to_cache``'s plus ``content_id``.
    """
    provider = runtime_profile.WORD_BATCH_ENGINE
    texts = [_phrase_text(item) for item in items]
    outcomes = _synthesize_batch_to_cache(
        texts, language, out_dir, (), PHRASE_AUDIO_BATCH_CHUNK_SIZE,
        speakable=lambda text: bool(phrase_audio_cache.phrase_content_id(text)),
        save=lambda index, text, path: phrase_audio_cache.store(text, language, provider, path),
        cache_path=lambda text: phrase_audio_cache.get_cache_path(text, language, provider),
        empty_error=ERROR_EMPTY_PHRASE,
        unsupported_error=ERROR_PHRASE_LANGUAGE_UNSUPPORTED,
    )
    for outcome in outcomes:
        outcome["content_id"] = phrase_audio_cache.phrase_content_id(outcome["text"])
    return outcomes


__all__ = ["synthesize_phrases_to_cache", "synthesize_words", "synthesize_words_to_cache"]
