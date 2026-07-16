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
import html
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_edge_tts_voice_cache_dir
# Real (non-synthetic) pronunciation source chain, tried before TTS synthesis
# in the word_audio lane - see _process_audio_task.
from pycore.pyutils.external_apis.word_audio_client import find_pronunciation
# On-disk result cache for the word_audio lane (word+lang+accent -> bytes+meta),
# mirroring ai_batch_translate's usage so a repeat request is served from cache
# without re-hitting the network / TTS engines.
from pycore.pyutils.common import result_cache

from .. import lane_gating
from . import translation as _h_translation

from pycore.pyutils.tts import tts_orchestrator


# Pattern: any run of chars that are NOT ASCII alnum or CJK -> single '-'.
_NON_WORD_RE = re.compile(r'[^A-Za-z0-9一-鿿]+')


def clean_word_text(word: str) -> str:
    """Clean a word for TTS: decode HTML entities (&#x27; -> ', &amp; -> &, ...)
    then replace every non-alphanumeric run (except CJK) with a single '-'.

    e.g. ``distemp&#x27;rature`` -> ``distemp-rature``. Words with HTML markup
    or stray punctuation would otherwise be spoken verbatim by edge-tts. Returns
    '' for empty input; callers fall back to the original word when empty."""
    s = (word or '').strip()
    if not s:
        return ''
    try:
        s = html.unescape(s)
    except Exception:  # noqa: BLE001
        pass
    s = _NON_WORD_RE.sub('-', s).strip('-')
    return s


def synthesize_word_audio(text: str, language: str,
                          accent: Optional[str] = None,
                          gender: Optional[str] = None,
                          priority_profile: str = "word") -> Tuple[str, str, str, Dict[str, Any]]:
    """Synthesize ``text`` -> MP3 bytes (base64) via the pyutils TTS orchestrator.

    ``priority_profile`` defaults to WORD (edge-first) - words are short (no
    internal space) and synthesize sequentially (no parallel batch); the
    real-pronunciation chain in resolve_one_word_audio runs BEFORE this fallback.
    The sentence_audio assist path passes ``"sentence"`` (qwen3tts-first).

    Returns (audio_base64, engine, actual_accent, meta) where meta carries
    synth_command / tried engines for the task-detail UI.
    """

    # Scratch file on the shared D:\www\cache voice volume (NOT C: %TEMP%).
    voice_dir = get_edge_tts_voice_cache_dir(language)
    fd, tmp_path = tempfile.mkstemp(prefix="worker_tts_", suffix=".mp3", dir=str(voice_dir))
    os.close(fd)
    tmp = Path(tmp_path)
    try:
        synth = tts_orchestrator.synthesize(
            text, language, tmp, accent=accent, gender=gender,
            priority_profile=priority_profile)
        if not synth.get("success"):
            raise RuntimeError(synth.get("error") or "tts synthesis failed")
        audio = tmp.read_bytes() if tmp.exists() else b""
        if len(audio) < 100:
            raise RuntimeError(
                f"engine '{synth.get('engine')}' produced {len(audio)} bytes")
        actual_accent = synth.get("accent") or "unknown"
        meta = {
            "synth_command": synth.get("synth_command"),
            "tried": synth.get("tried") or [],
        }
        return (base64.b64encode(audio).decode("ascii"),
                (synth.get("engine") or "unknown"), actual_accent, meta)
    finally:
        try:
            tmp.unlink()
        except OSError:
            pass


def _word_audio_local_result(
    task_id: Optional[str],
    language: str,
    words: List[str],
    translations: List[Dict[str, Any]],
    accent: Optional[str],
    provider: str,
) -> Dict[str, Any]:
    """TaskManager-facing summary (no base64 blobs)."""
    word_rows: List[Dict[str, Any]] = []
    for item in translations:
        word = item.get("word") or ""
        cache_parts = _audio_cache_parts(word, language, accent)
        audio_path = result_cache.get_bytes_path("word_audio", *cache_parts)
        b64 = item.get("audio_base64") or ""
        audio_bytes = len(base64.b64decode(b64)) if b64 else None
        word_rows.append({
            "word": word,
            "engine": item.get("engine") or item.get("provider"),
            "provider": item.get("provider"),
            "accent": item.get("accent"),
            "audio_path": audio_path,
            "audio_bytes": audio_bytes,
            "synth_command": item.get("synth_command"),
            "cached": bool(item.get("cached")),
        })
    primary = word_rows[0] if word_rows else {}
    text = words[0] if len(words) == 1 else ", ".join(words[:5])
    if len(words) > 5:
        text += f" +{len(words) - 5}"
    return {
        "remote_task_id": task_id,
        "ok": True,
        "text": text,
        "language": language,
        "engine": provider,
        "provider": provider,
        "synth_command": primary.get("synth_command"),
        "audio_path": primary.get("audio_path"),
        "audio_bytes": primary.get("audio_bytes"),
        "mime": "audio/mpeg",
        "words": word_rows,
        "word_count": len(translations),
    }


