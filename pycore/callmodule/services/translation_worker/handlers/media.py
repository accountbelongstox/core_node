# -*- coding: utf-8 -*-
"""
Media lanes handler: subtitle_search, poster, word_media (image).

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith: ``_process_subtitle_search_task``, ``_process_poster_task``,
``_process_image_task``, ``_image_prompt_for_word``.

CIRCULAR-IMPORT SAFE: imports stdlib + ColorPrint + the sibling ``lane_gating``
module + ``handlers.translation.normalize_words`` - never worker.py. The worker
instance is passed at call time (for ``_post_result`` / ``_record_task`` and the
image task-type constant).
"""

from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from .. import lane_gating
from . import translation as _h_translation


def process_subtitle_search_task(worker, task: Dict[str, Any]) -> None:
    """subtitle_search task: SubtitleSearchController().search(...) -> {results}.

    SubtitleSearchController is a pycore module lost with the subsystem at this
    baseline - imported lazily so the worker still compiles/runs. If absent (or
    the lane is disabled / results empty) the task is reported 'failed' so it
    re-routes, never silently dropped.
    """
    task_id = task.get("task_id")
    if not lane_gating.subtitle_enabled():
        worker._post_result(task_id, "failed", error="subtitle search disabled on this worker")
        return
    payload = task.get("payload") or {}
    query = payload.get("query") or payload.get("title") or ""
    if not query:
        worker._post_result(task_id, "failed", error="subtitle_search task had no query")
        return
    try:
        from pycore.callmodule.controllers.subtitle_search_controller import (  # type: ignore
            SubtitleSearchController,
        )
    except ImportError as e:
        ColorPrint.yellow(
            f"[TranslationWorker] SubtitleSearchController unavailable ({e}); "
            f"reporting task {task_id} failed for re-route")
        worker._post_result(task_id, "failed", error=f"SubtitleSearchController unavailable: {e}")
        return
    worker._post_result(task_id, "processing", progress=5, attempts=1)
    try:
        results = SubtitleSearchController().search(
            query=query,
            languages=payload.get("languages"),
            year=payload.get("year"),
            season=payload.get("season"),
            episode=payload.get("episode"),
            moviehash=payload.get("moviehash"),
            limit=payload.get("limit"),
            record=payload.get("record"),
        )
    except Exception as e:
        ColorPrint.red(f"[TranslationWorker] subtitle_search task {task_id} failed: {e}")
        worker._post_result(task_id, "failed", error=str(e))
        return
    # Accept either a bare list or a {results:[...]} shape from the controller.
    if isinstance(results, dict):
        rows = results.get("results") or []
    else:
        rows = results or []
    if not rows:
        worker._post_result(task_id, "failed", error="subtitle_search found no results")
        return
    worker._post_result(task_id, "completed", result={"results": rows}, progress=100)


def process_poster_task(worker, task: Dict[str, Any]) -> None:
    """poster task: resolve title -> movie_poster_client.find_poster ->
    {image_base64, mime, provider, source_id}. Disabled / no-poster -> 'failed'.
    """
    task_id = task.get("task_id")
    if not lane_gating.poster_enabled():
        worker._post_result(task_id, "failed", error="poster fetch disabled on this worker")
        return
    payload = task.get("payload") or {}
    title = (payload.get("title") or "").strip()
    year = payload.get("year")
    try:
        from pycore.pyutils.external_apis.movie_poster_client import (
            find_poster, parse_title_year,
        )
    except ImportError as e:
        worker._post_result(task_id, "failed", error=f"movie_poster_client unavailable: {e}")
        return
    if not title:
        filename = (payload.get("filename") or "").strip()
        if filename:
            title, parsed_year = parse_title_year(filename)
            if year is None:
                year = parsed_year
    if not title:
        worker._post_result(task_id, "failed", error="poster task had no title/filename")
        return
    try:
        year_int = int(year) if year is not None else None
    except (TypeError, ValueError):
        year_int = None
    worker._post_result(task_id, "processing", progress=5, attempts=1)
    try:
        poster = find_poster(title, year=year_int)
    except Exception as e:
        ColorPrint.red(f"[TranslationWorker] poster task {task_id} failed: {e}")
        worker._post_result(task_id, "failed", error=str(e))
        return
    if not poster or not poster.get("image_base64"):
        worker._post_result(task_id, "failed",
                            error=f"no poster found for '{title}'")
        return
    result = {
        "image_base64": poster.get("image_base64"),
        "mime": poster.get("mime") or "image/jpeg",
        "provider": poster.get("provider") or "tmdb",
        "source_id": poster.get("source_id"),
    }
    worker._post_result(task_id, "completed", result=result, progress=100)


