# -*- coding: utf-8 -*-
"""
Audio lanes handler: word_audio, article_audio, sentence_audio.

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith: ``_synthesize_word_audio``, ``_normalize_audio_accent``,
``_audio_cache_parts``, ``_resolve_one_word_audio``, ``_process_audio_task``,
``_process_article_audio_task``, ``_process_sentence_audio_task``.

CIRCULAR-IMPORT SAFE: imports stdlib + pyutils engines + ColorPrint + the sibling
``lane_gating`` module + ``handlers.translation.normalize_words`` - never worker.py.
The worker instance is passed at call time (for ``_post_result`` / ``_record_task``
and the lane-execution-type constants).
"""

import base64
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# Real (non-synthetic) pronunciation source chain, tried before TTS synthesis
# in the word_audio lane - see _process_audio_task.
from pycore.pyutils.external_apis.word_audio_client import find_pronunciation
# On-disk result cache for the word_audio lane (word+lang+accent -> bytes+meta),
# mirroring ai_batch_translate's usage so a repeat request is served from cache
# without re-hitting the network / TTS engines.
from pycore.pyutils.common import result_cache

from .. import lane_gating
from . import translation as _h_translation


def synthesize_word_audio(text: str, language: str,
                          accent: Optional[str] = None) -> Tuple[str, str, str]:
    """Synthesize ``text`` -> MP3 bytes (base64) via the pyutils TTS orchestrator.

    ``accent`` ("us"|"uk"|None) is threaded to the orchestrator so the
    accent-aware engines (edge/streamelements) pick the matching voice.
    Returns (audio_base64, engine, actual_accent) where actual_accent is the
    accent ACTUALLY produced ("us"|"uk"|"unknown"). Raises on failure
    (caller posts 'failed').
    """
    from pycore.pyutils.tts import tts_orchestrator

    fd, tmp_path = tempfile.mkstemp(prefix="worker_tts_", suffix=".mp3")
    os.close(fd)
    tmp = Path(tmp_path)
    try:
        synth = tts_orchestrator.synthesize(text, language, tmp, accent=accent)
        if not synth.get("success"):
            raise RuntimeError(synth.get("error") or "tts synthesis failed")
        audio = tmp.read_bytes() if tmp.exists() else b""
        if len(audio) < 100:
            raise RuntimeError(
                f"engine '{synth.get('engine')}' produced {len(audio)} bytes")
        actual_accent = synth.get("accent") or "unknown"
        return (base64.b64encode(audio).decode("ascii"),
                (synth.get("engine") or "unknown"), actual_accent)
    finally:
        try:
            tmp.unlink()
        except OSError:
            pass


def normalize_audio_accent(payload: Dict[str, Any]) -> Optional[str]:
    """Normalize payload.accent to the wire values "us"|"uk"|None."""
    value = str(payload.get("accent") or "").strip().lower()
    return value if value in ("us", "uk") else None


def _audio_cache_parts(word: str, language: str,
                       accent: Optional[str]) -> Tuple[str, ...]:
    """result_cache key parts for one word's audio (word, lang, accent)."""
    return (word.strip().lower(), (language or "en").strip().lower(), accent or "any")


