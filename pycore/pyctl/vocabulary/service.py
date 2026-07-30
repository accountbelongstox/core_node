# -*- coding: utf-8 -*-
"""
Vocabulary workflow proxy for the Laravel vocabulary surface.

The laravel-manager `#/vocabulary` page talks to laravel directly. pycore-manager
must instead talk to pycore (UI -> pycore RPC v2 -> laravel). This service is the
single implementation behind both native and compatibility RPC routes.

Laravel operations owned by this service:
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

import base64
import traceback
from typing import Any, Dict, List, Optional
from urllib.parse import urlsplit

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# Stored-first Laravel endpoint resolution - same plumbing word_audio_router and
# sentence_audio_router use to know which laravel_main to proxy.
from pycore.pyutils.laravel.endpoint_manager import (
    laravel_endpoint_manager,
)
# Unified pycore->Laravel HTTP gateway (times + logs + records every call).
from pycore.pyutils.laravel.client import laravel_client

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
        return laravel_endpoint_manager.resolve() or ""
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
        resp = laravel_client.request(
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


def vocab_resource(url: str) -> Dict[str, Any]:
    """Fetch one selected-Laravel binary resource for an RPC v2 data URL."""
    parsed = urlsplit(str(url or ""))
    path = parsed.path + (f"?{parsed.query}" if parsed.query else "")
    if not path.startswith("/"):
        return {"success": False, "error": "invalid Laravel resource path"}
    base = _laravel_base()
    if not base:
        return {"success": False, "error": "laravel endpoint not configured"}
    try:
        response = laravel_client.get(path, base_url=base, timeout=_VOCAB_TIMEOUT)
        if response.status_code != 200:
            return {"success": False, "error": f"HTTP {response.status_code}"}
        return {
            "success": True,
            "content_base64": base64.b64encode(response.content).decode("ascii"),
            "mime": response.headers.get("Content-Type") or "application/octet-stream",
        }
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc)}


# --------------------------------------------------------------------------- #
# Translation                                                                  #
# --------------------------------------------------------------------------- #
def vocab_translation_languages():
    """GET -> laravel translation language list."""
    return _proxy("GET", _L_TRANSLATION_LANGUAGES)


def vocab_translation_translate(payload: Dict[str, Any]):
    """POST { text, source_language, target_language, ... } -> laravel translate."""
    return _proxy("POST", _L_TRANSLATION_TRANSLATE, json_body=payload)


def vocab_translation_queue_batch_add(payload: Dict[str, Any]):
    """POST -> queue word(s) for (re)translation on laravel."""
    return _proxy("POST", _L_TRANSLATION_QUEUE_BATCH_ADD, json_body=payload)


# --------------------------------------------------------------------------- #
# TTS                                                                          #
# --------------------------------------------------------------------------- #
def vocab_tts_generate(payload: Dict[str, Any]):
    """Generate TTS and inline Laravel audio bytes for the RPC v2 UI."""
    result = _proxy("POST", _L_TTS_GENERATE, json_body=payload)
    data = result.get("data") if isinstance(result.get("data"), dict) else result
    audio_url = data.get("audio_url") if isinstance(data, dict) else None
    if not audio_url or data.get("audio_base64"):
        return result
    parsed = urlsplit(str(audio_url))
    audio_path = parsed.path + (f"?{parsed.query}" if parsed.query else "")
    try:
        response = laravel_client.get(
            audio_path,
            base_url=_laravel_base(),
            timeout=_VOCAB_TIMEOUT,
        )
        if response.status_code == 200:
            data["audio_base64"] = base64.b64encode(response.content).decode("ascii")
            data["mime"] = response.headers.get("Content-Type") or "audio/mpeg"
        else:
            result["success"] = False
            result["error"] = f"Laravel TTS audio returned HTTP {response.status_code}"
    except Exception as exc:  # noqa: BLE001
        result["success"] = False
        result["error"] = f"Laravel TTS audio fetch failed: {exc}"
    return result


def vocab_tts_queue_batch_query(payload: List[Dict[str, Any]]):
    """POST -> request/refresh word audio via laravel TTS queue.

    The laravel route takes a BARE ARRAY body (Array<{content, language, type}>),
    not an object, so this handler accepts a list and forwards it verbatim."""
    return _proxy("POST", _L_TTS_QUEUE_BATCH_QUERY, json_body=payload)


def vocab_tts_sentence_audio(query_params: Optional[Dict[str, Any]] = None):
    """GET -> resolve sentence audio (file-first) on laravel."""
    return _proxy("GET", _L_TTS_SENTENCE_AUDIO, params=dict(query_params or {}))


# --------------------------------------------------------------------------- #
# TTS queue                                                                    #
# --------------------------------------------------------------------------- #
def vocab_tts_queue_stats():
    """GET -> TTS queue status / type counts."""
    return _proxy("GET", _L_TTS_QUEUE_STATS)


def vocab_tts_queue_items(query_params: Optional[Dict[str, Any]] = None):
    """GET -> paginated TTS queue items by status/type."""
    return _proxy("GET", _L_TTS_QUEUE_ITEMS, params=dict(query_params or {}))


# --------------------------------------------------------------------------- #
# Assist overview                                                              #
# --------------------------------------------------------------------------- #
def vocab_assist_overview():
    """GET -> worker queue categories + roster."""
    return _proxy("GET", _L_ASSIST_OVERVIEW)


def vocab_assist_overview_items(query_params: Optional[Dict[str, Any]] = None):
    """GET -> paginated rows for one assist category."""
    return _proxy("GET", _L_ASSIST_OVERVIEW_ITEMS, params=dict(query_params or {}))


def vocab_cover_retry(payload: Dict[str, Any]):
    """POST -> retry a failed library cover (reset to pending)."""
    return _proxy("POST", _L_COVER_RETRY, json_body=payload)


# --------------------------------------------------------------------------- #
# Libraries                                                                    #
# --------------------------------------------------------------------------- #
def vocab_libraries(query_params: Optional[Dict[str, Any]] = None):
    """GET -> libraries (paged, by language)."""
    return _proxy("GET", _L_LIBRARIES, params=dict(query_params or {}))


def vocab_library_words(library_id: int, query_params: Optional[Dict[str, Any]] = None):
    """GET -> paginated words for one library + stats."""
    return _proxy(
        "GET",
        _L_LIBRARY_WORDS.format(library_id=library_id),
        params=dict(query_params or {}),
    )


def vocab_delete_library(library_id: int):
    """DELETE -> delete a user-created library."""
    return _proxy("DELETE", _L_LEARNING_LIBRARY.format(library_id=library_id))


# --------------------------------------------------------------------------- #
# Statistics                                                                   #
# --------------------------------------------------------------------------- #
def vocab_statistics(query_params: Optional[Dict[str, Any]] = None):
    """GET -> vocab stats (totals, optionally paged words)."""
    return _proxy("GET", _L_STATISTICS, params=dict(query_params or {}))


def vocab_language_breakdown(query_params: Optional[Dict[str, Any]] = None):
    """GET -> per-language word/translation/audio/invalid counts."""
    return _proxy("GET", _L_LANGUAGE_BREAKDOWN, params=dict(query_params or {}))


# --------------------------------------------------------------------------- #
# Dictionary words                                                             #
# --------------------------------------------------------------------------- #
def vocab_dictionary_words(query_params: Optional[Dict[str, Any]] = None):
    """GET -> paginated dictionary words by filter + search + sort."""
    return _proxy("GET", _L_DICTIONARY_WORDS, params=dict(query_params or {}))


def vocab_create_dictionary_word(payload: Dict[str, Any]):
    """POST -> create/upsert a dictionary word."""
    return _proxy("POST", _L_DICTIONARY_WORDS, json_body=payload)


def vocab_update_dictionary_word(md5: str, payload: Dict[str, Any]):
    """POST -> update a word's editable fields.

    Exposed as POST so the frontend uses the shared HTTP controller client.
    the native router RPC is used instead of a browser HTTP proxy. Internally this still
    issues a PUT to laravel to match the upstream REST route."""
    return _proxy("PUT", _L_DICTIONARY_WORDS_ITEM.format(md5=md5), json_body=payload)


def vocab_delete_dictionary_word(md5: str, query_params: Optional[Dict[str, Any]] = None):
    """DELETE ?language= -> delete a single word."""
    return _proxy(
        "DELETE",
        _L_DICTIONARY_WORDS_ITEM.format(md5=md5),
        params=dict(query_params or {}),
    )


def vocab_batch_dictionary_words(payload: Dict[str, Any]):
    """POST -> batch action (delete/mark_valid/mark_invalid/requeue_tts)."""
    return _proxy("POST", _L_DICTIONARY_WORDS_BATCH, json_body=payload)


def vocab_dictionary_sentences(query_params: Optional[Dict[str, Any]] = None):
    """GET -> example sentences for one word."""
    return _proxy("GET", _L_DICTIONARY_SENTENCES, params=dict(query_params or {}))


# --------------------------------------------------------------------------- #
# Validity                                                                     #
# --------------------------------------------------------------------------- #
def vocab_validity_report(payload: Dict[str, Any]):
    """POST -> report word validity (revalidate)."""
    return _proxy("POST", _L_VALIDITY_REPORT, json_body=payload)


# --------------------------------------------------------------------------- #
# Storage summary                                                              #
# --------------------------------------------------------------------------- #
def vocab_storage_summary():
    """GET -> static resources summary (audio/image/video counts + sizes).

    Proxies the servermanager surface on the SAME laravel base, so the
    vocabulary page's storage header stays UI -> pycore -> laravel."""
    return _proxy("GET", _L_STORAGE_SUMMARY)
