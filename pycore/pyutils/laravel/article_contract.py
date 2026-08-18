# -*- coding: utf-8 -*-
"""Laravel worker article API contract - single source of truth (pycore side).

Division of responsibility: pycore AUTOMATICALLY accepts documents of any
size, generates/synthesizes in batches internally, combines the result, and
delivers an ALREADY contract-compliant payload to Laravel. Laravel never
truncates, splits, or combines - its Validator REJECTS out-of-contract fields
(HTTP 422), which would fail the upload and poison the retry lane (the same
oversized payload re-failing every tick).

Every bound mirrors the Laravel validator exactly (workerSubmit in
AppQyV1ArticleController) and the storage schema:
    title / title_en / title_cn  <= 255  (articles.title is VARCHAR(255))
    reference_cn                 <= 5000
    raw_preview                  <= 5000 (pycore sends a preview, not the doc)
    article_text                 <= 50000

The clippers cut on natural boundaries (sentence -> word -> character) so a
bounded field is still well-formed text in EN and CJK alike.
"""

import re
from typing import Any, Dict

TITLE_MAX = 255
# Asked of the model in generation prompts; the boundary clipper still
# enforces TITLE_MAX (models do not reliably obey length instructions).
TITLE_PROMPT_MAX = 60
REFERENCE_MAX = 5000
RAW_PREVIEW_MAX = 2000
ARTICLE_TEXT_MAX = 50000
FALLBACK_TITLE = "Agent history article"

_ELLIPSIS = "..."
_SENTENCE_END_RE = re.compile(r"[.!?。！？;；]")
_WORD_SPACE_RE = re.compile(r"\s+")


def _normalized(text: Any) -> str:
    return _WORD_SPACE_RE.sub(" ", str(text or "")).strip()


def clip_on_boundary(text: Any, limit: int) -> str:
    """Clip ``text`` to at most ``limit`` characters on a natural boundary:
    last sentence end, then last word separator, then a hard cut. A clipped
    value ends with an ellipsis (kept inside the limit)."""
    value = _normalized(text)
    if limit <= 0:
        return ""
    if len(value) <= limit:
        return value
    if limit <= len(_ELLIPSIS):
        return value[:limit]
    room = limit - len(_ELLIPSIS)
    head = value[:limit]
    cut = 0
    for match in _SENTENCE_END_RE.finditer(head[:room]):
        cut = match.end()
    if cut < room:
        space = head.rfind(" ", 0, room + 1)
        if space > 0:
            cut = space
    if cut < room // 2:
        cut = room
    return head[:cut].rstrip(" ,;、，；") + _ELLIPSIS


def compose_title(source: Any, document: Any = "") -> str:
    """Deterministic bounded title: ``source`` when usable, else the first
    sentence of ``document``, else the pipeline fallback title. Single
    implementation behind every title fallback in the pipeline."""
    title = _normalized(source)
    if title:
        return clip_on_boundary(title, TITLE_MAX)
    text = _normalized(document)
    if text:
        end = _SENTENCE_END_RE.search(text)
        first = text[: end.end()] if end else text
        return clip_on_boundary(first, TITLE_MAX)
    return FALLBACK_TITLE


def compose_worker_text_fields(
    article: Dict[str, Any], raw_text: Any = ""
) -> Dict[str, str]:
    """Normalize every TEXT field of the worker/submit payload to the Laravel
    contract. This is the ONLY place the bounds are applied - generation
    stages and the upload stage both route through here, so the limits can
    never drift apart from the Laravel validator."""
    article_text = _normalized(article.get("article_en"))
    reference_cn = _normalized(article.get("reference_cn"))
    title_en = compose_title(article.get("title_en"), article_text)
    title_cn = compose_title(article.get("title_cn"), reference_cn)
    return {
        "title": title_en,
        "title_en": title_en,
        "title_cn": title_cn,
        "reference_cn": clip_on_boundary(reference_cn, REFERENCE_MAX),
        "article_text": clip_on_boundary(article_text, ARTICLE_TEXT_MAX),
        "raw_preview": clip_on_boundary(raw_text, RAW_PREVIEW_MAX),
    }


__all__ = [
    "ARTICLE_TEXT_MAX",
    "FALLBACK_TITLE",
    "RAW_PREVIEW_MAX",
    "REFERENCE_MAX",
    "TITLE_MAX",
    "TITLE_PROMPT_MAX",
    "clip_on_boundary",
    "compose_title",
    "compose_worker_text_fields",
]
