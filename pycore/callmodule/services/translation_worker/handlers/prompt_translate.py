# -*- coding: utf-8 -*-
"""
Prompt-translation lane handler (dev-history assist).

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith: ``_process_prompt_translation_task`` + ``_prompt_ai_paused`` /
``_prompt_ai_pause``. The AI-pause deadline (``_prompt_ai_pause_until``) stays on the
worker instance; these helpers read/write it via the passed-in ``worker``.

CIRCULAR-IMPORT SAFE: imports stdlib + ColorPrint + the sibling ``lane_gating`` and
``handlers.audio.synthesize_word_audio`` modules - never worker.py. The worker
instance is passed at call time.
"""

import time
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from .. import lane_gating
from . import audio as _h_audio


def prompt_ai_paused(worker) -> bool:
    return time.time() < worker._prompt_ai_pause_until


def prompt_ai_pause(worker, seconds: float = 120.0) -> None:
    worker._prompt_ai_pause_until = time.time() + max(30.0, seconds)
    ColorPrint.yellow(
        f"[TranslationWorker] AI providers exhausted - pausing prompt "
        f"translation for ~{int(seconds)}s"
    )


def process_prompt_translation_task(worker, task: Dict[str, Any]) -> None:
    """prompt_translation task: translate a non-English prompt to English.

    Masks code so it is never translated, asks the AI gateway for the English
    translation + a cleaned sentence + 3 fluent variants, and (best-effort)
    synthesizes English TTS. On AI exhaustion the worker PAUSES and reports the
    task failed so Laravel re-pends it until the rate window resets.
    """
    task_id = task.get("task_id")
    payload = task.get("payload") or {}
    text = (payload.get("text") or "").strip()
    prompt_id = payload.get("prompt_id") or ""
    src = (payload.get("source_lang") or "auto").strip() or "auto"
    want_audio = bool(payload.get("want_audio", True))

    if not text:
        worker._post_result(task_id, "failed", error="prompt_translation task had no text")
        return

    # Honor an active pause: do not burn a claim while providers are exhausted.
    if prompt_ai_paused(worker):
        worker._post_result(task_id, "failed", error="AI providers paused (rate limit) - retry later")
        return

    worker._post_result(task_id, "processing", progress=5, attempts=1)

    try:
        from pycore.pyutils.translator import prompt_translate
        tr = prompt_translate.translate_prompt(text, src=src)
    except Exception as e:
        ColorPrint.red(f"[TranslationWorker] prompt_translation {task_id} failed: {e}")
        worker._post_result(task_id, "failed", error=str(e))
        return

    if not tr.get("success"):
        if tr.get("exhausted"):
            prompt_ai_pause(worker, 120.0)
        worker._post_result(task_id, "failed", error=str(tr.get("error") or "translate failed"))
        return

    english = tr.get("english") or ""
    result: Dict[str, Any] = {
        "prompt_id": prompt_id,
        "detected_language": src,
        "english": english,
        "cleaned": tr.get("cleaned") or english,
        "variants": tr.get("variants") or [],
        "provider": tr.get("provider"),
    }

    # Best-effort English audio (same edge-tts path as sentence_audio). The
    # backend stores the bytes and serves them for the wordnew daily reading.
    if want_audio and lane_gating.sentence_audio_enabled():
        try:
            audio_b64, engine, _ = _h_audio.synthesize_word_audio(english, "en")
            if audio_b64:
                result["audio_base64"] = audio_b64
                result["audio"] = {"language": "en", "engine": engine, "mime": "audio/mpeg"}
        except Exception as e:
            ColorPrint.yellow(f"[TranslationWorker] prompt audio synth skipped: {e}")

    worker._post_result(task_id, "completed", result=result, progress=100)
