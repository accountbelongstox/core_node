# -*- coding: utf-8 -*-
"""
Book list / sentence fetching and segment partitioning for audio orchestration.

Books come from the Laravel media browser API (read-only):
    GET /api/app_qy_v1/media/books                    paginated book list
    GET /api/app_qy_v1/media/books/{source_key}       paginated sentences
                                                      (grain=sentence; the
                                                      book->sentence mapping of
                                                      MediaBrowseController)

Fetched data is cached locally via orch_store so the UI works offline after the
first sync and old tasks can be regenerated without re-fetching.
"""

import time
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.common.background_jobs import BackgroundJobs

from pycore.pyctl.audio_orchestration import orch_store

_LARAVEL_BOOKS = "/api/app_qy_v1/media/books"
_LARAVEL_BOOK_DETAIL = "/api/app_qy_v1/media/books/{source_key}"
_BOOKS_PAGE_SIZE = 100
_SENTENCES_PAGE_SIZE = 2000
_REQUEST_TIMEOUT = 60

# Background fetch jobs (UI calls return immediately — relay-safe — while these
# threads do the multi-page Laravel walk; state is visible via sync_state).
_sync_jobs = BackgroundJobs("AudioOrchSync")

# Rough speaking-rate estimates used for the "minutes" partition mode.
_EN_WORDS_PER_SECOND = 2.5
_ZH_CHARS_PER_SECOND = 4.5
_SENTENCE_GAP_SECONDS = 1.0


def _job_running(key: str) -> bool:
    return _sync_jobs.running(key)


def sync_states() -> Dict[str, Any]:
    states = orch_store.load_sync_state()
    for key, state in states.items():
        if state.get("status") == "running" and not _job_running(key):
            current = orch_store.load_sync_state().get(key) or {}
            states[key] = current
            if current.get("status") == "running":
                states[key] = {**current, "status": "failed", "error": "book_sync_interrupted"}
                orch_store.save_sync_state(key, states[key])
    return states


def _start_job(key: str, target) -> None:
    _sync_jobs.start(key, target)


def _fetch_books_blocking() -> Dict[str, Any]:
    """Full multi-page books fetch (runs on a background thread only)."""
    items: List[Dict[str, Any]] = []
    page = 1
    while True:
        resp = laravel_client.get(
            _LARAVEL_BOOKS,
            params={"page": page, "per_page": _BOOKS_PAGE_SIZE},
            timeout=_REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}")
        body = resp.json()
        data = body.get("data") if isinstance(body, dict) else None
        page_items = data.get("items") if isinstance(data, dict) else None
        if not isinstance(page_items, list) or not page_items:
            break
        items.extend(page_items)
        orch_store.save_sync_state("books", {
            "status": "running", "fetched": len(items),
        })
        last_page = int(data.get("last_page") or page)
        if page >= last_page:
            break
        page += 1
    if not orch_store.save_books_cache(items):
        return {"success": False, "error": "books_cache_write_failed", "items": items}
    return {"items": items, "fetched_at": int(time.time())}


def _books_job() -> None:
    try:
        result = _fetch_books_blocking()
        orch_store.save_sync_state("books", {
            "status": "failed" if result.get("success") is False else "done",
            "fetched": len(result["items"]), "error": result.get("error"),
        })
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] books fetch failed: {exc}")
        orch_store.save_sync_state("books", {
            "status": "failed", "error": str(exc),
        })


def fetch_books(refresh: bool = False) -> Dict[str, Any]:
    """Relay-safe books listing: always answers from the local cache instantly.
    ``refresh=True`` (or an empty cache) starts a background Laravel fetch whose
    progress is readable through sync_state; the UI polls for the result."""
    cached = orch_store.load_books_cache()
    state = orch_store.load_sync_state().get("books") or {}
    running = _job_running("books")
    if (refresh or (not cached.get("items") and state.get("status") != "failed")) and not running:
        orch_store.save_sync_state("books", {"status": "running", "fetched": 0})
        _start_job("books", _books_job)
        running = True
    return {
        "success": True,
        "cached": True,
        "items": cached.get("items") or [],
        "fetched_at": cached.get("fetched_at") or 0,
        "refreshing": running,
        "sync": orch_store.load_sync_state().get("books") or state,
    }


