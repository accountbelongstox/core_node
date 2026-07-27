# -*- coding: utf-8 -*-
"""
Vocabulary router - pycore proxy for the laravel_main vocabulary surface.

The laravel-manager `#/vocabulary` page talks to laravel directly. pycore-manager
must instead talk to pycore (UI -> pycore -> laravel). This router re-exposes the
vocabulary endpoints under /api/local/vocabulary/* as a pure passthrough proxy to
laravel_main, so the pycore-manager Vocabulary page only ever hits pycore.

Endpoints (prefix /api/local/vocabulary):
  Translation:  GET  /translation/languages, POST /translation/translate,
                POST /translation/queue/batch/add
  TTS:          POST /tts/generate, POST /tts/queue/batch/query,
                GET  /tts/sentence-audio
  TTS queue:    GET  /tts-queue/stats, GET /tts-queue/items
  Assist:       GET  /assist/overview, GET /assist/overview/items,
                POST /cover/retry
  Libraries:    GET  /libraries, GET /libraries/{id}/words, DELETE /libraries/{id}
  Statistics:   GET  /statistics, GET /language-breakdown
  Dictionary:   GET  /dictionary/words, POST /dictionary/words,
                POST /dictionary/words/{md5} (update; proxied as PUT to laravel),
                DELETE /dictionary/words/{md5},
                POST /dictionary/words/batch, GET /dictionary/sentences
  Storage:      GET  /storage-summary

Every handler NEVER raises - on any error it returns a graceful
{success: False, error: ...} JSON (no 500), matching word_audio_router.py. Query
params are forwarded transparently via fastapi.Request.query_params; POST/PUT
bodies are forwarded as-is. The laravel base URL is resolved stored-first via
the shared laravel_endpoint_manager (same plumbing as word-audio/sentence-audio).

pycore rules honored: imports at file top (PYTHON_PYCORE.md §1.4), logging only
via ColorPrint, English-only strings, secrets/HTTP only via the shared helpers.
"""

import traceback
from typing import Any, Dict, List, Optional

import fastapi

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# Stored-first Laravel endpoint resolution - same plumbing word_audio_router and
# sentence_audio_router use to know which laravel_main to proxy.
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
# Unified pycore->Laravel HTTP gateway (times + logs + records every call).
from pycore.callmodule.services.sync.laravel_client import get_laravel_client

router = fastapi.APIRouter(prefix="/api/local/vocabulary", tags=["Local Processing - Vocabulary"])

# --- laravel_main paths (proxied 1:1) -------------------------------------- #
_L_TRANSLATION_LANGUAGES = "/api/app_qy_v1/ai_tools/translation/languages"
_L_TRANSLATION_TRANSLATE = "/api/app_qy_v1/ai_tools/translation/translate"
_L_TRANSLATION_QUEUE_BATCH_ADD = "/api/app_qy_v1/ai_tools/translation/queue/batch/add"
_L_TTS_GENERATE = "/api/app_qy_v1/ai_tools/tts/generate"
_L_TTS_QUEUE_BATCH_QUERY = "/api/app_qy_v1/ai_tools/tts/queue/batch/query"
_L_TTS_SENTENCE_AUDIO = "/api/app_qy_v1/ai_tools/tts/sentence/audio"
_L_TTS_QUEUE_STATS = "/api/app_qy_v1/ai_tools/tts/queue/stats"
_L_TTS_QUEUE_ITEMS = "/api/app_qy_v1/tts/queue/items"
_L_ASSIST_OVERVIEW = "/api/app_qy_v1/assist/overview"
_L_ASSIST_OVERVIEW_ITEMS = "/api/app_qy_v1/assist/overview/items"
_L_COVER_RETRY = "/api/app_qy_v1/assist/cover/retry"
_L_LIBRARIES = "/api/app_qy_v1/vocabulary/libraries"
_L_LIBRARY_WORDS = "/api/app_qy_v1/vocabulary/libraries/{library_id}/words"
_L_LEARNING_LIBRARY = "/api/app_qy_v1/learning/libraries/{library_id}"
_L_STATISTICS = "/api/app_qy_v1/vocabulary/statistics"
_L_LANGUAGE_BREAKDOWN = "/api/app_qy_v1/vocabulary/language-breakdown"
_L_DICTIONARY_WORDS = "/api/app_qy_v1/dictionary/words"
_L_DICTIONARY_WORDS_ITEM = "/api/app_qy_v1/dictionary/words/{md5}"
_L_DICTIONARY_WORDS_BATCH = "/api/app_qy_v1/dictionary/words/batch"
_L_DICTIONARY_SENTENCES = "/api/app_qy_v1/dictionary/sentences"
_L_VALIDITY_REPORT = "/api/app_qy_v1/vocabulary/validity/report"
_L_STORAGE_SUMMARY = "/api/servermanager/v1/system/static-resources"

