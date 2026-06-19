# -*- coding: utf-8 -*-
"""
text_statistics — multi-language text statistics engine (pyutils).

Builds the document statistics the Books page shows on drop/add: word count,
unique word count, sentence count, unique sentence count, character counts, a
per-language breakdown and the top words — for text in ANY language. A direct,
multi-language generalization of the reference word-statistics code
(dict-server-client all_text_trans.py + sentence_helper.py), reusing the
stdlib-only primitives in ``pyfoundations.text_parsing`` for tokenization,
sentence splitting and Unicode-script detection.

Layering (PYTHON_PYCORE.md §2.2): pyutils may import pyfoundations + stdlib; this
module imports neither pyctl nor any sibling pyutils domain package, so it stays
a safe shared base library.

``compute_text_stats`` never raises — empty / unusable text yields a fully-zeroed
stats dict so callers can render it unconditionally.
"""

import collections
import re
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.text_parsing import (
    tokenize_words,
    split_sentences,
    normalize_sentence_key,
    language_breakdown,
    guess_language,
)

# Default number of "top words" returned (by descending frequency).
_DEFAULT_TOP_WORDS = 20

# Soft cap (characters) for a single analysis pass. Whole books fit comfortably;
# the cap only guards against a pathological multi-hundred-MB paste. When the
# text is longer it is analyzed up to the cap and ``truncated`` is set True.
_MAX_ANALYZE_CHARS = 5_000_000


def compute_text_stats(
    text: str,
    language: Optional[str] = None,
    top_words: int = _DEFAULT_TOP_WORDS,
    max_chars: int = _MAX_ANALYZE_CHARS,
) -> Dict[str, Any]:
    """Compute multi-language statistics for ``text``.

    Args:
        text: the document's plain text (any language / mixed scripts).
        language: optional caller-declared primary language code; when omitted it
            is auto-detected from the dominant Unicode script.
        top_words: how many most-frequent words to return (0 disables the list).
        max_chars: soft analysis cap; longer text is truncated to this length and
            ``truncated`` is reported True.

    Returns a dict:
        {
          "char_count", "char_count_no_space",
          "word_count", "unique_word_count",
          "sentence_count", "unique_sentence_count",
          "line_count", "paragraph_count",
          "primary_language", "languages": [{script, code, chars, ratio}, ...],
          "top_words": [{"word", "count"}, ...],
          "truncated": bool,
        }
    Empty / blank text yields the same shape with zeroed counts.
    """
    base = _empty_stats()
    if not (text and text.strip()):
        return base

    truncated = False
    if max_chars and len(text) > max_chars:
        text = text[:max_chars]
        truncated = True
    base["truncated"] = truncated

    # ---- character / structural counts ------------------------------------ #
    base["char_count"] = len(text)
    base["char_count_no_space"] = sum(1 for c in text if not c.isspace())
    base["line_count"] = text.count("\n") + (1 if text and not text.endswith("\n") else 0)
    # Paragraphs: blocks separated by one or more blank lines.
    base["paragraph_count"] = sum(
        1 for block in re.split(r"\n\s*\n", text) if block.strip()
    )

    # ---- words ------------------------------------------------------------- #
    # Distinct-word dedup uses str.lower() (NOT casefold) so unique-word counts +
    # the word content_id keys agree with laravel's mb_strtolower for non-ASCII.
    tokens = tokenize_words(text)
    base["word_count"] = len(tokens)
    lowered = [t.lower() for t in tokens]
    counter = collections.Counter(lowered)
    base["unique_word_count"] = len(counter)
    if top_words and top_words > 0:
        base["top_words"] = [
            {"word": w, "count": c} for w, c in counter.most_common(top_words)
        ]

    # ---- sentences --------------------------------------------------------- #
    sentences = split_sentences(text)
    base["sentence_count"] = len(sentences)
    base["unique_sentence_count"] = len(
        {normalize_sentence_key(s) for s in sentences if s.strip()}
    )

    # ---- languages --------------------------------------------------------- #
    base["languages"] = language_breakdown(text)
    base["primary_language"] = (language or "").strip() or guess_language(text)

    return base


def _empty_stats() -> Dict[str, Any]:
    """A fully-zeroed stats dict (the canonical shape, safe to render)."""
    return {
        "char_count": 0,
        "char_count_no_space": 0,
        "word_count": 0,
        "unique_word_count": 0,
        "sentence_count": 0,
        "unique_sentence_count": 0,
        "line_count": 0,
        "paragraph_count": 0,
        "primary_language": "und",
        "languages": [],
        "top_words": [],
        "truncated": False,
    }


def merge_stats(stats_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate several per-file stats dicts into one folder-level summary.

    Counts (chars/words/sentences/lines/paragraphs) sum. ``unique_*`` counts are
    summed too but clearly cannot dedupe ACROSS files (each file's uniqueness was
    computed independently), so callers should label them "sum of per-file
    unique" rather than a true global distinct count. Language rows are merged by
    script (chars summed, ratios recomputed). ``top_words`` are merged by summing
    counts and re-ranking. ``primary_language`` is the language with the most
    letters across the set.
    """
    out = _empty_stats()
    if not stats_list:
        return out

    lang_chars: Dict[str, Dict[str, Any]] = {}
    word_counter: collections.Counter = collections.Counter()
    for s in stats_list:
        if not s:
            continue
        for key in ("char_count", "char_count_no_space", "word_count",
                    "unique_word_count", "sentence_count", "unique_sentence_count",
                    "line_count", "paragraph_count"):
            out[key] += int(s.get(key) or 0)
        out["truncated"] = out["truncated"] or bool(s.get("truncated"))
        for row in s.get("languages") or []:
            script = row.get("script")
            if not script:
                continue
            slot = lang_chars.setdefault(script, {"script": script, "code": row.get("code", script), "chars": 0})
            slot["chars"] += int(row.get("chars") or 0)
        for tw in s.get("top_words") or []:
            word_counter[tw.get("word")] += int(tw.get("count") or 0)

    total_lang = sum(v["chars"] for v in lang_chars.values())
    languages = []
    for v in lang_chars.values():
        v["ratio"] = round(v["chars"] / total_lang, 4) if total_lang else 0.0
        languages.append(v)
    languages.sort(key=lambda r: r["chars"], reverse=True)
    out["languages"] = languages
    out["primary_language"] = languages[0]["code"] if languages else "und"
    out["top_words"] = [
        {"word": w, "count": c} for w, c in word_counter.most_common(_DEFAULT_TOP_WORDS)
        if w is not None
    ]
    return out