def _extract_sentence(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    text = str(item.get("text") or "").strip()
    languages = item.get("languages") if isinstance(item.get("languages"), dict) else {}
    if not text and languages:
        for entry in languages.values():
            if isinstance(entry, dict) and str(entry.get("text") or "").strip():
                text = str(entry["text"]).strip()
                break
            if isinstance(entry, str) and entry.strip():
                text = entry.strip()
                break
    if not text:
        return None
    lang_texts: Dict[str, str] = {}
    primary_lang = str(item.get("language") or "").strip() or "en"
    lang_texts[primary_lang] = text
    for code, entry in languages.items():
        value = ""
        if isinstance(entry, dict):
            value = str(entry.get("text") or "").strip()
        elif isinstance(entry, str):
            value = entry.strip()
        if value:
            lang_texts[str(code)] = value
    return {
        "seq": int(item.get("seq") or 0),
        "chapter_index": item.get("chapter_index"),
        "language": primary_lang,
        "text": text,
        "languages": lang_texts,
    }


def _fetch_sentences_blocking(source_key: str) -> Dict[str, Any]:
    """Full multi-page sentence fetch (background thread or generation only)."""
    sentences: List[Dict[str, Any]] = []
    source: Dict[str, Any] = {}
    page = 1
    while True:
        resp = laravel_client.get(
            _LARAVEL_BOOK_DETAIL.format(source_key=quote(source_key, safe="")),
            params={
                "grain": "sentence",
                "per_page": _SENTENCES_PAGE_SIZE,
                "page": page,
                "include_enrichment": "0",
            },
            timeout=_REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}")
        body = resp.json()
        data = body.get("data") if isinstance(body, dict) else None
        if not isinstance(data, dict):
            raise RuntimeError("unexpected response shape")
        if not source and isinstance(data.get("source"), dict):
            source = data["source"]
        if not isinstance(data.get("sentences"), dict):
            return {"success": False, "error": "book_sentence_page_missing"}
        page_data = data["sentences"]
        items = page_data.get("items") if isinstance(page_data.get("items"), list) else []
        for item in items:
            if isinstance(item, dict):
                sentence = _extract_sentence(item)
                if sentence is not None:
                    sentences.append(sentence)
        total = int(page_data.get("total") or 0)
        orch_store.save_sync_state(source_key, {
            "status": "running", "fetched": len(sentences), "total": total,
        })
        last_page = int(page_data.get("last_page") or page)
        if not items and page < last_page:
            return {"success": False, "error": "book_sentence_page_incomplete"}
        if page >= last_page:
            break
        page += 1
    payload = {
        "source_key": source_key,
        "title": str(source.get("title") or source.get("original_name") or source_key),
        "language": str(source.get("language") or "en"),
        "fetched_at": int(time.time()),
        "sentences": sentences,
    }
    if not orch_store.save_book_sentences(source_key, payload):
        return {"success": False, "error": "book_sentence_cache_write_failed"}
    return {"success": True, **payload}


def _sentences_job(source_key: str) -> None:
    try:
        payload = _fetch_sentences_blocking(source_key)
        orch_store.save_sync_state(source_key, {
            "status": "failed" if payload.get("success") is False else "done",
            "fetched": len(payload.get("sentences") or []), "error": payload.get("error"),
        })
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] sentence sync failed for {source_key}: {exc}")
        orch_store.save_sync_state(source_key, {
            "status": "failed", "error": str(exc),
        })


def sync_book_sentences(source_key: str, refresh: bool = False) -> Dict[str, Any]:
    """Relay-safe sentence sync: answers from the local cache instantly and
    runs the (long) Laravel walk on a background thread. Never raises."""
    source_key = str(source_key or "").strip()
    if not source_key:
        return {"success": False, "error": "source_key is required"}
    cached = orch_store.load_book_sentences(source_key)
    has_cache = bool(
        cached and isinstance(cached.get("sentences"), list) and cached["sentences"]
    )
    running = _job_running(source_key)
    state = orch_store.load_sync_state().get(source_key) or {}
    if (refresh or not has_cache) and not running:
        running = _sync_jobs.start(source_key, _sync_sentences, source_key) or _job_running(source_key)
    state = orch_store.load_sync_state().get(source_key) or {}
    result: Dict[str, Any] = {
        "success": True,
        "cached": has_cache,
        "syncing": running,
        "sync": state,
        "source_key": source_key,
    }
    if isinstance(cached, dict):
        result.update({
            "title": cached.get("title"),
            "language": cached.get("language"),
            "fetched_at": cached.get("fetched_at") or 0,
            "sentences": cached.get("sentences") or [],
        })
    return result


