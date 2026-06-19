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
    normalize_language_codes,
)
from pycore.pyfoundations.punctuation_markers import (
    strip_punctuation,
    segment_with_markers,
)
from pycore.pyutils.text_stats import compute_text_stats

# Sentence segmentation (BOTH grains) lives in book_processor; reuse it so the
# v3 slot builder produces the SAME cue/sentence rows the rest of the pipeline
# uses. book_processor imports only video_extract_processor, so importing it here
# (app layer) stays cycle-free.
from pycore.callmodule.services.processors.book_processor import segment_sentences


def _normalize(text: str) -> str:
    """Lowercase + collapse whitespace (the canonical form md5'd for content_id).

    Uses ``str.lower()`` (NOT ``casefold``) so pycore's content_id agrees with the
    AUTHORITATIVE laravel content_id (``mb_strtolower``) for non-ASCII letters —
    casefold maps e.g. sharp-s to "ss" and the final sigma differently from
    mb_strtolower, which would split the dedup key across the two ends.
    """
    return re.sub(r"\s+", " ", (text or "").strip()).lower()


def _content_id(stripped_normalized: str) -> str:
    """md5 of an already stripped+normalized string (hex)."""
    return hashlib.md5(stripped_normalized.encode("utf-8")).hexdigest()


def sentence_content(raw_sentence: str) -> str:
    """Stored sentence text = punctuation-stripped + whitespace-normalized.

    Keeps original case in the STORED text (content_id uses a lowercased variant
    for dedup, matching laravel mb_strtolower); returns '' when nothing remains
    after stripping.
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


# --------------------------------------------------------------------------- #
# v3 — chapter -> correspondence-slot tree (BOOKS_FEATURE_SPECIFICATION.md §5/§7) #
# --------------------------------------------------------------------------- #
def _slot_corr_id(source_key: str, grain: str, seq: int) -> str:
    """Stable per-slot correspondence id = sha1(source_key|grain|seq) (§5)."""
    return hashlib.sha1(f"{source_key}|{grain}|{seq}".encode("utf-8")).hexdigest()


def _chapter_corr_id(source_key: str, chapter_index: int) -> str:
    """Stable cross-language chapter group id = sha1(source_key|chapter|index) (§3.2)."""
    return hashlib.sha1(
        f"{source_key}|chapter|{chapter_index}".encode("utf-8")).hexdigest()


def build_book_chapters_v3(
    chapters: List[Dict[str, Any]],
    source_key: str,
    selected_languages: List[str],
    primary_language: str,
) -> Dict[str, Any]:
    """Build the v3 chapter list + ordered correspondence slots for ONE book.

    ``chapters`` is the output of ``book_processor.segment_chapters`` —
    ``[{chapter_index, title, text}]`` (always >=1; a no-heading book is a single
    default chapter). For each chapter, BOTH grains (cue + sentence) are derived
    via ``segment_sentences``; each derived row becomes a correspondence SLOT.

    Correspondence semantics (§5): the scanner only has the book's primary-language
    text, so for every slot ``langs[primary] = <normalized sentence text>`` and
    every other selected language is ``None`` (left empty). ``corr_id`` is
    stable per (source_key, grain, seq). ``seq`` is GLOBAL per grain across the
    whole book (matching the v2 server-side unique(source,grain,seq) contract).

    Per-sentence language detection still runs: when a slot's own text is detected
    as one of the OTHER selected languages (a genuinely multi-language book line),
    that language is filled instead of (or in addition to) the primary.

    Each chapter carries a per-language ``titles`` map (v3.1, §3.2/§7): only the
    primary language's title is filled; every other selected language is ``None``
    (left empty). A stable ``corr_id`` (sha1(source_key|chapter|chapter_index))
    groups the same chapter across the per-language chapter tables.

    Returns ``{chapters: [{chapter_index, corr_id, sentence_count, titles}],
               slots: [...], sentence_count, cue_count}``.
    """
    selected = normalize_language_codes(selected_languages, primary_language)
    if not selected:
        # Defensive: enforce >=1 by falling back to the primary (already cleaned
        # by the caller, but guarantee a non-empty langs map).
        primary = (primary_language or "en").strip().lower() or "en"
        selected = [primary]
    primary = selected[0]

    out_chapters: List[Dict[str, Any]] = []
    slots: List[Dict[str, Any]] = []
    # Global per-grain sequence counters (book-wide, 0-based).
    seq_by_grain: Dict[str, int] = {"cue": 0, "sentence": 0}

    for ch in (chapters or []):
        chapter_index = int(ch.get("chapter_index", 0) or 0)
        ch_text = ch.get("text") or ""
        rows = segment_sentences(ch_text, primary)
        ch_sentence_count = 0
        for row in rows:
            grain = row.get("grain") or "sentence"
            raw_text = row.get("text") or ""
            # Stored sentence text = punctuation-stripped + whitespace-normalized
            # (the server computes content_id from this; matches v2 semantics).
            content = sentence_content(raw_text)
            if not content:
                continue
            seq = seq_by_grain.get(grain, 0)
            seq_by_grain[grain] = seq + 1
            if grain == "sentence":
                ch_sentence_count += 1

            # Per-slot per-language text map: primary filled, others empty unless a
            # genuinely different selected language is detected for this line.
            langs: Dict[str, Optional[str]] = {lang: None for lang in selected}
            slot_lang = guess_language(raw_text)
            if slot_lang in selected and slot_lang != primary:
                langs[slot_lang] = content
            else:
                langs[primary] = content

            slots.append({
                "chapter_index": chapter_index,
                "grain": grain,
                "seq": seq,
                "corr_id": _slot_corr_id(source_key, grain, seq),
                "primary_language": primary,
                "langs": langs,
                "seg_index": None,
                "sub_idx": None,
                "start_sec": None,
                "end_sec": None,
            })
        # Per-language chapter titles (v3.1): primary filled, others null (empty).
        titles: Dict[str, Optional[str]] = {lang: None for lang in selected}
        titles[primary] = ch.get("title") or "Chapter 1"
        out_chapters.append({
            "chapter_index": chapter_index,
            "corr_id": _chapter_corr_id(source_key, chapter_index),
            "sentence_count": ch_sentence_count,
            "titles": titles,
        })

    return {
        "chapters": out_chapters,
        "slots": slots,
        "selected_languages": selected,
        "primary_language": primary,
        "sentence_count": seq_by_grain.get("sentence", 0),
        "cue_count": seq_by_grain.get("cue", 0),
    }
