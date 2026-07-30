# -*- coding: utf-8 -*-
"""
Book chapter segmentation for document ingestion.

Split out of book_processor.py (modular 800-line rule). Owns the heading
heuristics and the format-specific chapter splitters (prose/markdown/html/epub).
``segment_chapters`` is the single public entry point; book_processor.py
re-exports it for the facade public API. NEVER raises - any failure degrades to
the single-chapter fallback.

Reuse-first: the epub spine/TOC path obtains ebooklib + BeautifulSoup via the
lazy third_party getters (get_third_package_ebooklib / get_third_package_bs4)
instead of module-level bare imports, matching book_text_extraction's pattern;
when unavailable it degrades to the heading heuristics over the plain text.
"""

import os
import re
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyfoundations.third_party.api import get_third_package_ebooklib, get_third_package_bs4
from pycore.pyutils.common.strtools.normalization import (
    collapse_horizontal_whitespace,
    collapse_whitespace,
)



# --------------------------------------------------------------------------- #
# Heading heuristics constants (prose/markdown/html)                           #
# --------------------------------------------------------------------------- #
# Default single-chapter title when a book yields no detectable headings (§8).
_DEFAULT_CHAPTER_TITLE = "Chapter 1"

# Bible / Tanakh book names (standalone line = chapter boundary for scripture PDFs).
_BIBLE_BOOK_RES = [
    re.compile(r"^(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|"
               r"Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|"
               r"Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|"
               r"Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|"
               r"Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|"
               r"Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\b",
               re.IGNORECASE),
    re.compile(r"^\d?\s*(?:Samuel|Kings|Chronicles|Corinthians|Thessalonians|Timothy|Peter)\b",
               re.IGNORECASE),
]
# as a chapter heading when it matches ANY of these (checked on the stripped
# line). Order is not significant - first match wins.
_CHAPTER_HEADING_RES = [
    # "Chapter 12", "CHAPTER IV" (Latin numerals or Roman numerals).
    re.compile(r"^(?:chapter|chap\.?)\s+[\dIVXLCDM]+\b", re.IGNORECASE),
    # "Part 3", "Book II", "Section 5", "Act I".
    re.compile(r"^(?:part|book|section|act)\s+[\dIVXLCDM]+\b", re.IGNORECASE),
    # CJK chapter heading: leading chapter marker + Han/Arabic numerals + a CJK
    # chapter/volume unit (data required by BOOKS_FEATURE_SPECIFICATION.md §8).
    re.compile(r"^第\s*[0-9一二三四五六七八九十百千零两]+\s*[章回节節卷篇]"),
    # Markdown ATX headings ("# Title", "## Title", up to ###).
    re.compile(r"^#{1,3}\s+\S"),
    # A bare numbered heading: "1." / "12)" / "3 - Title" - short standalone line.
    re.compile(r"^\d{1,3}[.)\-]\s+\S"),
]

# Markdown / HTML heading split patterns.
_MD_HEADING_RE = re.compile(r"^(#{1,2})\s+(.*)$")
_HTML_HEADING_SPLIT_RE = re.compile(r"(?is)<\s*h[12][^>]*>(.*?)<\s*/\s*h[12]\s*>")
_HTML_TAG_RE = re.compile(r"(?s)<[^>]+>")
_HTML_ENTITY_RE = re.compile(r"&[a-zA-Z#0-9]+;")

# A standalone heading is also a SHORT ALL-CAPS line (e.g. "PROLOGUE", "EPILOGUE")
# - Latin upper-case words only, few words, no terminal punctuation.
_ALLCAPS_RE = re.compile(r"^[A-Z][A-Z0-9 .,'\-:]{0,58}[A-Z0-9]$")
_MAX_HEADING_WORDS = 8


# --------------------------------------------------------------------------- #
# Prose / markdown / html chapter splitters                                   #
# --------------------------------------------------------------------------- #
def _single_chapter(text: str) -> List[Dict[str, Any]]:
    """The fallback: one chapter holding ALL text (no headings found)."""
    return [{"chapter_index": 0, "title": _DEFAULT_CHAPTER_TITLE, "text": text or ""}]


