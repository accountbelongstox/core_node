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
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.sentence_segmenter import sentence_segmenter
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.queue_center_contract import queue_center_endpoint
from pycore.pyutils.common.strtools.normalization import media_content_id
from pycore.pyutils.laravel.client import laravel_client, laravel_failure
from pycore.pyutils.common.background_jobs import BackgroundJobs

from pycore.pyctl.audio_orchestration import orch_contract, orch_store

_LARAVEL_BOOKS = queue_center_endpoint("orch_books")
_LARAVEL_PHRASES = queue_center_endpoint("phrases_by_sentences")
_BOOKS_PAGE_SIZE = 100
# Small sentence pages: Laravel answers each page with bounded work (keyset
# after_seq when supported), and a failure costs one page, not the book.
_SENTENCES_PAGE_SIZE = 500
_PAGE_TIMEOUT_SECONDS = 45
_PAGE_ATTEMPTS = 3
_PAGE_RETRY_DELAYS_SECONDS = (2.0, 5.0)
_RETRY_WAIT_SIGNAL = "audio_orchestration.page_retry.wait"
# Sentences per phrases_by_sentences request (the endpoint accepts at most 500).
_PHRASES_PAGE_SIZE = 500
_PHRASES_SAVE_EVERY_PAGES = 10
# A sentence in one of these states has its final phrase list and is never asked again.
_PHRASE_STATUS_FINAL = ("done", "none")
BOOKS_SYNC_KEY = "books"

# Background fetch jobs (UI calls return immediately - relay-safe - while these
# threads do the multi-page Laravel walk; state is visible via sync_state).
_sync_jobs = BackgroundJobs("AudioOrchSync")

# Rough speaking-rate estimates used for the "minutes" partition mode.


class _PageFailure(Exception):
    """One Laravel page failed after every retry (carries the stable code)."""

    def __init__(self, failure: Dict[str, Any]) -> None:
        super().__init__(str(failure.get("error_code") or "LARAVEL_REQUEST_FAILED"))
        self.failure = failure


def _job_running(key: str) -> bool:
    return _sync_jobs.running(key)


def _attempt_state(status: str, **fields: Any) -> Dict[str, Any]:
    """One sync attempt's state. A new attempt REPLACES the previous record,
    so an old failure never outlives the next attempt."""
    return {"status": status, **fields}


def sync_states() -> Dict[str, Any]:
    """Persisted sync states; a 'running' record without a live job (process
    restart mid-fetch) is closed as interrupted - resumable from its partial."""
    states = orch_store.load_sync_state()
    for key, state in list(states.items()):
        if state.get("status") == "running" and not _job_running(key):
            states[key] = {**state, "status": "failed", "error_code": "BOOK_SYNC_INTERRUPTED", "detail": ""}
            orch_store.save_sync_state(key, states[key])
    return states


def _enveloped_data(body: Any) -> Optional[Dict[str, Any]]:
    data = body.get("data") if isinstance(body, dict) else None
    return data if isinstance(data, dict) else None


def _request_page(
    path: str,
    params: Optional[Dict[str, Any]] = None,
    method: str = "GET",
    body: Optional[Dict[str, Any]] = None,
    unwrap: Callable[[Any], Optional[Dict[str, Any]]] = _enveloped_data,
) -> Dict[str, Any]:
    """Request one Laravel page with bounded retries; returns what ``unwrap``
    extracts from the answer (the ``data`` dict by default).

    Raises ``_PageFailure`` with a stable error code after the last attempt.
    """
    failure: Dict[str, Any] = {}
    for attempt in range(_PAGE_ATTEMPTS):
        if attempt:
            THREAD_BUS.wait_signal(_RETRY_WAIT_SIGNAL, timeout=_PAGE_RETRY_DELAYS_SECONDS[min(attempt, len(_PAGE_RETRY_DELAYS_SECONDS)) - 1])
        try:
            response = laravel_client.request(
                method, path, params=params, json=body, timeout=_PAGE_TIMEOUT_SECONDS,
            )
        except Exception as exc:  # noqa: BLE001 - classified and retried
            ColorPrint.yellow(f"[AudioOrch] page fetch failed ({path}, attempt {attempt + 1}): {exc}")
            failure = laravel_failure(exc)
            continue
        if response.status_code != 200:
            failure = laravel_failure(status_code=response.status_code)
            if response.status_code < 500 and response.status_code != 429:
                break
            continue
        data = unwrap(response.json() if response.content else None)
        if data is not None:
            return data
        failure = {"error_code": "LARAVEL_BAD_RESPONSE", "detail": "missing data", "status": response.status_code}
    raise _PageFailure(failure)