# 10 min - laravel vocabulary endpoints can be slow / briefly unreachable; let
# the proxy wait instead of surfacing a read-timeout on every poll (mirrors the
# word-audio batch timeout).
_VOCAB_TIMEOUT = 600


# --------------------------------------------------------------------------- #
# helpers                                                                      #
# --------------------------------------------------------------------------- #
def _laravel_base() -> str:
    """Resolve the laravel_main base URL (stored-first). Never raises."""
    try:
        return get_laravel_endpoint_manager().resolve() or ""
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[Vocabulary] laravel endpoint resolve failed: {exc}")
        return ""


def _proxy(
    method: str,
    laravel_path: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    json_body: Optional[Any] = None,
    timeout: float = _VOCAB_TIMEOUT,
) -> Dict[str, Any]:
    """Pure passthrough proxy to laravel_main. Never raises - returns a graceful
    {success: False, error: ...} envelope on any failure (no 500). The laravel
    JSON body is returned verbatim on success (the FE consumes laravel's native
    shapes)."""
    base = _laravel_base()
    if not base:
        return {"success": False, "error": "laravel endpoint not configured"}
    try:
        resp = get_laravel_client().request(
            method, laravel_path, base_url=base,
            params=params, json=json_body, timeout=timeout,
        )
        if resp.status_code >= 400:
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
        try:
            return resp.json()
        except ValueError:
            return {"success": False, "error": "non-JSON response"}
    except Exception as exc:  # noqa: BLE001 - never 500; print full traceback
        ColorPrint.red(f"[Vocabulary] {method} {laravel_path} failed: {exc}\n{traceback.format_exc()}")
        return {"success": False, "error": f"proxy error: {exc}"}


# --------------------------------------------------------------------------- #
# Translation                                                                  #
# --------------------------------------------------------------------------- #
@router.get("/translation/languages")
def vocab_translation_languages():
    """GET -> laravel translation language list."""
    return _proxy("GET", _L_TRANSLATION_LANGUAGES)


@router.post("/translation/translate")
def vocab_translation_translate(payload: Dict[str, Any]):
    """POST { text, source_language, target_language, ... } -> laravel translate."""
    return _proxy("POST", _L_TRANSLATION_TRANSLATE, json_body=payload)


@router.post("/translation/queue/batch/add")
def vocab_translation_queue_batch_add(payload: Dict[str, Any]):
    """POST -> queue word(s) for (re)translation on laravel."""
    return _proxy("POST", _L_TRANSLATION_QUEUE_BATCH_ADD, json_body=payload)


# --------------------------------------------------------------------------- #
# TTS                                                                          #
# --------------------------------------------------------------------------- #
@router.post("/tts/generate")
def vocab_tts_generate(payload: Dict[str, Any]):
    """POST { text, language, ... } -> laravel TTS generate."""
    return _proxy("POST", _L_TTS_GENERATE, json_body=payload)


@router.post("/tts/queue/batch/query")
def vocab_tts_queue_batch_query(payload: List[Dict[str, Any]]):
    """POST -> request/refresh word audio via laravel TTS queue.

    The laravel route takes a BARE ARRAY body (Array<{content, language, type}>),
    not an object, so this handler accepts a list and forwards it verbatim."""
    return _proxy("POST", _L_TTS_QUEUE_BATCH_QUERY, json_body=payload)


@router.get("/tts/sentence-audio")
def vocab_tts_sentence_audio(request: fastapi.Request):
    """GET -> resolve sentence audio (file-first) on laravel."""
    return _proxy("GET", _L_TTS_SENTENCE_AUDIO, params=dict(request.query_params))


# --------------------------------------------------------------------------- #
# TTS queue                                                                    #
# --------------------------------------------------------------------------- #
@router.get("/tts-queue/stats")
def vocab_tts_queue_stats():
    """GET -> TTS queue status / type counts."""
    return _proxy("GET", _L_TTS_QUEUE_STATS)


@router.get("/tts-queue/items")
def vocab_tts_queue_items(request: fastapi.Request):
    """GET -> paginated TTS queue items by status/type."""
    return _proxy("GET", _L_TTS_QUEUE_ITEMS, params=dict(request.query_params))


# --------------------------------------------------------------------------- #
# Assist overview                                                              #
# --------------------------------------------------------------------------- #
@router.get("/assist/overview")
def vocab_assist_overview():
    """GET -> worker queue categories + roster."""
    return _proxy("GET", _L_ASSIST_OVERVIEW)