def resolve_one_word_audio(word: str, language: str,
                           accent: Optional[str]) -> Optional[Dict[str, Any]]:
    """Resolve audio for ONE word: cache -> real-pronunciation chain -> TTS.

    Returns a translations-contract item
    ``{word, audio_base64, mime, engine, provider, accent, accent_fallback}``
    or None when every source failed (never raises). Caches the produced
    bytes + meta under the word_audio namespace so a repeat request is
    served without re-hitting the network / engines.
    """
    cache_parts = _audio_cache_parts(word, language, accent)
    try:
        cached = result_cache.get_bytes("word_audio", *cache_parts)
    except Exception:  # noqa: BLE001 - cache must never break this lane
        cached = None
    if cached:
        audio_bytes, meta = cached
        if audio_bytes and len(audio_bytes) >= 100:
            actual_accent = meta.get("accent") or "unknown"
            provider = meta.get("provider") or meta.get("engine") or "unknown"
            return {
                "word": word,
                "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
                "mime": meta.get("mime") or "audio/mpeg",
                "engine": provider,
                "provider": provider,
                "accent": actual_accent,
                "accent_fallback": bool(accent and actual_accent != accent),
            }

    audio_bytes = b""
    provider = "unknown"
    mime = "audio/mpeg"
    actual_accent = "unknown"

    real_source = None
    try:
        real_source = find_pronunciation(word, language, accent)
    except Exception as e:  # noqa: BLE001 - real-source chain must never break this lane
        ColorPrint.yellow(
            f"[TranslationWorker] word_audio real-source lookup skipped ({e}); "
            "falling back to TTS"
        )

    if real_source:
        audio_bytes = real_source.get("audio_bytes") or b""
        provider = real_source.get("provider") or "unknown"
        mime = real_source.get("mime") or "audio/mpeg"
        actual_accent = real_source.get("accent") or "unknown"
    else:
        try:
            b64, engine, actual_accent = synthesize_word_audio(word, language, accent)
            audio_bytes = base64.b64decode(b64)
            provider = engine
            mime = "audio/mpeg"
        except Exception as e:  # noqa: BLE001 - TTS fallback failed
            ColorPrint.red(
                f"[TranslationWorker] word_audio TTS failed for '{word}': {e}")
            return None

    if not audio_bytes or len(audio_bytes) < 100:
        return None

    try:
        result_cache.set_bytes(
            "word_audio", audio_bytes, *cache_parts,
            meta={"mime": mime, "provider": provider, "engine": provider,
                  "accent": actual_accent})
    except Exception:  # noqa: BLE001 - cache write must never break this lane
        pass

    return {
        "word": word,
        "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
        "mime": mime,
        "engine": provider,
        "provider": provider,
        "accent": actual_accent,
        "accent_fallback": bool(accent and actual_accent != accent),
    }


def process_audio_task(worker, task: Dict[str, Any]) -> None:
    """word_audio task: per-word real pronunciation chain first, TTS fallback
    -> translations[] contract.

    Guarded by lane_gating.audio_enabled(): if assist TTS is disabled on this
    worker the task is reported 'failed' (so it re-routes) and recorded locally,
    never silently dropped.

    Payload (additive over the legacy {text|word, language} form):
      { words:[{word,md5}|str], language, accent?"us"|"uk" }
    or the legacy single-word form { text|word|content, language, accent? }.
    ``accent`` is the user's preferred English accent, threaded to the real
    source chain and the TTS engines; when a provider cannot honor it the
    chain still runs and the ACTUAL accent is tagged per item
    (accent_fallback=true) so the backend can store/serve it as a fallback.

    Emits the shared translations contract expected by
    WordTranslationTaskProcessor:
      { translations:[{word, audio_base64, mime, engine, provider,
                       accent, accent_fallback}],
        provider, target_language }
    Each item carries the produced audio as base64 mp3. If EVERY word fails
    the task is posted 'failed'.
    """
    task_id = task.get("task_id")
    if not lane_gating.audio_enabled():
        worker._post_result(task_id, "failed", error="assist TTS disabled on this worker")
        worker._record_task(task, worker.AUDIO_TASK_TYPE, "failed",
                            posted_back=False, error="assist TTS disabled on this worker")
        return
    payload = task.get("payload") or {}
    language = (payload.get("language") or "en").strip() or "en"
    accent = normalize_audio_accent(payload)

    words = _h_translation.normalize_words(payload.get("words")) if payload.get("words") else []
    if not words:
        single = (payload.get("content") or payload.get("text")
                  or payload.get("word") or "").strip()
        if single:
            words = [single]
    if not words:
        worker._post_result(task_id, "failed", error="word_audio task had no words")
        return
    worker._post_result(task_id, "processing", progress=5, attempts=1)

    translations: list = []
    for word in words:
        item = resolve_one_word_audio(word, language, accent)
        if item:
            translations.append(item)

    if not translations:
        worker._post_result(task_id, "failed",
                            error=f"word_audio: no audio for any of {len(words)} word(s)")
        worker._record_task(task, worker.AUDIO_TASK_TYPE, "failed", posted_back=True,
                            error="no audio produced")
        return

    overall_provider = translations[0].get("provider") or "unknown"
    result = {
        "translations": translations,
        "provider": overall_provider,
        "target_language": language,
    }
    worker._post_result(task_id, "completed", result=result, progress=100)
    worker._record_task(task, worker.AUDIO_TASK_TYPE, "completed", posted_back=True)