def _is_allcaps_heading(line: str) -> bool:
    """True for a SHORT, standalone ALL-CAPS Latin heading (e.g. 'PROLOGUE')."""
    if not (line and _ALLCAPS_RE.match(line)):
        return False
    if len(line.split()) > _MAX_HEADING_WORDS:
        return False
    # Must contain at least one ASCII letter (avoid pure-number / symbol lines).
    return any("A" <= c <= "Z" for c in line)


def _is_heading_line(line: str) -> bool:
    """True when a stripped prose line should start a new chapter (§8 heuristics)."""
    if not line:
        return False
    for rx in _BIBLE_BOOK_RES:
        if rx.match(line):
            return True
    for rx in _CHAPTER_HEADING_RES:
        if rx.match(line):
            return True
    return _is_allcaps_heading(line)


def _heading_title(line: str) -> str:
    """Clean a heading line into a chapter title (drop markdown #, collapse ws)."""
    md = _MD_HEADING_RE.match(line)
    if md:
        line = md.group(2)
    return collapse_whitespace(line)


def _chapters_from_headings(text: str) -> List[Dict[str, Any]]:
    """Split ``text`` into chapters on detected heading lines (prose/markdown).

    A chapter starts at a heading line and runs until the next heading. Any text
    BEFORE the first heading becomes a leading chapter titled the default. Returns
    the single-chapter fallback when no heading is detected.
    """
    lines = text.splitlines()
    chapters: List[Dict[str, Any]] = []
    cur_title: Optional[str] = None
    cur_lines: List[str] = []

    def _flush(title: Optional[str]):
        body = "\n".join(cur_lines).strip()
        if not body:
            return
        idx = len(chapters)
        chapters.append({
            "chapter_index": idx,
            "title": title or _DEFAULT_CHAPTER_TITLE,
            "text": body,
        })

    for raw in lines:
        stripped = collapse_whitespace(raw)
        if _is_heading_line(stripped):
            _flush(cur_title)
            cur_title = _heading_title(stripped)
            cur_lines = []
            continue
        cur_lines.append(raw)
    _flush(cur_title)

    if not chapters:
        return _single_chapter(text)
    # Re-number defensively (a leading pre-heading block shifts indices).
    for i, ch in enumerate(chapters):
        ch["chapter_index"] = i
    return chapters


def _chapters_from_md(text: str) -> List[Dict[str, Any]]:
    """Split markdown text on ``#`` / ``##`` ATX headings."""
    return _chapters_from_headings(text)


def _chapters_from_html(text_or_html: str) -> List[Dict[str, Any]]:
    """Split an HTML document on ``<h1>``/``<h2>`` headings.

    ``text_or_html`` is the RAW html string (still containing tags). Each <h1>/<h2>
    starts a chapter whose title is the heading's plain text and whose body is the
    tag-stripped content up to the next heading. Falls back to a single chapter.
    """
    html = text_or_html or ""
    if not html.strip():
        return _single_chapter("")

    def _plain(fragment: str) -> str:
        out = _HTML_TAG_RE.sub(" ", fragment)
        out = _HTML_ENTITY_RE.sub(" ", out)
        return collapse_horizontal_whitespace(out)

    chapters: List[Dict[str, Any]] = []
    last_end = 0
    pending_title: Optional[str] = None
    for m in _HTML_HEADING_SPLIT_RE.finditer(html):
        body_html = html[last_end:m.start()]
        body = _plain(body_html)
        if body:
            chapters.append({
                "chapter_index": len(chapters),
                "title": pending_title or _DEFAULT_CHAPTER_TITLE,
                "text": body,
            })
        pending_title = _plain(m.group(1)) or _DEFAULT_CHAPTER_TITLE
        last_end = m.end()
    tail = _plain(html[last_end:])
    if tail:
        chapters.append({
            "chapter_index": len(chapters),
            "title": pending_title or _DEFAULT_CHAPTER_TITLE,
            "text": tail,
        })

    if not chapters:
        return _single_chapter(_plain(html))
    for i, ch in enumerate(chapters):
        ch["chapter_index"] = i
    return chapters


