#!/usr/bin/env python3
"""Shared long-text chunking for the standalone TTS engine services.

Pure standard-library module: no pycore imports, no third-party imports, so it
can be staged next to any standalone API server and also loaded by path from
the main process (the same single source of the split algorithm).

Design contract (chunk policy):
  owner              - "project" (this module splits) or "native" (engine
                       upstream already splits; this module is only a
                       protective guard for pathological inputs)
  unit               - "char" (protective character budget; never presented as
                       a model token limit)
  soft_limit         - merge cap: adjacent sentences only merge while the
                       merged chunk stays within it
  hard_limit         - one generation never carries more characters than this
  max_chunks         - one task never produces more chunks than this
  max_attempts       - per-chunk attempts including the first
  pause_ms           - silence inserted between concatenated chunks
  total_deadline_s   - whole-task wall-clock budget (0 = unbounded)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

_DEFAULT_SOFT_LIMIT = 200
_DEFAULT_HARD_LIMIT = 400
_DEFAULT_MAX_CHUNKS = 256
_DEFAULT_MAX_ATTEMPTS = 3
_DEFAULT_PAUSE_MS = 120
# Sentence/clause splitting shared with qwen3tts_synthesis (single source).
SENTENCE_MERGE_RATIO = 0.85

# Upstream evidence (see the development plan step 03):
#   cosyvoice  - official cli/frontend.py splits with token_max_n=80 /
#                token_min_n=60 / merge_len=20 (token units, NOT a character
#                limit); project keeps the native frontend and adds a
#                character guard for punctuation-free over-long runs.
#   fishspeech - official fish_speech/utils/schema.py chunk_length default
#                200 (range 100-1000), max_new_tokens default 1024.
#   voxcpm2    - official src/voxcpm/core.py max_len=4096 generation tokens;
#                outer text segmentation stays with the project.
#   gptsovits  - official api_v2 + text_segmentation_method provide native
#                text splitting; project guard only.
#   melotts    - official melo/api.py sentence split + concat; project guard.
_ENGINE_POLICY_OVERRIDES: Dict[str, Dict[str, Any]] = {
    "cosyvoice": {"owner": "native", "soft_limit": 200, "hard_limit": 400},
    "fishspeech": {"owner": "project", "soft_limit": 200, "hard_limit": 400},
    "voxcpm2": {"owner": "project", "soft_limit": 200, "hard_limit": 400},
    "gptsovits": {"owner": "native", "soft_limit": 200, "hard_limit": 400},
    "melotts": {"owner": "native", "soft_limit": 200, "hard_limit": 400},
}

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?;。！？；:：])\s+|(?<=[。！？；])|\n+")
CLAUSE_SPLIT_RE = re.compile(r"(?<=[,，、])\s*")
_WHITESPACE_RE = re.compile(r"\s+")

# Latin abbreviations whose trailing dot must not become a sentence boundary.
_ABBREVIATIONS = frozenset(
    abbreviation.lower()
    for abbreviation in (
        "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St", "Mt", "vs", "etc",
        "e.g", "i.e", "Fig", "Eq", "No", "Nos", "Vol", "pp", "ca", "cf",
        "Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct",
        "Nov", "Dec", "Inc", "Ltd", "Co", "Corp", "approx", "dept", "est",
    )
)
_ABBREVIATION_DOT_RE = re.compile(r"([A-Za-z][A-Za-z.]*)\.$")
_INITIAL_DOT_RE = re.compile(r"\b[A-Z]\.$")
_DOMAIN_RE = re.compile(r"\b[a-zA-Z0-9-]+\.(com|org|net|io|edu|gov|cn|dev|ai|app|co|me|tv|info|biz)\b", re.IGNORECASE)
_DECIMAL_RE = re.compile(r"\d\.\d")
_DOT_PLACEHOLDER = ""


class ChunkBudgetError(ValueError):
    """Raised when one task would exceed the configured chunk budget."""

    def __init__(self, chunk_count: int, max_chunks: int) -> None:
        super().__init__(
            f"chunk budget exceeded: {chunk_count} chunks > max_chunks={max_chunks}"
        )
        self.chunk_count = chunk_count
        self.max_chunks = max_chunks


@dataclass(frozen=True)
class ChunkPolicy:
    owner: str = "project"
    unit: str = "char"
    soft_limit: int = _DEFAULT_SOFT_LIMIT
    hard_limit: int = _DEFAULT_HARD_LIMIT
    max_chunks: int = _DEFAULT_MAX_CHUNKS
    max_attempts: int = _DEFAULT_MAX_ATTEMPTS
    pause_ms: int = _DEFAULT_PAUSE_MS
    total_deadline_s: float = 0.0
    generation_budget: Optional[int] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    def normalized(self) -> "ChunkPolicy":
        hard = max(80, int(self.hard_limit))
        soft = int(self.soft_limit)
        if soft <= 0:
            soft = max(60, round(hard * SENTENCE_MERGE_RATIO))
        soft = min(soft, hard)
        return ChunkPolicy(
            owner=self.owner or "project",
            unit=self.unit or "char",
            soft_limit=soft,
            hard_limit=hard,
            max_chunks=max(1, int(self.max_chunks)),
            max_attempts=max(1, int(self.max_attempts)),
            pause_ms=max(0, int(self.pause_ms)),
            total_deadline_s=max(0.0, float(self.total_deadline_s)),
            generation_budget=self.generation_budget,
            extra=dict(self.extra),
        )


def default_policy(engine: str = "") -> ChunkPolicy:
    """Project conservative defaults for one engine (character units; these
    are project guard values, not model limits)."""
    overrides = _ENGINE_POLICY_OVERRIDES.get(str(engine or "").strip().lower(), {})
    policy = ChunkPolicy(**overrides) if overrides else ChunkPolicy()
    return policy.normalized()


@dataclass
class TextChunk:
    index: int
    start: int
    end: int
    text: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "start": self.start,
            "end": self.end,
            "chars": len(self.text),
        }


def _shield_protected_dots(text: str) -> str:
    """Mask dots that must not act as sentence boundaries (decimals, domain
    names, known abbreviations, single-letter initials) before splitting."""
    masked = _DECIMAL_RE.sub(lambda match: match.group(0).replace(".", _DOT_PLACEHOLDER), text)
    masked = _DOMAIN_RE.sub(lambda match: match.group(0).replace(".", _DOT_PLACEHOLDER), masked)

    def _mask_abbreviation(match: "re.Match[str]") -> str:
        token = match.group(1)
        if token.lower() in _ABBREVIATIONS:
            return token + _DOT_PLACEHOLDER
        return match.group(0)

    masked = _ABBREVIATION_DOT_RE.sub(_mask_abbreviation, masked)
    masked = _INITIAL_DOT_RE.sub(lambda match: match.group(0).replace(".", _DOT_PLACEHOLDER), masked)
    return masked


def _unshield(text: str) -> str:
    return text.replace(_DOT_PLACEHOLDER, ".")


def _hard_cut(unit: str, hard_cap: int) -> List[str]:
    """Cut one over-long unit at whitespace near the cap; fall back to a
    code-point slice (Python strings slice on code points, so surrogate pairs
    never split) when no whitespace exists."""
    pieces: List[str] = []
    remaining = unit
    while len(remaining) > hard_cap:
        window = remaining[:hard_cap]
        cut = window.rfind(" ")
        if cut < max(40, hard_cap // 2):
            cut = hard_cap
        pieces.append(remaining[:cut].strip())
        remaining = remaining[cut:].strip()
    if remaining:
        pieces.append(remaining)
    return [piece for piece in pieces if piece]


def _pack_units(units: List[str], merge_cap: int, hard_cap: int) -> List[str]:
    chunks: List[str] = []
    current = ""
    for unit in units:
        while len(unit) > hard_cap:
            if current:
                chunks.append(current)
                current = ""
            cut_pieces = _hard_cut(unit, hard_cap)
            chunks.extend(cut_pieces[:-1])
            unit = cut_pieces[-1] if cut_pieces else ""
        if not unit:
            continue
        candidate = f"{current} {unit}".strip() if current else unit
        if current and len(candidate) > merge_cap:
            chunks.append(current)
            current = unit
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def split_text(text: str, policy: Optional[ChunkPolicy] = None) -> List[TextChunk]:
    """Split ``text`` into ordered chunks that exactly cover the input.

    Sentence boundary -> clause boundary -> whitespace -> unicode-safe hard
    cut. Decimals, URLs/domains, common abbreviations and initials never split
    on their internal dots. Raises ChunkBudgetError when the result would
    exceed ``policy.max_chunks`` (the tail is never silently dropped).
    """
    resolved = (policy or ChunkPolicy()).normalized()
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    masked = _shield_protected_dots(cleaned)
    sentences = [
        piece.strip() for piece in SENTENCE_SPLIT_RE.split(masked) if piece.strip()
    ]
    units: List[str] = []
    for sentence in sentences:
        if len(sentence) <= resolved.hard_limit:
            units.append(sentence)
            continue
        clauses = [
            piece.strip() for piece in _CLAUSE_SPLIT_RE.split(sentence) if piece.strip()
        ]
        if len(clauses) > 1:
            units.extend(clauses)
        else:
            words = [word for word in _WHITESPACE_RE.split(sentence) if word]
            units.extend(words if len(words) > 1 else [sentence])

    packed = _pack_units(units, resolved.soft_limit, resolved.hard_limit)
    if len(packed) > resolved.max_chunks:
        raise ChunkBudgetError(len(packed), resolved.max_chunks)

    chunks: List[TextChunk] = []
    cursor = 0
    for index, chunk_text in enumerate(packed):
        restored = _unshield(chunk_text)
        position = cleaned.find(restored[:32], cursor) if restored else -1
        start = position if position >= 0 else cursor
        chunks.append(TextChunk(index=index, start=start, end=start + len(restored), text=restored))
        cursor = start + len(restored)
    return chunks


def needs_chunking(text: str, policy: Optional[ChunkPolicy] = None) -> bool:
    resolved = (policy or ChunkPolicy()).normalized()
    return len((text or "").strip()) > resolved.soft_limit


__all__ = [
    "ChunkBudgetError",
    "ChunkPolicy",
    "TextChunk",
    "default_policy",
    "needs_chunking",
    "split_text",
]