def _fetch_books_blocking() -> List[Dict[str, Any]]:
    """Full multi-page books fetch (runs on a background thread only)."""
    items: List[Dict[str, Any]] = []
    page = 1
    while True:
        data = _request_page(_LARAVEL_BOOKS, {"page": page, "per_page": _BOOKS_PAGE_SIZE})
        page_items = data.get("items") if isinstance(data.get("items"), list) else []
        if not page_items:
            break
        items.extend(page_items)
        orch_store.save_sync_state(BOOKS_SYNC_KEY, _attempt_state(
            "running", fetched=len(items), attempt_at=int(time.time()),
        ))
        last_page = int(data.get("last_page") or page)
        if page >= last_page:
            break
        page += 1
    return items


def _books_job() -> None:
    started = int(time.time())
    orch_store.save_sync_state(BOOKS_SYNC_KEY, _attempt_state("running", fetched=0, attempt_at=started))
    try:
        items = _fetch_books_blocking()
    except _PageFailure as failure:
        ColorPrint.yellow(f"[AudioOrch] books fetch failed: {failure.failure}")
        orch_store.save_sync_state(BOOKS_SYNC_KEY, _attempt_state(
            "failed", attempt_at=started, finished_at=int(time.time()),
            error_code=failure.failure.get("error_code"), detail=failure.failure.get("detail") or "",
        ))
        return
    if not orch_store.save_books_cache(items):
        orch_store.save_sync_state(BOOKS_SYNC_KEY, _attempt_state(
            "failed", attempt_at=started, finished_at=int(time.time()),
            error_code="BOOKS_CACHE_WRITE_FAILED", detail="",
        ))
        return
    orch_store.save_sync_state(BOOKS_SYNC_KEY, _attempt_state(
        "done", fetched=len(items), attempt_at=started, finished_at=int(time.time()),
    ))


def _start_books_job() -> bool:
    # The job records its own 'running' state once registered, so a
    # concurrent sync_states() never mistakes it for an interrupted run.
    return _sync_jobs.start(BOOKS_SYNC_KEY, _books_job)


def fetch_books(refresh: bool = False) -> Dict[str, Any]:
    """Relay-safe books listing: always answers from the local cache instantly.
    ``refresh=True`` (or an empty cache) starts a background Laravel fetch whose
    progress is readable through ``sync``; the UI polls while it runs. ``sync``
    describes ONLY the books-list attempt (per-book sentence syncs are
    reported per book)."""
    cached = orch_store.load_books_cache()
    state = sync_states().get(BOOKS_SYNC_KEY) or {}
    running = _job_running(BOOKS_SYNC_KEY)
    if (refresh or (not cached.get("items") and state.get("status") != "failed")) and not running:
        running = _start_books_job() or _job_running(BOOKS_SYNC_KEY)
    return {
        "success": True,
        "cached": True,
        "items": cached.get("items") or [],
        "fetched_at": cached.get("fetched_at") or 0,
        "refreshing": running,
        "sync": orch_store.load_sync_state().get(BOOKS_SYNC_KEY) or state,
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


def _sentence_page(source_key: str, cursor: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any], bool]:
    """Fetch one sentence page; returns (data, next cursor, finished).

    Keyset mode (``after_seq`` + ``after_id``; no OFFSET / COUNT on Laravel)
    is used when the server supports it; an older server ignores the cursor
    and answers page 1, detected by the missing ``next_after_seq`` - the walk
    then continues with page numbers.
    """
    params: Dict[str, Any] = {
        "grain": "sentence",
        "per_page": _SENTENCES_PAGE_SIZE,
        "include_enrichment": "0",
    }
    if cursor.get("mode") != "page":
        params["after_seq"] = int(cursor.get("after_seq") or 0)
        params["after_id"] = int(cursor.get("after_id") or 0)
    else:
        params["page"] = int(cursor.get("page") or 1)
    data = _request_page(queue_center_endpoint("orch_book_detail", source_key=source_key), params)
    page_data = data.get("sentences") if isinstance(data.get("sentences"), dict) else None
    if page_data is None:
        raise _PageFailure({"error_code": "BOOK_SENTENCE_PAGE_MISSING", "detail": "", "status": 200})
    if cursor.get("mode") != "page" and "next_after_seq" in page_data:
        next_after = page_data.get("next_after_seq")
        finished = not bool(page_data.get("has_more")) or next_after is None
        return data, {
            "mode": "keyset",
            "after_seq": int(next_after or 0),
            "after_id": int(page_data.get("next_after_id") or 0),
        }, finished
    page = int(page_data.get("current_page") or cursor.get("page") or 1)
    last_page = int(page_data.get("last_page") or page)
    return data, {"mode": "page", "page": page + 1}, page >= last_page


