#!/usr/bin/env python3
"""Shared long-text chunking for the standalone TTS engine services.

Pure standard-library module: no pycore imports, no third-party imports, so it
can be staged next to any standalone API server and also loaded by path from
the main process. Sentence boundaries come from the shared sentence
segmentation (sentence_segmenter.py + config/sentence_segmentation_contract.json:
the one rule set of pycore, Laravel and the UI), loaded by path from a staged
sibling copy or from the checkout; this module only packs sentences into chunks.

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

import importlib.util
import sys
from dataclasses import dataclass, field
from pathlib import Path
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
    "kokoro": {"owner": "project", "soft_limit": 72, "hard_limit": 80},
    "sherpa": {"owner": "project", "soft_limit": 72, "hard_limit": 80},
    "voxcpm2": {"owner": "project", "soft_limit": 200, "hard_limit": 400},
    "gptsovits": {"owner": "native", "soft_limit": 200, "hard_limit": 400},
    "melotts": {"owner": "native", "soft_limit": 200, "hard_limit": 400},
    # Bark generates at most ~13 s of audio per call.
    "bark": {"owner": "project", "soft_limit": 100, "hard_limit": 140},
}

_SEGMENTER_MODULE = "sentence_segmenter"
_SEGMENTER_FILE = "sentence_segmenter.py"
_SEGMENTER_CANDIDATES = (
    Path(__file__).resolve().with_name(_SEGMENTER_FILE),
    Path(__file__).resolve().parents[1] / "pyfoundations" / _SEGMENTER_FILE,
)


def _segmenter() -> Any:
    """The shared sentence segmenter, loaded by path (staged copy first)."""
    module = sys.modules.get("pycore_shared_" + _SEGMENTER_MODULE)
    if module is not None:
        return module.sentence_segmenter
    path = next(candidate for candidate in _SEGMENTER_CANDIDATES if candidate.is_file())
    spec = importlib.util.spec_from_file_location("pycore_shared_" + _SEGMENTER_MODULE, str(path))
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.sentence_segmenter


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
    cut, with the boundaries decided by the shared sentence segmenter (decimals,
    IPs, file names, abbreviations and initials never split). Raises
    ChunkBudgetError when the result would
    exceed ``policy.max_chunks`` (the tail is never silently dropped).
    """
    resolved = (policy or ChunkPolicy()).normalized()
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    units = _segmenter().split(cleaned, max_chars=resolved.hard_limit)

    packed = _pack_units(units, resolved.soft_limit, resolved.hard_limit)
    if len(packed) > resolved.max_chunks:
        raise ChunkBudgetError(len(packed), resolved.max_chunks)

    chunks: List[TextChunk] = []
    cursor = 0
    for index, chunk_text in enumerate(packed):
        restored = chunk_text
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
