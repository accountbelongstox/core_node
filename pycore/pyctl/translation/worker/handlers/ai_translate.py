# -*- coding: utf-8 -*-
"""
AI-translate capability handler (shared fast lane).

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith: ``_ai_translate_words`` (delegates to ai_batch_translate.translate_lines) +
``_ai_provider_label``.

CIRCULAR-IMPORT SAFE: imports stdlib + ColorPrint + the sibling
``handlers.translation.normalize_words`` - never worker.py. The worker instance is
passed at call time (for ``_post_result``).
"""

from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

import pycore.pyctl.translation.worker.handlers.translation as _h_translation

from pycore.pyctl.ai.ai_gateway import available_providers
import pycore.pyctl.translation.ai_batch_translate as ai_batch_translate



def ai_provider_label() -> str:
    """Best-effort label for the active AI provider (fallback 'ai')."""
    try:
        providers = available_providers() or []
        if providers:
            name = providers[0].get("name")
            if name:
                return str(name)
    except Exception:
        pass
    return "ai"


def ai_translate_words(worker, task: Dict[str, Any]) -> None:
    """Translate a word_translation task via the AI gateway (capability=ai_translate).

    Reuses ai_batch_translate.translate_lines; the real answering provider is
    surfaced into the result's ``provider`` field (best-effort fallback to the
    first available provider, else 'ai'). On import failure / zero pairs the task
    is reported 'failed' so it re-routes (e.g. to the chrome web-ai worker).
    """
    task_id = task.get("task_id")
    payload = task.get("payload") or {}
    words = _h_translation.normalize_words(payload.get("words"))
    target_language = payload.get("target_language") or "en"
    source_language = payload.get("language") or "auto"
    if not words:
        worker._post_result(task_id, "failed", error="ai_translate task had no words")
        return
    try:
        pass
    except ImportError as e:
        ColorPrint.yellow(
            f"[TranslationWorker] ai_batch_translate unavailable ({e}); "
            f"reporting task {task_id} failed for re-route")
        worker._post_result(task_id, "failed", error=f"ai_batch_translate unavailable: {e}")
        return

    worker._post_result(task_id, "processing", progress=5, attempts=1)
    meta: Dict[str, Any] = {}
    try:
        pairs = ai_batch_translate.translate_lines(
            words, source_language, target_language,
            domain="text", source="ai_translate_worker", meta_out=meta,
        )
    except Exception as e:
        ColorPrint.red(f"[TranslationWorker] AI translate task {task_id} failed: {e}")
        worker._post_result(task_id, "failed", error=str(e))
        return

    if not pairs:
        worker._post_result(task_id, "failed",
                            error="ai_translate produced no translations")
        return

    provider_label = meta.get("provider") or ai_provider_label()
    result = {
        "translations": pairs,
        "target_language": target_language,
        "provider": provider_label,
    }
    worker._post_result(task_id, "completed", result=result, progress=100)