@router.get("/assist/overview/items")
def vocab_assist_overview_items(request: fastapi.Request):
    """GET -> paginated rows for one assist category."""
    return _proxy("GET", _L_ASSIST_OVERVIEW_ITEMS, params=dict(request.query_params))


@router.post("/cover/retry")
def vocab_cover_retry(payload: Dict[str, Any]):
    """POST -> retry a failed library cover (reset to pending)."""
    return _proxy("POST", _L_COVER_RETRY, json_body=payload)


# --------------------------------------------------------------------------- #
# Libraries                                                                    #
# --------------------------------------------------------------------------- #
@router.get("/libraries")
def vocab_libraries(request: fastapi.Request):
    """GET -> libraries (paged, by language)."""
    return _proxy("GET", _L_LIBRARIES, params=dict(request.query_params))


@router.get("/libraries/{library_id}/words")
def vocab_library_words(library_id: int, request: fastapi.Request):
    """GET -> paginated words for one library + stats."""
    return _proxy(
        "GET",
        _L_LIBRARY_WORDS.format(library_id=library_id),
        params=dict(request.query_params),
    )


@router.delete("/libraries/{library_id}")
def vocab_delete_library(library_id: int):
    """DELETE -> delete a user-created library."""
    return _proxy("DELETE", _L_LEARNING_LIBRARY.format(library_id=library_id))


# --------------------------------------------------------------------------- #
# Statistics                                                                   #
# --------------------------------------------------------------------------- #
@router.get("/statistics")
def vocab_statistics(request: fastapi.Request):
    """GET -> vocab stats (totals, optionally paged words)."""
    return _proxy("GET", _L_STATISTICS, params=dict(request.query_params))


@router.get("/language-breakdown")
def vocab_language_breakdown(request: fastapi.Request):
    """GET -> per-language word/translation/audio/invalid counts."""
    return _proxy("GET", _L_LANGUAGE_BREAKDOWN, params=dict(request.query_params))


# --------------------------------------------------------------------------- #
# Dictionary words                                                             #
# --------------------------------------------------------------------------- #
@router.get("/dictionary/words")
def vocab_dictionary_words(request: fastapi.Request):
    """GET -> paginated dictionary words by filter + search + sort."""
    return _proxy("GET", _L_DICTIONARY_WORDS, params=dict(request.query_params))


@router.post("/dictionary/words")
def vocab_create_dictionary_word(payload: Dict[str, Any]):
    """POST -> create/upsert a dictionary word."""
    return _proxy("POST", _L_DICTIONARY_WORDS, json_body=payload)


@router.post("/dictionary/words/{md5}")
def vocab_update_dictionary_word(md5: str, payload: Dict[str, Any]):
    """POST -> update a word's editable fields.

    Exposed as POST (not PUT) so the FE uses postJSON with its WS fallback -
    the native router RPC is used instead of a browser HTTP proxy. Internally this still
    issues a PUT to laravel to match the upstream REST route."""
    return _proxy("PUT", _L_DICTIONARY_WORDS_ITEM.format(md5=md5), json_body=payload)


@router.delete("/dictionary/words/{md5}")
def vocab_delete_dictionary_word(md5: str, request: fastapi.Request):
    """DELETE ?language= -> delete a single word."""
    return _proxy(
        "DELETE",
        _L_DICTIONARY_WORDS_ITEM.format(md5=md5),
        params=dict(request.query_params),
    )


@router.post("/dictionary/words/batch")
def vocab_batch_dictionary_words(payload: Dict[str, Any]):
    """POST -> batch action (delete/mark_valid/mark_invalid/requeue_tts)."""
    return _proxy("POST", _L_DICTIONARY_WORDS_BATCH, json_body=payload)


@router.get("/dictionary/sentences")
def vocab_dictionary_sentences(request: fastapi.Request):
    """GET -> example sentences for one word."""
    return _proxy("GET", _L_DICTIONARY_SENTENCES, params=dict(request.query_params))


# --------------------------------------------------------------------------- #
# Validity                                                                     #
# --------------------------------------------------------------------------- #
@router.post("/validity/report")
def vocab_validity_report(payload: Dict[str, Any]):
    """POST -> report word validity (revalidate)."""
    return _proxy("POST", _L_VALIDITY_REPORT, json_body=payload)


# --------------------------------------------------------------------------- #
# Storage summary                                                              #
# --------------------------------------------------------------------------- #
@router.get("/storage-summary")
def vocab_storage_summary():
    """GET -> static resources summary (audio/image/video counts + sizes).

    Proxies the servermanager surface on the SAME laravel base, so the
    vocabulary page's storage header stays UI -> pycore -> laravel."""
    return _proxy("GET", _L_STORAGE_SUMMARY)
