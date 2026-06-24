"""Mask code inside a prompt so an AI translator never rewrites it.

Code spans (fenced ``` blocks, inline `code`, and clearly indented blocks) are
replaced by stable sentinel placeholders before translation and restored after.
Dependency-light: pure regex (pygments is consulted only if importable, never
required), matching the punctuation/text_parsing style elsewhere in pyfoundations.
"""
from __future__ import annotations

import re
from typing import Dict, List, Tuple

# Sentinel kept ASCII + bracketed so models preserve it verbatim.
_PLACEHOLDER = "[[CODE_{}]]"
_PLACEHOLDER_RE = re.compile(r"\[\[CODE_(\d+)\]\]")

_FENCED_RE = re.compile(r"```.*?```", re.DOTALL)
_INLINE_RE = re.compile(r"`[^`\n]+`")
# 4-space / tab indented runs of one or more lines (markdown code blocks).
_INDENTED_RE = re.compile(r"(?:^[ \t]{4,}\S.*(?:\n|$))+", re.MULTILINE)


def mask_code(text: str) -> Tuple[str, List[str]]:
    """Return (masked_text, segments). Each masked span is one segments[] entry."""
    segments: List[str] = []

    def _take(match: "re.Match[str]") -> str:
        segments.append(match.group(0))
        return _PLACEHOLDER.format(len(segments) - 1)

    if not isinstance(text, str) or not text:
        return text or "", segments

    masked = _FENCED_RE.sub(_take, text)
    masked = _INLINE_RE.sub(_take, masked)
    masked = _INDENTED_RE.sub(_take, masked)
    return masked, segments


def unmask_code(text: str, segments: List[str]) -> str:
    """Restore masked spans. Unknown indices are left as-is (defensive)."""
    if not text or not segments:
        return text or ""

    def _put(match: "re.Match[str]") -> str:
        idx = int(match.group(1))
        return segments[idx] if 0 <= idx < len(segments) else match.group(0)

    return _PLACEHOLDER_RE.sub(_put, text)


def has_code(text: str) -> bool:
    """Cheap predicate: does the text appear to contain a code span?"""
    if not isinstance(text, str) or not text:
        return False
    return bool(_FENCED_RE.search(text) or _INLINE_RE.search(text) or _INDENTED_RE.search(text))