def _fetch_sentences_blocking(source_key: str) -> Dict[str, Any]:
    """Resumable multi-page sentence fetch (background thread or generation).

    Progress persists after every page (``orch_store`` partial), so a failed
    or interrupted sync resumes where it stopped instead of restarting.
    """
    partial = orch_store.load_book_sentences_partial(source_key) or {}
    sentences: List[Dict[str, Any]] = list(partial.get("sentences") or [])
    source: Dict[str, Any] = dict(partial.get("source") or {})
    cursor: Dict[str, Any] = dict(partial.get("cursor") or {"mode": "keyset", "after_seq": 0, "after_id": 0})
    total = int(partial.get("total") or 0)
    attempt_at = int(time.time())
    while True:
        data, next_cursor, finished = _sentence_page(source_key, cursor)
        if not source and isinstance(data.get("source"), dict):
            source = data["source"]
        page_data = data["sentences"]
        items = page_data.get("items") if isinstance(page_data.get("items"), list) else []
        for item in items:
            if isinstance(item, dict):
                sentence = _extract_sentence(item)
                if sentence is not None:
                    sentences.append(sentence)
        total = int(page_data.get("total") or total or 0)
        if not items and not finished:
            raise _PageFailure({"error_code": "BOOK_SENTENCE_PAGE_INCOMPLETE", "detail": "", "status": 200})
        cursor = next_cursor
        orch_store.save_book_sentences_partial(source_key, {
            "source": source, "sentences": sentences, "cursor": cursor, "total": total,
        })
        orch_store.save_sync_state(source_key, _attempt_state(
            "running", fetched=len(sentences), total=total, attempt_at=attempt_at,
        ))
        _sync_jobs.notify(source_key)
        if finished:
            break
    payload = {
        "source_key": source_key,
        "title": str(source.get("title") or source.get("original_name") or source_key),
        "language": str(source.get("language") or "en"),
        "fetched_at": int(time.time()),
        "sentences": sentences,
    }
    if not orch_store.save_book_sentences(source_key, payload):
        raise _PageFailure({"error_code": "BOOK_SENTENCE_CACHE_WRITE_FAILED", "detail": "", "status": 0})
    orch_store.delete_book_sentences_partial(source_key)
    return {"success": True, **payload}


def _sentences_job(source_key: str) -> None:
    started = int(time.time())
    try:
        payload = _fetch_sentences_blocking(source_key)
    except _PageFailure as failure:
        ColorPrint.yellow(f"[AudioOrch] sentence sync failed for {source_key}: {failure.failure}")
        partial = orch_store.load_book_sentences_partial(source_key) or {}
        orch_store.save_sync_state(source_key, _attempt_state(
            "failed", attempt_at=started, finished_at=int(time.time()),
            fetched=len(partial.get("sentences") or []), total=int(partial.get("total") or 0),
            error_code=failure.failure.get("error_code"), detail=failure.failure.get("detail") or "",
        ))
        return
    orch_store.save_sync_state(source_key, _attempt_state(
        "done", attempt_at=started, finished_at=int(time.time()),
        fetched=len(payload.get("sentences") or []), total=len(payload.get("sentences") or []),
    ))


def sync_book_sentences(source_key: str, refresh: bool = False) -> Dict[str, Any]:
    """Relay-safe sentence sync: answers from the local cache instantly and
    runs the (long) Laravel walk on a background thread. Never raises."""
    source_key = str(source_key or "").strip()
    if not source_key:
        return {"success": False, "error": "BOOK_SOURCE_KEY_REQUIRED"}
    cached = orch_store.load_book_sentences(source_key)
    has_cache = bool(
        cached and isinstance(cached.get("sentences"), list) and cached["sentences"]
    )
    running = _job_running(source_key)
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
    partial = orch_store.load_book_sentences_partial(source_key) or {}
    orch_store.save_sync_state(source_key, _attempt_state(
        "running", fetched=len(partial.get("sentences") or []), total=int(partial.get("total") or 0),
        attempt_at=int(time.time()),
    ))
    _sentences_job(source_key)


