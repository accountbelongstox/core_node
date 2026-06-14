# -*- coding: utf-8 -*-
"""
punctuation_markers — canonical, extensible punctuation-marker library
(pyfoundations leaf, stdlib only).

The Books pipeline stores sentences in the shared library WITHOUT punctuation
(so "Hello, world" / "Hello world!" dedupe to one row), and reconstructs a
book's original flow as an ordered sequence of sentence content-ids interleaved
with PUNCTUATION-MARKER codes (repeats allowed):

    [ {"s": <content_id>}, {"m": "period"}, {"s": <content_id>}, {"m": "excl_fw"}, ... ]

This module is the SINGLE SOURCE OF TRUTH for those marker codes. The same set is
seeded idempotently into laravel_main's ``app_qy_v1_punctuation_markers`` table at
``sys:init`` (kept in sync via the contract doc
pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md §8). Each marker has a STABLE ``code`` and
the EXACT ``char`` it represents, so reconstruction restores the original glyph
(ASCII vs full-width are distinct codes, not normalized together).

Layering (PYTHON_PYCORE.md §2.2): stdlib only — no third-party, no pyutils/pyctl.
Extensible: add to ``_MARKERS`` (and the laravel seeder); ``ensure_*`` is idempotent.
"""

import unicodedata
from typing import Any, Dict, List, Optional, Tuple

# --------------------------------------------------------------------------- #
# Canonical marker set                                                         #
# --------------------------------------------------------------------------- #
# Each: code (stable slug), char (exact glyph), type, category, terminal(bool).
#   category: 'terminal' (ends a sentence) | 'pause' | 'structure'
#   terminal: whether it closes a sentence (drives book segmentation)
_MARKERS: List[Dict[str, Any]] = [
    # --- sentence terminals (Latin + full-width CJK) ---------------------- #
    {"code": "period",       "char": ".",  "type": "period",      "category": "terminal", "terminal": True},
    {"code": "period_fw",    "char": "。", "type": "period",      "category": "terminal", "terminal": True},
    {"code": "excl",         "char": "!",  "type": "exclamation", "category": "terminal", "terminal": True},
    {"code": "excl_fw",      "char": "！", "type": "exclamation", "category": "terminal", "terminal": True},
    {"code": "ques",         "char": "?",  "type": "question",    "category": "terminal", "terminal": True},
    {"code": "ques_fw",      "char": "？", "type": "question",    "category": "terminal", "terminal": True},
    {"code": "ellipsis",     "char": "…",  "type": "ellipsis",    "category": "terminal", "terminal": True},
    {"code": "semicolon_fw", "char": "；", "type": "semicolon",   "category": "terminal", "terminal": True},
    # --- intra-sentence pauses (kept for richer reconstruction; non-terminal) #
    {"code": "comma",        "char": ",",  "type": "comma",       "category": "pause",    "terminal": False},
    {"code": "comma_fw",     "char": "，", "type": "comma",       "category": "pause",    "terminal": False},
    {"code": "enum_fw",      "char": "、", "type": "enumeration", "category": "pause",    "terminal": False},
    {"code": "semicolon",    "char": ";",  "type": "semicolon",   "category": "pause",    "terminal": False},
    {"code": "colon",        "char": ":",  "type": "colon",       "category": "pause",    "terminal": False},
    {"code": "colon_fw",     "char": "：", "type": "colon",       "category": "pause",    "terminal": False},
    # --- structure -------------------------------------------------------- #
    {"code": "newline",      "char": "\n",   "type": "newline",   "category": "structure", "terminal": False},
    {"code": "paragraph",    "char": "\n\n", "type": "paragraph", "category": "structure", "terminal": False},
]

# Lookups (built once at import).
MARKER_BY_CODE: Dict[str, Dict[str, Any]] = {m["code"]: m for m in _MARKERS}
MARKER_BY_CHAR: Dict[str, str] = {m["char"]: m["code"] for m in _MARKERS}
TERMINAL_CHARS: str = "".join(m["char"] for m in _MARKERS if m["terminal"] and len(m["char"]) == 1)
TERMINAL_CODES = frozenset(m["code"] for m in _MARKERS if m["terminal"])

# Schema version — bump when _MARKERS changes so the laravel seeder can re-sync.
MARKERS_VERSION = 1


# --------------------------------------------------------------------------- #
# Public accessors                                                             #
# --------------------------------------------------------------------------- #
def all_markers() -> List[Dict[str, Any]]:
    """Return a copy of the canonical marker rows (for seeding/inspection)."""
    return [dict(m) for m in _MARKERS]


def code_for_char(ch: str) -> Optional[str]:
    """Marker code for an exact glyph, or None when unknown."""
    return MARKER_BY_CHAR.get(ch)


def char_for_code(code: str) -> str:
    """Exact glyph for a marker code, or '' when unknown."""
    m = MARKER_BY_CODE.get(code)
    return m["char"] if m else ""


def is_terminal_char(ch: str) -> bool:
    """True when ``ch`` is a single-char sentence terminal in the library."""
    return ch in TERMINAL_CHARS


# --------------------------------------------------------------------------- #
# Punctuation stripping (for the punctuation-free sentence library)            #
# --------------------------------------------------------------------------- #
def strip_punctuation(text: str) -> str:
    """Remove ALL punctuation/symbol characters, keeping letters/digits/space.

    Uses Unicode general categories (P* punctuation, S* symbol). Whitespace is
    preserved (collapsed by the caller). This is what the stored sentence text +
    its md5 content_id are computed from, so punctuation variants dedupe.
    """
    if not text:
        return ""
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        if cat[0] in ("P", "S"):
            out.append(" ")
        else:
            out.append(ch)
    return "".join(out)


# --------------------------------------------------------------------------- #
# Book segmentation -> reconstruction tokens                                   #
# --------------------------------------------------------------------------- #
def segment_with_markers(text: str) -> List[Dict[str, str]]:
    """Split a book's text into an ordered reconstruction sequence.

    Returns a list of tokens, each either:
        {"kind": "sentence", "text": <raw sentence text, trimmed>}
        {"kind": "marker",   "code": <marker code>, "char": <glyph>}

    A sentence runs up to (and excluding) a terminal punctuation char; that
    terminal char becomes the following marker token. A blank line between
    sentences additionally emits a ``paragraph`` marker. Sentences carry their
    RAW text here (punctuation kept); the caller strips punctuation for the
    stored/​hashed content. Repeats are inherent (the same sentence text can
    recur). The book's exact bytes are still kept in ``full_content`` separately.
    """
    if not (text and text.strip()):
        return []
    tokens: List[Dict[str, str]] = []
    buf: List[str] = []

    def flush_sentence():
        raw = "".join(buf).strip()
        buf.clear()
        if raw:
            tokens.append({"kind": "sentence", "text": raw})

    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch in TERMINAL_CHARS:
            flush_sentence()
            code = MARKER_BY_CHAR.get(ch)
            if code:
                tokens.append({"kind": "marker", "code": code, "char": ch})
            # Consume following whitespace; a blank line -> paragraph marker.
            j = i + 1
            saw_blank = False
            newlines = 0
            while j < n and text[j].isspace():
                if text[j] == "\n":
                    newlines += 1
                j += 1
            if newlines >= 2:
                saw_blank = True
            if saw_blank:
                tokens.append({"kind": "marker", "code": "paragraph", "char": "\n\n"})
            i = j
            continue
        buf.append(ch)
        i += 1
    flush_sentence()
    return tokens
