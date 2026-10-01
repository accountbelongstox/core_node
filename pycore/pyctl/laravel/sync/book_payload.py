# -*- coding: utf-8 -*-
"""
Book / document ingest payload builders for ``laravel_media_sync``.

Owns the /media/ingest body assembly for ONE book/document:
``build_book_payload`` - chapter-aware multi-language correspondence slots
(BOOKS_FEATURE_SPECIFICATION.md section 7); ``source_type`` 'book' or 'document'.

Books map ONLY to the shared sentence library: no segments, no clips. The actual
text EXTRACTION (``extract_text``) lives in the orchestrator (sync_book_source),
NOT here - this seam only shapes already-extracted text into ingest payloads.
"""

import os
from typing import Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

# Reuse the shared ASCII-transcoding backends for book titles.
from pycore.pyutils.common.strtools.filename_sanitizer import (
    _load_backends,
    to_english_ascii,
)
# Book chapter and sentence segmentation. Text EXTRACTION is NOT imported here.
from pycore.pyutils.document_processing.book_chapters import segment_chapters
from pycore.pyutils.document_processing.book_structure import build_book_chapters_v3
# Canonical supported language set + the checked-set normalizer.
from pycore.pyfoundations.text_parsing import normalize_language_codes
# Multi-language statistics engine (primary-language detection + meta for v3).
from pycore.pyutils.common.strtools.text_statistics import compute_text_stats
# Shared constants + pure helpers (cycle-free bottom seam).
from pycore.pyctl.laravel.sync.media_sync_helpers import (
    source_key_for,
    _read_text,
    _put_if,
)


def build_book_payload(
    path: str,
    full_content: str,
    languages: List[str],
    language: str = "en",
    source_type: str = "book",
) -> Dict[str, Any]:
    """Build the /media/ingest body for ONE book/document (BOOKS_FEATURE_SPECIFICATION.md section 7).

    ``source_type`` is ``"book"`` (default) or ``"document"`` - the Add Document
    sub-tab reuses this exact chapter->slot model and only changes the emitted
    ``source_type`` so the rows land in the document bucket. Everything else
    (per-language slots, single-default chapter, content_id) is identical.

    The v3 model is chapter-aware and multi-language-correspondence-aware:
      * ``source`` carries the stable source_key, title/names, the detected primary
        ``language`` (L0), the UI-checked ``selected_languages`` (Lsel, >=1,
        includes L0), the full text backup, an optional poster and TextStats meta.
      * ``chapters`` = ``[{chapter_index, title, sentence_count}]`` (>=1 - a book
        with no detectable headings is a single default "Chapter 1").
      * ``slots`` = ordered correspondence slots, each with ``chapter_index``,
        ``grain`` (cue|sentence), global per-grain ``seq``, ``corr_id`` =
        sha1(source_key|grain|seq), ``primary_language`` and ``langs`` (per
        selected-language text; the primary filled, the others ``null`` = empty).

    The server computes each slot/lang content_id (md5 of lowercase(collapse(strip)))
    from the non-null text; pycore sends the normalized sentence text + nulls.
    ``languages`` is filtered to the canonical supported set and the detected
    primary is forced first (auto-checked, section 5). Empty fields are omitted via
    ``_put_if``. NEVER raises on bad input (empty text -> a single empty chapter).
    """
    language = (language or "en").strip() or "en"
    # Only 'book' / 'document' are valid here; anything else falls back to 'book'.
    source_type = source_type if source_type in ("book", "document") else "book"
    src_abs = os.path.abspath(path or "")
    original_name = os.path.basename(src_abs) if src_abs else ""
    stem = os.path.splitext(original_name)[0] if original_name else ""
    ext = os.path.splitext(original_name)[1].lower() if original_name else ""
    ascii_name = stem
    try:
        backends = _load_backends(False)
        ascii_name = to_english_ascii(stem, backends) or stem
    except Exception as exc:  # noqa: BLE001 - third-party transliteration backends
        ColorPrint.yellow(f"[BookSync] ascii title transcoding failed for {stem!r}: {type(exc).__name__}: {exc}")

    # Detect the primary language from the actual text (language=None so the
    # dominant Unicode script wins) and fall back to the caller's declared
    # ``language`` only when detection is undetermined.
    stats = compute_text_stats(full_content or "", language=None)
    primary_language = stats.get("primary_language") or language
    if primary_language in ("und", "", None):
        primary_language = language

    # Normalize the UI-checked set to the canonical supported codes, primary first.
    selected = normalize_language_codes(languages, primary_language)
    if not selected:
        selected = [primary_language]

    source_key = source_key_for(src_abs)

    # Chapter split. html/htm need the RAW html (tags) to find <h1>/<h2>; for those
    # we re-read the source bytes so the heading split works, then segment_chapters
    # produces tag-stripped chapter bodies. Other formats split over plain text.
    chapter_input = full_content or ""
    if ext in (".html", ".htm") and src_abs and os.path.isfile(src_abs):
        raw_html = _read_text(src_abs)
        if raw_html and raw_html.strip():
            chapter_input = raw_html
    chapters = segment_chapters(chapter_input, ext, primary_language, path=src_abs)

    tree = build_book_chapters_v3(chapters, source_key, selected, primary_language)

    source: Dict[str, Any] = {"source_key": source_key}
    _put_if(source, "title", stem)
    _put_if(source, "original_name", original_name)
    _put_if(source, "ascii_name", ascii_name)
    # Emit CODES only (section 7): use the builder's normalized primary (== selected[0],
    # filtered to SUPPORTED_LANGUAGE_CODES), never a raw/declared name.
    _put_if(source, "language", tree.get("primary_language") or primary_language)
    source["selected_languages"] = tree.get("selected_languages") or selected
    _put_if(source, "full_content", full_content)
    _put_if(source, "sentence_count", tree.get("sentence_count") or None)

    source["metadata"] = {
        "primary_language": stats.get("primary_language"),
        "languages": stats.get("languages"),
        "word_count": stats.get("word_count"),
        "unique_word_count": stats.get("unique_word_count"),
        "sentence_count": stats.get("sentence_count"),
        "unique_sentence_count": stats.get("unique_sentence_count"),
        "char_count": stats.get("char_count"),
        "chapter_count": len(tree.get("chapters") or []),
    }

    return {
        "source_type": source_type,
        "model_version": 3,
        "source": source,
        "chapters": tree.get("chapters") or [],
        "slots": tree.get("slots") or [],
    }