def _sync_sentences(source_key: str) -> None:
    orch_store.save_sync_state(source_key, {"status": "running", "fetched": 0})
    _sentences_job(source_key)


def ensure_book_sentences(source_key: str, cancel_requested=None, progress_callback=None) -> Dict[str, Any]:
    """Blocking sentence fetch for GENERATION (worker thread, no relay
    deadline). Uses the cache when present; otherwise fetches inline."""
    source_key = str(source_key or "").strip()
    if not source_key:
        return {"success": False, "error": "book_source_key_required"}
    if not _job_running(source_key):
        cached = orch_store.load_book_sentences(source_key)
        if cached and isinstance(cached.get("sentences"), list) and cached["sentences"]:
            return {"success": True, "cached": True, **cached}
        sync_book_sentences(source_key)
    while _job_running(source_key):
        if cancel_requested is not None and cancel_requested():
            return {"success": False, "error": "cancelled"}
        if progress_callback is not None:
            progress_callback(orch_store.load_sync_state().get(source_key) or {})
        THREAD_BUS.wait_signal("audio_orchestration.sentences.wait", timeout=1)
    state = orch_store.load_sync_state().get(source_key) or {}
    if state.get("status") == "failed":
        return {"success": False, "error": state.get("error") or "book_sentence_sync_failed"}
    cached = orch_store.load_book_sentences(source_key)
    if cached and isinstance(cached.get("sentences"), list) and cached["sentences"]:
        return {"success": True, "cached": True, **cached}
    return {"success": False, "error": "book_sentences_empty"}


def estimate_sentence_seconds(sentence: Dict[str, Any]) -> float:
    """Rough spoken-duration estimate for one sentence across its languages."""
    seconds = 0.0
    for code, text in (sentence.get("languages") or {}).items():
        if not text:
            continue
        if str(code).lower().startswith(("zh", "cn", "ja", "ko")):
            seconds += len(text) / _ZH_CHARS_PER_SECOND
        else:
            seconds += max(1, len(text.split())) / _EN_WORDS_PER_SECOND
    if seconds <= 0.0:
        seconds = max(1, len(str(sentence.get("text") or "").split())) / _EN_WORDS_PER_SECOND
    return seconds + _SENTENCE_GAP_SECONDS


def partition_sentences(
    sentences: List[Dict[str, Any]],
    mode: str,
    value: int,
) -> List[Dict[str, Any]]:
    """Split the ordered sentence list into segments.

    mode="count"   -> ``value`` segments, balanced by estimated duration.
    mode="minutes" -> segments of roughly ``value`` minutes each.
    Returns [{index, start, end, sentence_count, est_seconds}] (start/end are
    inclusive sentence list positions; empty input -> [])."""
    total = len(sentences)
    if total == 0:
        return []
    estimates = [estimate_sentence_seconds(s) for s in sentences]
    segments: List[Dict[str, Any]] = []

    if mode == "minutes":
        target = max(1, int(value)) * 60.0
        start = 0
        acc = 0.0
        for index in range(total):
            acc += estimates[index]
            if acc >= target or index == total - 1:
                segments.append({
                    "index": len(segments) + 1,
                    "start": start,
                    "end": index,
                    "sentence_count": index - start + 1,
                    "est_seconds": round(acc, 1),
                })
                start = index + 1
                acc = 0.0
        return segments

    count = max(1, min(int(value), total))
    total_seconds = sum(estimates) or float(total)
    per_segment = total_seconds / count
    start = 0
    acc = 0.0
    for index in range(total):
        acc += estimates[index]
        remaining = count - len(segments)
        if remaining <= 1:
            continue
        # Cut here when this segment reached its duration share AND enough
        # sentences remain for the segments still to come (>= 1 each).
        if acc >= per_segment and (total - index - 1) >= remaining - 1:
            segments.append({
                "index": len(segments) + 1,
                "start": start,
                "end": index,
                "sentence_count": index - start + 1,
                "est_seconds": round(acc, 1),
            })
            start = index + 1
            acc = 0.0
    segments.append({
        "index": len(segments) + 1,
        "start": start,
        "end": total - 1,
        "sentence_count": total - start,
        "est_seconds": round(acc, 1),
    })
    return segments


__all__ = [
    "fetch_books",
    "sync_states",
    "sync_book_sentences",
    "ensure_book_sentences",
    "estimate_sentence_seconds",
    "partition_sentences",
]