def process_article_audio_task(worker, task: Dict[str, Any]) -> None:
    """article_audio task: synthesize a long-form text block into ONE MP3.

    Rides remote_audio like word_audio but skips the per-word real-pronunciation
    chain (articles are sentences/paragraphs, not dictionary words): the text
    goes straight to the TTS orchestrator. Payload is the unified audio shape
    {content|text, language, accent?} (Laravel producers put the text under
    payload.content). Result: {audio_base64, mime, engine, accent}; no
    translations[] writeback (article_audio has no dictionary row), so Laravel
    treats it as a text-only success (stored_count=null -> not downgraded).

    Disabled / empty / synthesis failure -> 'failed' (re-route), never dropped.
    """
    task_id = task.get("task_id")
    if not lane_gating.audio_enabled():
        worker._post_result(task_id, "failed", error="assist TTS disabled on this worker")
        worker._record_task(task, worker.ARTICLE_AUDIO_TASK_TYPE, "failed",
                            posted_back=False, error="assist TTS disabled on this worker")
        return
    payload = task.get("payload") or {}
    text = (payload.get("content") or payload.get("text") or "").strip()
    language = (payload.get("language") or "en").strip() or "en"
    accent = normalize_audio_accent(payload)
    if not text:
        worker._post_result(task_id, "failed", error="article_audio task had no text")
        return
    worker._post_result(task_id, "processing", progress=5, attempts=1)
    try:
        audio_b64, engine, actual_accent = synthesize_word_audio(text, language, accent=accent)
    except Exception as e:
        ColorPrint.red(f"[TranslationWorker] article_audio task {task_id} failed: {e}")
        worker._post_result(task_id, "failed", error=str(e))
        worker._record_task(task, worker.ARTICLE_AUDIO_TASK_TYPE, "failed",
                            posted_back=True, error=str(e))
        return
    result = {
        "audio_base64": audio_b64,
        "mime": "audio/mpeg",
        "engine": engine,
        "accent": actual_accent,
    }
    worker._post_result(task_id, "completed", result=result, progress=100)
    worker._record_task(task, worker.ARTICLE_AUDIO_TASK_TYPE, "completed", posted_back=True)


def process_sentence_audio_task(worker, task: Dict[str, Any]) -> None:
    """sentence_audio task: synthesize MP3 via the TTS orchestrator -> {audio_base64}.

    Reuses synthesize_word_audio (same edge-tts MP3 path). Disabled / empty /
    synthesis failure -> 'failed' (re-route).
    """
    task_id = task.get("task_id")
    if not lane_gating.sentence_audio_enabled():
        worker._post_result(task_id, "failed", error="sentence audio disabled on this worker")
        return
    payload = task.get("payload") or {}
    text = (payload.get("text") or payload.get("sentence")
            or payload.get("content") or "").strip()
    language = (payload.get("language") or "en").strip() or "en"
    if not text:
        worker._post_result(task_id, "failed", error="sentence_audio task had no text")
        return
    worker._post_result(task_id, "processing", progress=5, attempts=1)
    try:
        audio_b64, engine, _ = synthesize_word_audio(text, language)
    except Exception as e:
        ColorPrint.red(f"[TranslationWorker] sentence_audio task {task_id} failed: {e}")
        worker._post_result(task_id, "failed", error=str(e))
        return
    result = {"audio_base64": audio_b64, "mime": "audio/mpeg", "engine": engine}
    worker._post_result(task_id, "completed", result=result, progress=100)
