# -*- coding: utf-8 -*-
"""Books user-data persistence - the "books" section helpers.

Extracted from BooksController (reuse-batch) so the per-source persistence
(upsert / state / compact summary / persist_analysis) is reusable independent of
the controller's analyze/submit flow. The "books" section stores each source's
path, mode, source_key, language, submission_state, added/analyzed/synced_at and
a compact analysis summary, so the UI reloads history on reopen/switch.

These are MODULE functions taking a ``user_data_store`` (the shared UserDataStore
singleton from get_user_data_store()) for the read/write helpers; the pure
helpers (state_response / upsert_source / compact_summary) take only the
section/analysis they transform. Signatures mirror the former BooksController
methods (minus ``self``, plus ``store``) so the controller's thin delegators
preserve its public API for books_router.py.
"""

import os
import time
from typing import Optional

from pycore.callmodule.services.sync.laravel_media_sync import source_key_for
from pycore.callmodule.models.local_processing.books_models import (
    BookSourceState,
    BooksStateResponse,
    BooksAnalyzeResponse,
)

# User-data section persisting Books sources + their (compact) analysis +
# submission state, so the UI reloads history on reopen/switch.
_BOOKS_SECTION = "books"


def _norm_path(path: str) -> str:
    """Normalize a path for dedupe comparison."""
    return os.path.normcase(os.path.abspath((path or "").strip()))


def get_section(store) -> dict:
    return store.get_section(_BOOKS_SECTION) or {"sources": [], "last_options": {}}


def save_section(store, section: dict) -> None:
    store.set_section(_BOOKS_SECTION, section)


def state_response(section: dict) -> BooksStateResponse:
    sources = [BookSourceState(**s) for s in section.get("sources", [])]
    return BooksStateResponse(success=True, sources=sources,
                              last_options=section.get("last_options", {}))


def get_state(store) -> BooksStateResponse:
    return state_response(get_section(store))


def upsert_source(section: dict, path: str, mode: str,
                  language: Optional[str] = None, **patch) -> dict:
    """Upsert a source by source_key; return the record. Mutates section."""
    abs_path = os.path.abspath((path or "").strip())
    key = source_key_for(abs_path)
    sources = section.setdefault("sources", [])
    rec = next((s for s in sources if s.get("source_key") == key), None)
    if rec is None:
        rec = {
            "path": abs_path, "mode": mode, "source_key": key,
            "language": language, "submission_state": "draft",
            "added_at": time.time(), "analyzed_at": None,
            "synced_at": None, "summary": None,
        }
        sources.append(rec)
    rec["mode"] = mode or rec.get("mode") or "file"
    if language:
        rec["language"] = language
    rec.update(patch)
    return rec


def add_source(store, path: str, mode: str = "file",
               language: Optional[str] = None) -> BooksStateResponse:
    section = get_section(store)
    upsert_source(section, path, mode, language)
    save_section(store, section)
    return state_response(section)


def remove_source(store, path: str) -> BooksStateResponse:
    section = get_section(store)
    target = _norm_path(path)
    section["sources"] = [s for s in section.get("sources", [])
                          if _norm_path(s.get("path", "")) != target]
    save_section(store, section)
    return state_response(section)


def compact_summary(a: BooksAnalyzeResponse) -> dict:
    """A small, persistable summary of an analysis (no full preview text)."""
    return {
        "scanned": a.scanned, "analyzed": a.analyzed, "mode": a.mode,
        "aggregate": a.aggregate.model_dump() if a.aggregate else None,
        "files": [{
            "name": f.name, "ext": f.ext,
            "words": f.stats.word_count if f.stats else 0,
            "unique_words": f.stats.unique_word_count if f.stats else 0,
            "sentences": f.stats.sentence_count if f.stats else 0,
            "unique_sentences": f.stats.unique_sentence_count if f.stats else 0,
            "primary_language": f.stats.primary_language if f.stats else "und",
            "error": f.error,
        } for f in a.files[:100]],
    }


def persist_analysis(store, path: str, mode: str, analysis: BooksAnalyzeResponse,
                     language: Optional[str] = None) -> None:
    """Store a compact analysis summary onto the source record (upsert)."""
    section = get_section(store)
    upsert_source(section, path, mode, language,
                  analyzed_at=time.time(),
                  summary=compact_summary(analysis))
    save_section(store, section)
