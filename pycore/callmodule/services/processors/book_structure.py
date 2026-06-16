# -*- coding: utf-8 -*-
"""
book_structure — build the v2 structured representation of a book's text.

pycore does ALL the processing locally, then submits ONCE to laravel_main. For a
book this module turns the extracted plain text into the contract shape
(pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md §8):

  * sentences   — DISTINCT, punctuation-STRIPPED, normalized rows with a stable
                  md5 ``content_id`` (so "Hello, world" / "Hello world!" dedupe).
  * sentence_seq— ordered reconstruction tokens: {"s":content_id} for a sentence
                  and {"m":marker_code} for the punctuation between sentences
                  (repeats allowed), using the canonical punctuation-marker lib.
  * words       — DISTINCT words bucketed by language, each {content_id=md5(word),
                  content}; laravel upserts them into app_qy_v1_tts_cache_<lang>.
  * content_id  — md5 of the whole stripped+normalized text (the book's unique id).

Pure business logic (app layer): may import pyfoundations + pyutils freely. Never
raises on bad input — empty text yields an empty structure.
"""

import hashlib
import re
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.text_parsing import (
    tokenize_words,
    guess_language,
)
from pycore.pyfoundations.punctuation_markers import (
    strip_punctuation,
    segment_with_markers,
)
from pycore.pyutils.text_stats import compute_text_stats


def _normalize(text: str) -> str:
    """Casefold + collapse whitespace (the canonical form md5'd for content_id)."""
    return re.sub(r"\s+", " ", (text or "").strip()).casefold()


def _content_id(stripped_normalized: str) -> str:
    """md5 of an already stripped+normalized string (hex)."""
    return hashlib.md5(stripped_normalized.encode("utf-8")).hexdigest()


def sentence_content(raw_sentence: str) -> str:
    """Stored sentence text = punctuation-stripped + whitespace-normalized.

    Keeps original case in the STORED text (content_id uses a casefolded variant
    for dedup); returns '' when nothing remains after stripping.
    """
    stripped = strip_punctuation(raw_sentence or "")
    return re.sub(r"\s+", " ", stripped).strip()


def build_book_structure(text: str, language: Optional[str] = None) -> Dict[str, Any]:
    """Build the v2 structured representation for one book's text.

    Returns:
        {
          "content_id": <md5 of stripped+normalized full text>,
          "sentences": [ {content_id, text, language, seq}, ... ],   # DISTINCT
          "sentence_seq": [ {"s": content_id} | {"m": marker_code}, ... ],
          "words": { "<lang>": [ {content_id, content}, ... ], ... }, # DISTINCT/lang
          "stats": { ...compute_text_stats... },
          "sentence_count": <distinct sentence count>,
        }
    Empty/blank text yields zeroed fields.
    """
    empty = {
        "content_id": "",
        "sentences": [],
        "sentence_seq": [],
        "words": {},
        "stats": compute_text_stats("", language),
        "sentence_count": 0,
    }
    if not (text and text.strip()):
        return empty

    primary_lang = (language or "").strip() or guess_language(text)

    # ---- sentences + reconstruction sequence ------------------------------ #
    distinct: Dict[str, Dict[str, Any]] = {}     # content_id -> sentence row
    sentence_seq: List[Dict[str, str]] = []
    next_seq = 0
    for tok in segment_with_markers(text):
        if tok["kind"] == "marker":
            sentence_seq.append({"m": tok["code"]})
            continue
        content = sentence_content(tok["text"])
        if not content:
            continue
        norm = _normalize(content)
        if not norm:
            continue
        cid = _content_id(norm)
        if cid not in distinct:
            # Per-sentence language detection (book may be mixed); fall back to
            # the book's primary language when a sentence has no letters.
            lang = guess_language(tok["text"])
            if lang == "und":
                lang = primary_lang
            distinct[cid] = {
                "content_id": cid,
                "text": content,
                "language": lang,
                "seq": next_seq,
            }
            next_seq += 1
        sentence_seq.append({"s": cid})

    # ---- words bucketed by language --------------------------------------- #
    # The shared word library (app_qy_v1_tts_cache_<lang>) is case-folded so word
    # variants dedupe ("The"/"the") and the same word agrees with the laravel
    # Books path (which lowercases too). content_id = md5(lowercased word).
    # Detect language + hash ONCE per DISTINCT lowercased word, not per
    # occurrence: a book like a Bible has ~724k word occurrences but only ~15k
    # distinct words, so guessing the language of every occurrence was ~50x
    # redundant CPU (the dominant cost that stalled submit before any ingest
    # POST). A word's lowercase form fully determines its language and cid, so
    # deduping by ``wl`` first is byte-for-byte equivalent to the old result.
    words_by_lang: Dict[str, Dict[str, Dict[str, str]]] = {}   # lang -> cid -> row
    seen_words: set = set()                                    # distinct wl seen
    for w in tokenize_words(text):
        if not w:
            continue
        wl = w.lower()
        if not wl or wl in seen_words:
            continue
        seen_words.add(wl)
        lang = guess_language(wl)
        if lang == "und":
            lang = primary_lang
        cid = hashlib.md5(wl.encode("utf-8")).hexdigest()
        words_by_lang.setdefault(lang, {})[cid] = {"content_id": cid, "content": wl}
    words = {lang: list(rows.values()) for lang, rows in words_by_lang.items()}

    # ---- book content_id + stats ------------------------------------------ #
    book_cid = _content_id(_normalize(strip_punctuation(text)))

    return {
        "content_id": book_cid,
        "sentences": list(distinct.values()),
        "sentence_seq": sentence_seq,
        "words": words,
        "stats": compute_text_stats(text, language),
        "sentence_count": len(distinct),
    }