def ensure_book_sentences(source_key: str, cancel_requested=None, progress_callback=None) -> Dict[str, Any]:
    """Blocking sentence fetch for GENERATION (worker thread, no relay
    deadline). Uses the cache when present; otherwise runs the resumable
    background sync and waits for it."""
    source_key = str(source_key or "").strip()
    if not source_key:
        return {"success": False, "error": "BOOK_SOURCE_KEY_REQUIRED"}
    if not _job_running(source_key):
        cached = orch_store.load_book_sentences(source_key)
        if cached and isinstance(cached.get("sentences"), list) and cached["sentences"]:
            return {"success": True, "cached": True, **cached}
        sync_book_sentences(source_key)
    wake = _sync_jobs.job_signal(source_key)
    while True:
        # Clear before checking: page progress and the job's finish re-set
        # the signal, so the wait never misses a change (no timer polling).
        THREAD_BUS.clear_signal(wake)
        if not _job_running(source_key):
            break
        if cancel_requested is not None and cancel_requested():
            return {"success": False, "error": "cancelled"}
        if progress_callback is not None:
            progress_callback(orch_store.load_sync_state().get(source_key) or {})
        THREAD_BUS.wait_signal(wake)
    state = orch_store.load_sync_state().get(source_key) or {}
    if state.get("status") == "failed":
        return {"success": False, "error": state.get("error_code") or "BOOK_SENTENCE_SYNC_FAILED"}
    cached = orch_store.load_book_sentences(source_key)
    if cached and isinstance(cached.get("sentences"), list) and cached["sentences"]:
        return {"success": True, "cached": True, **cached}
    return {"success": False, "error": "BOOK_SENTENCES_EMPTY"}


def wake_sentence_waiters(source_key: str) -> None:
    _sync_jobs.notify(str(source_key or "").strip())


# --------------------------------------------------------------------------- #
# sentence phrases (Laravel phrases_by_sentences)                              #
# --------------------------------------------------------------------------- #
def sentence_language_text(sentence: Dict[str, Any], lang: str) -> str:
    """The text of one sentence in ``lang`` (its translation, or its own text
    when that is the sentence language)."""
    languages = sentence.get("languages") or {}
    text = str(languages.get(lang) or "").strip()
    if not text and lang == str(sentence.get("language") or ""):
        text = str(sentence.get("text") or "").strip()
    return text


def sentence_content_id(sentence: Dict[str, Any], language: str) -> str:
    """Laravel identity of a sentence (``media_content_id`` of its text), '' when it has no text."""
    text = sentence_language_text(sentence, language)
    return media_content_id(text) if text else ""


def _phrase_payload(body: Any) -> Optional[Dict[str, Any]]:
    payload = body.get("data") if isinstance(body, dict) and isinstance(body.get("data"), dict) else body
    return payload if isinstance(payload, dict) and isinstance(payload.get("items"), list) else None


def _phrases_of(sentence_ids: List[str], sentences: Dict[str, Any], phrases: Dict[str, Any]) -> Dict[str, List[Dict[str, str]]]:
    """``{sentence content id: [{content_id, text, meaning}]}`` of the sentences that have phrases."""
    found: Dict[str, List[Dict[str, str]]] = {}
    for sentence_id in sentence_ids:
        entry = sentences.get(sentence_id)
        rows = [
            {"content_id": phrase_id, "text": str(phrases[phrase_id]["text"]), "meaning": str(phrases[phrase_id].get("meaning") or "")}
            for phrase_id in (entry.get("phrases") if isinstance(entry, dict) else None) or []
            if isinstance(phrases.get(phrase_id), dict) and phrases[phrase_id].get("text")
        ]
        if rows:
            found[sentence_id] = rows
    return found


def _sentence_ids(sentences: List[Dict[str, Any]], language: str) -> List[str]:
    return list(dict.fromkeys(
        sentence_id for sentence_id in (sentence_content_id(sentence, language) for sentence in sentences) if sentence_id
    ))


def cached_sentence_phrases(language: str, sentences: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, str]]]:
    """Phrases of the sentences already fetched (no request): plan previews."""
    if language not in orch_contract.PHRASE_LANGUAGES:
        return {}
    cache = orch_store.load_sentence_phrase_cache(language)
    return _phrases_of(_sentence_ids(sentences, language), cache["sentences"], cache["phrases"])


