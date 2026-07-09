# -*- coding: utf-8 -*-
"""
Word-translation lane handler.

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith: ``_normalize_words`` (payload hygiene), ``_translate_words`` (ECDICT then
GoogleTranslator), and the word_translation branch shaping from ``_process_task``.

CIRCULAR-IMPORT SAFE: imports only stdlib + pyutils engines + ColorPrint - never
worker.py. The worker instance is passed at call time.
"""

import asyncio
from typing import Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# Internal imports at file top (PYTHON_PYCORE.md §1.4). Both modules degrade
# gracefully themselves: google_translator guards googletrans with its own
# top-level try (GOOGLETRANS_AVAILABLE), task_manager is stdlib-only.
from pycore.pyutils.translator.google_translator import GoogleTranslator
from pycore.pyutils.translator.dictionary import get_dictionary_service


def normalize_words(raw_words: Any) -> List[str]:
    """
    Coerce a task's ``payload.words`` into a clean list of strings.

    The word_translation contract is plain strings, but other producers on
    the same task substrate ship words as dicts (e.g. dictionary_explanation
    rows: {"word": ..., "md5": ..., "query_count": ...}). A mis-routed task
    of that shape used to crash this worker with
    "'dict' object has no attribute 'strip'" - tolerate it by extracting the
    word field instead. Non-string scalars and empties are dropped.
    """
    normalized: List[str] = []
    if not isinstance(raw_words, (list, tuple)):
        return normalized
    for entry in raw_words:
        word: Any = entry
        if isinstance(entry, dict):
            word = entry.get("word") or entry.get("content")
        if isinstance(word, str):
            word = word.strip()
            if word:
                normalized.append(word)
    return normalized


def translate_words(words: List[str], target_language: str) -> List[Dict[str, str]]:
    """
    Translate ``words`` -> ``target_language`` (source auto-detected) and return
    the contract's translations list: [ {word, translation}, ... ].

    Engine chain (free/offline first, network last):
      1. ECDICT offline dictionary - instant, free, authoritative for known
         English words to Chinese/English (get_dictionary_service().translate).
      2. GoogleTranslator (async, on-disk cached) for the misses + every
         non-zh/en target. Runs in a private event loop (this executes on a
         TaskManager background thread with no running loop).
    """
    if not words:
        return []

    # 1) Offline dictionary pass - fill what ECDICT knows, queue the rest.
    dict_svc = get_dictionary_service()
    use_dict = dict_svc.available()
    pairs: List[Dict[str, str]] = [{"word": w, "translation": ""} for w in words]
    miss_idx: List[int] = []
    for i, word in enumerate(words):
        hit = dict_svc.translate(word, target_language) if use_dict else None
        if hit:
            pairs[i]["translation"] = hit
        else:
            miss_idx.append(i)

    if not miss_idx:
        ColorPrint.blue(f"[TranslationWorker] {len(words)} word(s) -> {target_language} "
                        f"via ECDICT (offline, 0 google calls)")
        return pairs

    # 2) Google for the dictionary misses only.
    misses = [words[i] for i in miss_idx]

    async def _run() -> List[str]:
        async with GoogleTranslator() as translator:
            results = await translator.translate_batch(
                misses, src="auto", dest=target_language, use_cache=True
            )
        return [getattr(res, "translated_text", "") or "" for res in results]

    # We're on a background worker thread -> safe to spin a private event loop.
    google_out = asyncio.run(_run())
    for idx, translated in zip(miss_idx, google_out):
        pairs[idx]["translation"] = translated
    if use_dict:
        ColorPrint.blue(f"[TranslationWorker] {len(words)} word(s) -> {target_language} "
                        f"({len(words) - len(misses)} ECDICT / {len(misses)} google)")
    return pairs


def process_word_translation(worker, task: Dict[str, Any]) -> None:
    """word_translation lane: partition (skip already-done) -> translate -> post.

    The dispatcher (worker._process_task) wraps this in its try/except/finally,
    so any raise propagates to a 'failed' result POST + inflight cleanup - matching
    the original monolith's branch (which had no inner try/except).
    """
    task_id = task.get("task_id")
    payload = task.get("payload") or {}
    words = normalize_words(payload.get("words"))
    target_language = payload.get("target_language") or "en"
    source_language = payload.get("language") or "auto"

    # WORD-LEVEL COORDINATION (multi-pycore): skip words another pycore
    # already finished (broadcast via Reverb `word.translated`). Those are
    # reported as already-done so Laravel's idempotent write-back keeps them.
    to_translate, already_done = worker.partition_words(
        words, source_language, target_language
    )
    if already_done:
        ColorPrint.blue(
            f"[TranslationWorker] Task {task_id}: skipping {len(already_done)} "
            f"word(s) already translated by another pycore"
        )

    ColorPrint.blue(
        f"[TranslationWorker] Translating task {task_id}: "
        f"{len(to_translate)} word(s) -> {target_language}"
        + (f" ({len(already_done)} skipped)" if already_done else "")
    )

    # Best-effort liveness ping BEFORE the slow translate: marks the
    # task `processing` on Laravel (live in the dashboard) and RENEWS
    # its timeout lease, so a long batch under throttling is not
    # reclaimed mid-flight and double-translated. attempts=1 - a lost
    # ping costs nothing, the final result carries the real outcome.
    worker._post_result(task_id, "processing", progress=5, attempts=1)

    translations = translate_words(to_translate, target_language)

    # Record our just-translated words so they dedup future tasks here too.
    if translations:
        worker.mark_words_done(
            [t["word"] for t in translations], source_language, target_language
        )

    # Skipped (already-done) words are NOT added to `translations`: sending
    # them with an empty string would violate the {word, translation}
    # contract and risk a blank overwrite on the backend. Report them in a
    # separate field purely for observability - the write-back ignores it.
    result: Dict[str, Any] = {
        "translations": translations,
        "target_language": target_language,
        "provider": worker.DEFAULT_PROVIDER,  # "google"
    }
    if already_done:
        result["skipped_words"] = already_done
    worker._post_result(task_id, "completed", result=result, progress=100)