def normalize_audio_accent(payload: Dict[str, Any]) -> Optional[str]:
    """Normalize payload.accent to the wire values "us"|"uk"|None."""
    value = str(payload.get("accent") or "").strip().lower()
    return value if value in ("us", "uk") else None


def _audio_cache_parts(word: str, language: str,
                       accent: Optional[str],
                       variant_key: str = "") -> Tuple[str, ...]:
    """result_cache key parts for one word's audio (word, lang, accent, variant_key)."""
    return (word.strip().lower(), (language or "en").strip().lower(),
            accent or "any", variant_key or "primary")


def resolve_one_word_audio(word: str, language: str,
                           accent: Optional[str],
                           variant_key: str = "",
                           gender: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Resolve audio for ONE word: cache -> real-pronunciation chain -> TTS.

    Returns a translations-contract item
    ``{word, audio_base64, mime, engine, provider, accent, accent_fallback,
       variant_key, gender}`` or None when every source failed (never raises).
    Caches the produced bytes + meta under the word_audio namespace (keyed by
    word+lang+accent+variant_key) so a repeat request is served without
    re-hitting the network / engines. Words use the edge-first WORD priority
    profile and synthesize sequentially (no parallel batch).
    """
    # Clean the word BEFORE synth/lookup: HTML entities & special chars -> '-' so
    # edge-tts speaks "distemp-rature" not "distemp&#x27;rature". Fall back to the
    # original word when cleaning yields empty.
    cleaned = clean_word_text(word)
    if cleaned:
        word = cleaned
    cache_parts = _audio_cache_parts(word, language, accent, variant_key)
    try:
        cached = result_cache.get_bytes("word_audio", *cache_parts)
    except Exception:  # noqa: BLE001 - cache must never break this lane
        cached = None
    if cached:
        audio_bytes, meta = cached
        if audio_bytes and len(audio_bytes) >= 100:
            actual_accent = meta.get("accent") or "unknown"
            provider = meta.get("provider") or meta.get("engine") or "unknown"
            audio_path = result_cache.get_bytes_path("word_audio", *cache_parts)
            parts_label = "/".join(str(p) for p in cache_parts)
            return {
                "word": word,
                "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
                "mime": meta.get("mime") or "audio/mpeg",
                "engine": provider,
                "provider": provider,
                "accent": actual_accent,
                "accent_fallback": bool(accent and actual_accent != accent),
                "variant_key": variant_key,
                "gender": gender or "female",
                "audio_path": audio_path,
                "cached": True,
                "synth_command": f'result_cache hit: word_audio/{parts_label} -> {audio_path or "?"}',
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
        synth_command = (
            f'find_pronunciation(word="{word}", lang={language}, '
            f'accent={accent or "any"}) -> provider={provider}'
        )
    else:
        try:
            b64, engine, actual_accent, meta = synthesize_word_audio(
                word, language, accent, gender=gender)
            audio_bytes = base64.b64decode(b64)
            provider = engine
            mime = "audio/mpeg"
            synth_command = meta.get("synth_command")
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

    audio_path = result_cache.get_bytes_path("word_audio", *cache_parts)

    return {
        "word": word,
        "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
        "mime": mime,
        "engine": provider,
        "provider": provider,
        "accent": actual_accent,
        "accent_fallback": bool(accent and actual_accent != accent),
        "variant_key": variant_key,
        "gender": gender or "female",
        "audio_path": audio_path,
        "synth_command": synth_command,
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

    words = _h_translation.words_from_payload(payload)
    if not words:
        worker._post_result(task_id, "failed", error="word_audio task had no words")
        worker._patch_local_task(task, progress=100, status="failed",
                                   result_patch={"remote_task_id": task_id, "ok": False},
                                   error="word_audio task had no words")
        return

    preview_word = words[0]
    planned_engine = tts_orchestrator.tts_status().get("active") or tts_orchestrator.best_engine()
    planned_cmd = tts_orchestrator.describe_synth_command(
        planned_engine or "pending", preview_word, language, accent=accent)
    worker._patch_local_task(task, progress=5, status="processing", result_patch={
        "remote_task_id": task_id,
        "engine": planned_engine,
        "synth_command": planned_cmd,
        "text": preview_word if len(words) == 1 else ", ".join(words[:5]),
        "language": language,
    })
    worker._post_result(task_id, "processing", progress=5, attempts=1)

    # Variant list (from laravel tts_variant_specs via the word_audio payload).
    # Words synthesize SEQUENTIALLY per variant (no parallel batch - edge holds a
    # process-wide lock and words are short). Each variant -> one translations[] item.
    raw_variants = payload.get("variants")
    if isinstance(raw_variants, list) and raw_variants:
        variant_list: List[Dict[str, Any]] = []
        for v in raw_variants:
            if isinstance(v, dict):
                variant_list.append({
                    "key": str(v.get("key") or "").strip(),
                    "accent": v.get("accent") if v.get("accent") else accent,
                    "gender": str(v.get("gender") or "female").strip().lower() or "female",
                })
            else:
                variant_list.append({"key": "", "accent": accent, "gender": "female"})
    else:
        variant_list = [{"key": "", "accent": accent, "gender": "female"}]

    translations: list = []
    for word in words:
        for variant in variant_list:
            item = resolve_one_word_audio(
                word, language, variant.get("accent"),
                variant_key=variant.get("key", ""),
                gender=variant.get("gender"))
            if item:
                translations.append(item)
                worker._patch_local_task(task, progress=min(90, 10 + len(translations) * 20),
                                         result_patch={
                                             "engine": item.get("engine"),
                                             "synth_command": item.get("synth_command"),
                                             "audio_path": item.get("audio_path"),
                                             "audio_bytes": len(base64.b64decode(item["audio_base64"]))
                                         if item.get("audio_base64") else None,
                                     })

    if not translations:
        worker._post_result(task_id, "failed",
                            error=f"word_audio: no audio for any of {len(words)} word(s)")
        worker._record_task(task, worker.AUDIO_TASK_TYPE, "failed", posted_back=True,
                            error="no audio produced")
        worker._patch_local_task(task, progress=100, status="failed",
                                   result_patch={"remote_task_id": task_id, "ok": False},
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
    worker._patch_local_task(
        task, progress=100, status="completed",
        result_patch=_word_audio_local_result(
            task_id, language, words, translations, accent, overall_provider),
    )


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
    planned_engine = tts_orchestrator.tts_status().get("active") or tts_orchestrator.best_engine()
    worker._patch_local_task(task, progress=5, status="processing", result_patch={
        "remote_task_id": task_id,
        "engine": planned_engine,
        "synth_command": tts_orchestrator.describe_synth_command(
            planned_engine or "pending", text[:120], language, accent=accent),
        "text": text[:120],
        "language": language,
    })
    worker._post_result(task_id, "processing", progress=5, attempts=1)
    try:
        audio_b64, engine, actual_accent, meta = synthesize_word_audio(
            text, language, accent=accent)
    except Exception as e:
        ColorPrint.red(f"[TranslationWorker] article_audio task {task_id} failed: {e}")
        worker._post_result(task_id, "failed", error=str(e))
        worker._record_task(task, worker.ARTICLE_AUDIO_TASK_TYPE, "failed",
                            posted_back=True, error=str(e))
        worker._patch_local_task(task, progress=100, status="failed",
                                   result_patch={"remote_task_id": task_id, "ok": False},
                                   error=str(e))
        return
    audio_bytes = len(base64.b64decode(audio_b64))
    result = {
        "audio_base64": audio_b64,
        "mime": "audio/mpeg",
        "engine": engine,
        "accent": actual_accent,
    }
    worker._post_result(task_id, "completed", result=result, progress=100)
    worker._record_task(task, worker.ARTICLE_AUDIO_TASK_TYPE, "completed", posted_back=True)
    worker._patch_local_task(task, progress=100, status="completed", result_patch={
        "remote_task_id": task_id,
        "ok": True,
        "text": text[:120],
        "language": language,
        "engine": engine,
        "synth_command": meta.get("synth_command"),
        "audio_bytes": audio_bytes,
        "mime": "audio/mpeg",
        "accent": actual_accent,
    })


def _sentence_variant_spec(payload: Dict[str, Any],
                           task: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve the variant spec for a sentence_audio assist task.

    Mirrors the primary tts_sentence_worker_service shape: ``variants`` is a list
    and the FIRST entry is the primary variant ``{key, accent, gender}``. Assist
    producers may also send flat ``variant_key``/``accent``/``gender`` fields on
    the payload (or task) - those are the fallback. Returns
    ``{variant_key, accent, gender}`` with ``gender`` defaulting to "female"
    (same default as the primary worker).
    """
    variants_src = payload.get("variants") or task.get("variants") or []
    primary_variant: Dict[str, Any] = {}
    if isinstance(variants_src, list) and variants_src and isinstance(variants_src[0], dict):
        primary_variant = variants_src[0]
    variant_key = str(
        primary_variant.get("key")
        or payload.get("variant_key")
        or task.get("variant_key") or ""
    ).strip()
    accent_val = primary_variant.get("accent")
    if accent_val is None:
        accent_val = payload.get("accent")
    if accent_val is None:
        accent_val = task.get("accent")
    accent = str(accent_val).strip().lower() if accent_val else None
    gender_val = (primary_variant.get("gender") or payload.get("gender")
                  or task.get("gender") or "female")
    gender = str(gender_val).strip().lower() or "female"
    return {"variant_key": variant_key, "accent": accent, "gender": gender}


def _voice_type_for_engine(engine: str) -> str:
    """Neural vs machine tag (mirrors tts_sentence_worker_service vmeta)."""
    return "neural" if (engine or "") in ("edge", "azure") else "machine"


def process_sentence_audio_task(worker, task: Dict[str, Any]) -> None:
    """sentence_audio task: synthesize MP3 via the TTS orchestrator -> {audio_base64}.

    Reuses synthesize_word_audio (same edge-tts MP3 path). The posted result
    carries the variant metadata (variant_key/accent/gender/source/voice_type/
    provider) so Laravel's SentenceAudioTaskProcessor can store the produced
    variant - mirrors the vmeta the primary tts_sentence_worker_service reports.
    Disabled / empty / synthesis failure -> 'failed' (re-route).
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
    variant_spec = _sentence_variant_spec(payload, task)
    variant_key = variant_spec["variant_key"]
    accent = variant_spec["accent"]
    gender = variant_spec["gender"]
    planned_engine = tts_orchestrator.tts_status().get("active") or tts_orchestrator.best_engine()
    worker._patch_local_task(task, progress=5, status="processing", result_patch={
        "remote_task_id": task_id,
        "engine": planned_engine,
        "synth_command": tts_orchestrator.describe_synth_command(
            planned_engine or "pending", text[:120], language, accent=accent),
        "text": text[:120],
        "language": language,
        "accent": accent,
        "gender": gender,
        "variant_key": variant_key,
    })
    worker._post_result(task_id, "processing", progress=5, attempts=1)
    try:
        audio_b64, engine, _, meta = synthesize_word_audio(
            text, language, accent=accent, gender=gender, priority_profile="sentence")
    except Exception as e:
        ColorPrint.red(f"[TranslationWorker] sentence_audio task {task_id} failed: {e}")
        worker._post_result(task_id, "failed", error=str(e))
        worker._patch_local_task(task, progress=100, status="failed",
                                   result_patch={"remote_task_id": task_id, "ok": False},
                                   error=str(e))
        return
    voice_type = _voice_type_for_engine(engine)
    result = {
        "audio_base64": audio_b64,
        "mime": "audio/mpeg",
        "engine": engine,
        "provider": engine,
        "accent": accent,
        "gender": gender,
        "variant_key": variant_key,
        "source": "tts",
        "voice_type": voice_type,
    }
    worker._post_result(task_id, "completed", result=result, progress=100)
    worker._patch_local_task(task, progress=100, status="completed", result_patch={
        "remote_task_id": task_id,
        "ok": True,
        "text": text[:120],
        "language": language,
        "engine": engine,
        "provider": engine,
        "synth_command": meta.get("synth_command"),
        "audio_bytes": len(base64.b64decode(audio_b64)),
        "mime": "audio/mpeg",
        "accent": accent,
        "gender": gender,
        "variant_key": variant_key,
        "source": "tts",
        "voice_type": voice_type,
    })