def phrase_meanings(language: str, texts: List[str]) -> Dict[str, str]:
    """``{phrase text: Chinese meaning}`` of the phrases the cache knows with a meaning."""
    phrases = orch_store.load_sentence_phrase_cache(language)["phrases"]
    meanings: Dict[str, str] = {}
    for text in texts:
        entry = phrases.get(media_content_id(text))
        if isinstance(entry, dict) and entry.get("meaning"):
            meanings[text] = str(entry["meaning"])
    return meanings


def ensure_sentence_phrases(
    language: str,
    sentences: List[Dict[str, Any]],
    cancel_requested: Optional[Callable[[], bool]] = None,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> Dict[str, Any]:
    """Blocking phrase lookup for GENERATION (worker thread): sentences with a
    final status come from the local cache, the others are asked from Laravel
    in pages of 500 (``phrases_by_sentences``); sentences whose phrases are not
    extracted yet are not cached and are asked again on the next run. Returns
    ``{success, phrases, pending, total}`` or ``{success: False, error}``."""
    if language not in orch_contract.PHRASE_LANGUAGES:
        return {"success": True, "phrases": {}, "pending": 0, "total": 0}
    cache = orch_store.load_sentence_phrase_cache(language)
    known_sentences: Dict[str, Any] = dict(cache["sentences"])
    known_phrases: Dict[str, Any] = dict(cache["phrases"])
    sentence_ids = _sentence_ids(sentences, language)
    wanted = [sentence_id for sentence_id in sentence_ids if sentence_id not in known_sentences]
    pending = 0
    pages = 0
    failure: Optional[Dict[str, Any]] = None
    for offset in range(0, len(wanted), _PHRASES_PAGE_SIZE):
        if cancel_requested is not None and cancel_requested():
            return {"success": False, "error": "cancelled"}
        if progress_callback is not None:
            progress_callback(offset, len(wanted))
        page_ids = wanted[offset:offset + _PHRASES_PAGE_SIZE]
        try:
            payload = _request_page(
                _LARAVEL_PHRASES, method="POST", body={"language": language, "content_ids": page_ids},
                unwrap=_phrase_payload,
            )
        except _PageFailure as page_failure:
            ColorPrint.yellow(f"[AudioOrch] phrases fetch failed ({language}): {page_failure.failure}")
            failure = page_failure.failure
            break
        answered = set()
        for row in payload["items"]:
            sentence_id = str(row.get("content_id") or "") if isinstance(row, dict) else ""
            if sentence_id not in page_ids or sentence_id in answered:
                continue
            answered.add(sentence_id)
            if str(row.get("status") or "") not in _PHRASE_STATUS_FINAL:
                pending += 1
                continue
            phrase_ids: List[str] = []
            for phrase in row.get("phrases") if isinstance(row.get("phrases"), list) else []:
                text = str(phrase.get("text") or "").strip() if isinstance(phrase, dict) else ""
                phrase_id = media_content_id(text) if text else ""
                if not phrase_id:
                    continue
                known_phrases[phrase_id] = {"text": text, "meaning": str(phrase.get("meaning") or "").strip()}
                if phrase_id not in phrase_ids:
                    phrase_ids.append(phrase_id)
            known_sentences[sentence_id] = {"status": str(row["status"]), "phrases": phrase_ids}
        pending += len(page_ids) - len(answered)
        pages += 1
        if pages % _PHRASES_SAVE_EVERY_PAGES == 0:
            orch_store.save_sentence_phrase_cache(language, known_sentences, known_phrases)
    if pages:
        orch_store.save_sentence_phrase_cache(language, known_sentences, known_phrases)
    if failure is not None:
        return {"success": False, "error": str(failure.get("error_code") or "LARAVEL_REQUEST_FAILED")}
    return {
        "success": True,
        "phrases": _phrases_of(sentence_ids, known_sentences, known_phrases),
        "pending": pending,
        "total": len(sentence_ids),
    }


def estimate_sentence_seconds(sentence: Dict[str, Any]) -> float:
    """Rough spoken-duration estimate for one sentence across its languages."""
    seconds = sum(
        sentence_segmenter.estimate_seconds(text, str(code))
        for code, text in (sentence.get("languages") or {}).items() if text
    )
    if seconds <= 0.0:
        seconds = sentence_segmenter.estimate_seconds(str(sentence.get("text") or "") or "x", "en")
    return seconds + sentence_segmenter.sentence_gap_seconds


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
    "wake_sentence_waiters",
    "sentence_language_text",
    "sentence_content_id",
    "cached_sentence_phrases",
    "ensure_sentence_phrases",
    "phrase_meanings",
    "estimate_sentence_seconds",
    "partition_sentences",
]
