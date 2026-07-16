# -*- coding: utf-8 -*-
"""
Word-translation lane handler.

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith: ``_normalize_words`` (payload hygiene), ``_translate_words`` (configurable
provider chain), and the word_translation branch shaping from ``_process_task``.

CIRCULAR-IMPORT SAFE: imports only stdlib + pyutils engines + ColorPrint - never
worker.py. The worker instance is passed at call time.
"""

import asyncio
from typing import Any, Dict, List, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.translator.google_translator import GoogleTranslator
from pycore.pyutils.translator.dictionary import get_dictionary_service
from pycore.callmodule.services.task_capability_chains import get_chains
from pycore.callmodule.services.task_history_store import append_record

from pycore.callmodule.services import ai_batch_translate



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


def words_from_payload(payload: Dict[str, Any]) -> List[str]:
    """Resolve word list from a unified task payload (words[] or single content/text/word)."""
    words = normalize_words(payload.get("words")) if payload.get("words") else []
    if words:
        return words
    single = (payload.get("content") or payload.get("text") or payload.get("word") or "").strip()
    if single:
        return [single]
    return []


def format_words_preview(words: List[str], max_items: int = 5) -> str:
    """Human-readable one-line preview for UI/history (e.g. ``hello +2``)."""
    if not words:
        return ""
    head = ", ".join(words[:max_items])
    if len(words) > max_items:
        head += f" +{len(words) - max_items}"
    return head


def _google_batch(words: List[str], target_language: str) -> List[str]:
    async def _run() -> List[str]:
        async with GoogleTranslator() as translator:
            results = await translator.translate_batch(
                words, src="auto", dest=target_language, use_cache=True
            )
        return [getattr(res, "translated_text", "") or "" for res in results]

    return asyncio.run(_run())


def _ai_batch(words: List[str], source_language: str, target_language: str) -> List[str]:
    try:
        pass
    except ImportError:
        return [""] * len(words)
    pairs = ai_batch_translate.translate_lines(
        words, source_language, target_language,
        domain="text", source="translation_worker",
    )
    by_word: Dict[str, str] = {}
    for row in pairs or []:
        if isinstance(row, dict):
            w = str(row.get("word") or "").strip()
            t = str(row.get("translation") or "").strip()
            if w and t:
                by_word[w] = t
    return [by_word.get(w, "") for w in words]


def translate_words(
    words: List[str],
    target_language: str,
    source_language: str = "auto",
) -> Tuple[List[Dict[str, str]], str]:
    """
    Translate ``words`` -> ``target_language`` using the shared task chain
    (default: google → ecdict → wordnet → ai).
    """
    if not words:
        return [], "none"

    chain = list(get_chains().get("translation") or [])
    dict_svc = get_dictionary_service()
    pairs: List[Dict[str, str]] = [{"word": w, "translation": ""} for w in words]
    providers_used: List[str] = []

    for provider in chain:
        miss_idx = [i for i, p in enumerate(pairs) if not (p.get("translation") or "").strip()]
        if not miss_idx:
            break
        misses = [words[i] for i in miss_idx]
        key = str(provider or "").strip().lower()
        outs: List[str] = []

        if key == "google":
            outs = _google_batch(misses, target_language)
        elif key == "ecdict":
            outs = [
                (dict_svc.translate(w, target_language) or "").strip()
                if dict_svc.available() else ""
                for w in misses
            ]
        elif key == "wordnet":
            outs = [
                (dict_svc.wordnet_definition(w) or "").strip()
                if dict_svc.available() else ""
                for w in misses
            ]
        elif key == "ai":
            outs = _ai_batch(misses, source_language, target_language)
        else:
            continue

        filled = 0
        for idx, translated in zip(miss_idx, outs):
            t = (translated or "").strip()
            if t:
                pairs[idx]["translation"] = t
                filled += 1
        if filled:
            providers_used.append(key)

    label = "+".join(providers_used) if providers_used else "none"
    ColorPrint.blue(
        f"[TranslationWorker] {len(words)} word(s) -> {target_language} via {label}"
    )
    return pairs, label


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
    content_preview = ", ".join(words[:5])
    if len(words) > 5:
        content_preview += f" +{len(words) - 5}"

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

    worker._post_result(task_id, "processing", progress=5, attempts=1)

    translations, provider_label = translate_words(
        to_translate, target_language, source_language
    )

    if translations:
        worker.mark_words_done(
            [t["word"] for t in translations], source_language, target_language
        )

    result: Dict[str, Any] = {
        "translations": translations,
        "target_language": target_language,
        "provider": provider_label,
        "content": content_preview,
    }
    if already_done:
        result["skipped_words"] = already_done
    worker._post_result(task_id, "completed", result=result, progress=100)

    try:
        append_record({
            "task_type": "word_translation",
            "worker": "translation_worker",
            "task_id": str(task_id or ""),
            "title": content_preview[:120],
            "content": content_preview,
            "language": target_language,
            "success": True,
            "detail": {
                "word_count": len(translations),
                "provider": provider_label,
                "translations": translations[:20],
            },
        })
    except Exception:  # noqa: BLE001
        pass
