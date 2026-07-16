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

from pycore.pyutils.external_apis.movie_poster_client import POSTER_DELEGATED_TO_MCP_CHROME
from pycore.pyutils.external_apis.movie_poster_client import MCP_CHROME_IMAGE_DELEGATION



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
        from pycore.callmodule.controllers.subtitle_search_controller import SubtitleSearchController
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
    """poster task — DISABLED in pycore; delegated to apps/mcp-chrome."""

    task_id = task.get("task_id")
    worker._post_result(task_id, "failed", error=POSTER_DELEGATED_TO_MCP_CHROME)
    return

    # --- Legacy TMDB/OMDB poster lane (disabled) ---
    # poster = find_poster(title, year=year_int)


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
    """word_media task — DISABLED in pycore.

    AI word illustrations are delegated to apps/mcp-chrome (Google Images).
    """

    task_id = task.get("task_id")
    worker._post_result(task_id, "failed", error=MCP_CHROME_IMAGE_DELEGATION)
    worker._record_task(task, worker.IMAGE_TASK_TYPE, "failed", posted_back=False)
    return

    # --- Legacy AI word_media (disabled) ---
    # gen = generate_image(prompt=image_prompt_for_word(word, language), ...)