def image_prompt_for_word(word: str, language: str) -> str:
    """Build a concise illustration prompt for a vocabulary word.

    Kept short + concrete so image providers return a clean, single-subject
    picture suitable as a word's sample art. Language is included so the prompt
    disambiguates homographs across libraries.
    """
    lang = (language or "en").strip() or "en"
    return (
        f"A clear, simple illustration that visually represents the meaning of "
        f"the {lang} word '{word}'. Single subject, plain background, no text."
    )


def process_image_task(worker, task: Dict[str, Any]) -> None:
    """word_media task: generate a word illustration via the unified AI gateway.

    Result is shaped into the word_media WRITE-BACK contract that
    WordTranslationTaskProcessor -> AppQyV1WordTranslationWriteback::apply
    accepts (fill-missing/idempotent, image-only):
        { translations:[ {word, image_base64:[{base64,mime}]} ],
          target_language, provider }

    Guarded by lane_gating.image_enabled(): disabled / no word / gateway failure (e.g. no
    image-capable provider configured) -> 'failed', so Laravel re-routes or
    re-pends the task. Never strands (this is why advertising 'image' is safe -
    a real processor exists; absence of a backend degrades to a clean failure).
    """
    task_id = task.get("task_id")
    if not lane_gating.image_enabled():
        worker._post_result(task_id, "failed", error="word image disabled on this worker")
        return
    payload = task.get("payload") or {}
    words = _h_translation.normalize_words(payload.get("words"))
    word = words[0] if words else (payload.get("word") or "").strip()
    language = (payload.get("language") or "en").strip() or "en"
    target_language = payload.get("target_language") or language
    if not word:
        worker._post_result(task_id, "failed", error="word_media task had no word")
        return
    try:
        from pycore.pyctl.ai import generate_image
    except ImportError as e:
        ColorPrint.yellow(
            f"[TranslationWorker] generate_image unavailable ({e}); "
            f"reporting task {task_id} failed for re-route")
        worker._post_result(task_id, "failed", error=f"generate_image unavailable: {e}")
        return
    worker._post_result(task_id, "processing", progress=5, attempts=1)
    try:
        gen = generate_image(
            prompt=image_prompt_for_word(word, language),
            size=payload.get("size"),
            model=payload.get("model"),
            source="word_media_worker",
        )
    except Exception as e:
        ColorPrint.red(f"[TranslationWorker] word_media task {task_id} failed: {e}")
        worker._post_result(task_id, "failed", error=str(e))
        return
    image_b64 = (gen or {}).get("image_base64") if isinstance(gen, dict) else None
    if not gen or not gen.get("success") or not image_b64:
        err = (gen or {}).get("error") or "no image-capable provider produced an image"
        worker._post_result(task_id, "failed", error=str(err))
        return
    result = {
        "translations": [{
            "word": word,
            "image_base64": [{
                "base64": image_b64,
                "mime": gen.get("mime") or "image/png",
            }],
        }],
        "target_language": target_language,
        "provider": gen.get("provider") or "ai",
    }
    worker._post_result(task_id, "completed", result=result, progress=100)
    worker._record_task(task, worker.IMAGE_TASK_TYPE, "completed", posted_back=True)