# --------------------------------------------------------------------------- #
# Epub spine/TOC splitter (ebooklib + BeautifulSoup via lazy getters)         #
# --------------------------------------------------------------------------- #
def _chapters_from_epub(path: str) -> List[Dict[str, Any]]:
    """Chapters from an .epub's spine/TOC items (each document item = a chapter).

    Requires ebooklib + BeautifulSoup, obtained via the lazy third_party getters.
    When either is unavailable, or on any error, the caller falls back to the
    heading heuristics over the plain extracted text. Returns [] to signal
    "use the heuristic fallback".
    """
    try:
        ebooklib = get_third_package_ebooklib()
        epub = ebooklib.epub
        BeautifulSoup = get_third_package_bs4().BeautifulSoup
    except Exception:
        return []

    try:
        book = epub.read_epub(path)
    except Exception as exc:  # noqa: BLE001 - bad/locked epub -> heuristic fallback
        ColorPrint.yellow(f"[BookProcessor] epub chapter read failed {path}: {exc}")
        return []

    # Prefer the spine order (reading order); fall back to all document items.
    doc_items: List[Any] = []
    try:
        for spine_entry in (book.spine or []):
            item_id = spine_entry[0] if isinstance(spine_entry, (tuple, list)) else spine_entry
            item = book.get_item_with_id(item_id)
            if item is not None:
                doc_items.append(item)
    except Exception:
        doc_items = []
    if not doc_items:
        try:
            doc_items = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))
        except Exception:
            doc_items = []

    chapters: List[Dict[str, Any]] = []
    for item in doc_items:
        try:
            soup = BeautifulSoup(item.get_content(), "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            body = soup.get_text(separator="\n")
            body = "\n".join(ln.rstrip() for ln in body.splitlines())
            body = re.sub(r"\n{3,}", "\n\n", body).strip()
        except Exception:
            continue
        if not body:
            continue
        # Title: the first heading element, else the item name, else default.
        title = ""
        try:
            heading = soup.find(["h1", "h2", "h3", "title"])
            if heading is not None:
                title = collapse_whitespace(heading.get_text())
        except Exception:
            title = ""
        if not title:
            title = os.path.splitext(os.path.basename(getattr(item, "file_name", "") or ""))[0]
        chapters.append({
            "chapter_index": len(chapters),
            "title": title or _DEFAULT_CHAPTER_TITLE,
            "text": body,
        })

    return chapters


# --------------------------------------------------------------------------- #
# Public dispatcher                                                           #
# --------------------------------------------------------------------------- #
def segment_chapters(text: str, ext: str = "", language: str = "en",
                     path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Split a book into chapters ``[{chapter_index, title, text}]`` (§8).

    Strategy by format:
      * .epub          - spine/TOC document items (ebooklib), each item a chapter;
                         when ebooklib is unavailable, fall back to heading
                         heuristics over ``text``. Pass ``path`` to enable this.
      * .html/.htm     - split on <h1>/<h2> headings (needs the RAW html in
                         ``text``); falls back to a single chapter.
      * .md            - split on # / ## ATX headings.
      * .txt/.pdf/.docx/.doc/.rtf - heading regex (Chapter/CHAPTER N, CJK chapter
                         markers, markdown headings, short ALL-CAPS / numbered lines).
      * fallback       - exactly ONE chapter {chapter_index:0, title:'Chapter 1',
                         text:<all>} when no heading is detected.

    Each chapter's ``text`` is meant to be passed to ``segment_sentences`` so BOTH
    grains (cue + sentence) are preserved per chapter. NEVER raises - any failure
    degrades to the single-chapter fallback. ``language`` is accepted for symmetry
    (chapter splitting is script-agnostic) and unused directly.
    """
    ext = (ext or "").lower().lstrip(".")
    if not (text and text.strip()):
        # epub may still yield chapters from the file even with empty plain text.
        if ext == "epub" and path:
            epub_chapters = _chapters_from_epub(path)
            if epub_chapters:
                return epub_chapters
        return _single_chapter(text or "")

    try:
        if ext == "epub":
            epub_chapters = _chapters_from_epub(path) if path else []
            if epub_chapters:
                return epub_chapters
            return _chapters_from_headings(text)
        if ext in ("html", "htm"):
            return _chapters_from_html(text)
        if ext == "md":
            return _chapters_from_md(text)
        # txt / pdf / docx / doc / rtf - and any unknown extension.
        return _chapters_from_headings(text)
    except Exception as exc:  # noqa: BLE001 - never break ingest on a bad parse
        ColorPrint.yellow(f"[BookProcessor] segment_chapters failed ({ext}): {exc}")
        return _single_chapter(text)
