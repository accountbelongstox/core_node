# -*- coding: utf-8 -*-
"""Unified model manifest: ONE schema and ONE registry for every AI provider and
local model (TTS, STT, OCR, LLM, translate, cloud text/vision/image AI).

Each domain declares its entries once in a leaf ``*_manifest`` module and
registers them here. Every other facts table (capability panel, priority
chains, status payloads, boot masking, hub catalog) reads this registry instead
of restating names, notes, tiers, runtime class or boot checks.

Entries are immutable. Registration happens at import time of the declaring
leaf module; the catalog loader (``pyctl.ai_hub.manifest_loader``) imports every
declaring module so the registry is complete before it is read.
"""

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

from pycore.pyutils.common.coded_message import CodedMessage

CATEGORY_TTS = "tts"
CATEGORY_STT = "stt"
CATEGORY_OCR = "ocr"
CATEGORY_LLM = "llm"
CATEGORY_TRANSLATE = "translate"
CATEGORY_AI_TEXT = "ai_text"
CATEGORY_AI_IMAGE = "ai_image"
CATEGORY_LIBRARY = "library"
CATEGORY_ORDER = (
    CATEGORY_AI_TEXT,
    CATEGORY_AI_IMAGE,
    CATEGORY_TTS,
    CATEGORY_STT,
    CATEGORY_OCR,
    CATEGORY_LLM,
    CATEGORY_TRANSLATE,
    CATEGORY_LIBRARY,
)

RUNTIME_CLOUD = "cloud"
RUNTIME_SERVER = "server"
RUNTIME_MODEL = "model"
RUNTIME_LIBRARY = "library"

LIVE_QWEN_QUEUE = "qwen_queue"
LIVE_WORD_BATCH = "word_batch"

BOOT_READY = "ready"
BOOT_DEFERRED = "deferred"
BOOT_BLOCKED = "blocked"
BOOT_PENDING = "pending"


@dataclass(frozen=True)
class BootVerdict:
    """Outcome of one boot verification.

    ``ready``: usable now. ``deferred``: not usable yet but fixable by the
    managed lifecycle (venv build, first model download) - never masked.
    ``blocked``: a hard precondition is missing (API key, package, weights,
    load error) - masked for the rest of the process until an explicit retry.
    """

    state: str
    reason: Optional[CodedMessage] = None

    @property
    def blocked(self) -> bool:
        return self.state == BOOT_BLOCKED


def ready() -> BootVerdict:
    return BootVerdict(BOOT_READY)


def deferred(reason: Optional[CodedMessage] = None) -> BootVerdict:
    return BootVerdict(BOOT_DEFERRED, reason)


def blocked(reason: CodedMessage) -> BootVerdict:
    return BootVerdict(BOOT_BLOCKED, reason)


@dataclass(frozen=True)
class ModelEntry:
    """One AI provider or local model."""

    id: str
    category: str
    runtime: str
    note: str = ""
    aliases: Tuple[str, ...] = ()
    managed_kind: Optional[str] = None
    concurrency: Optional[str] = None
    distribution: Optional[str] = None
    tier_engine: Optional[str] = None
    tiered: bool = False
    pip: Optional[Tuple[str, str]] = None
    library_name: Optional[str] = None
    library_kind: Optional[str] = None
    library_probe: bool = False
    languages: frozenset = frozenset()
    chunk_capable: bool = False
    accent_aware: bool = False
    cloud: bool = False
    external: bool = False
    health_paths: Tuple[str, ...] = ()
    live: Optional[str] = None
    testable: bool = True
    capabilities: Tuple[str, ...] = ()
    dispatch_tier: Optional[str] = None

    @property
    def key(self) -> str:
        return model_key(self.category, self.id)

    def names(self) -> Tuple[str, ...]:
        return (self.id,) + self.aliases


def normalize_model_id(value: str) -> str:
    return str(value or "").strip().lower().replace("-", "_")


def model_key(category: str, model_id: str) -> str:
    """Globally unique entry key ("tts:azure" and "stt:azure" are different)."""
    return f"{category}:{normalize_model_id(model_id)}"


class ModelManifest:
    """Registry of every ``ModelEntry``.

    Ids are unique per category. ``get(name, category)`` resolves an id or alias
    inside one category; ``get("tts:azure")`` (an entry key) and a bare name
    that exists in exactly one category also resolve.
    """

    def __init__(self) -> None:
        self._entries: Dict[str, ModelEntry] = {}
        self._lookup: Dict[Tuple[str, str], str] = {}

    def register(self, entries: Iterable[ModelEntry]) -> None:
        for entry in entries:
            if not normalize_model_id(entry.id):
                raise ValueError("model id is required")
            if entry.category not in CATEGORY_ORDER:
                raise ValueError(f"unknown model category: {entry.category}")
            key = entry.key
            existing = self._entries.get(key)
            if existing is not None:
                if existing != entry:
                    raise ValueError(f"conflicting model manifest entry: {key}")
                continue
            for name in entry.names():
                alias = (entry.category, normalize_model_id(name))
                owner = self._lookup.get(alias)
                if owner is not None and owner != key:
                    raise ValueError(f"model alias {name} already belongs to {owner}")
            self._entries[key] = entry
            for name in entry.names():
                self._lookup[(entry.category, normalize_model_id(name))] = key

    def get(self, name: str, category: Optional[str] = None) -> Optional[ModelEntry]:
        text = str(name or "")
        if category is None and ":" in text:
            category, text = text.split(":", 1)
        alias = normalize_model_id(text)
        if category is not None:
            key = self._lookup.get((category, alias))
            return self._entries.get(key) if key else None
        for candidate in CATEGORY_ORDER:
            key = self._lookup.get((candidate, alias))
            if key:
                return self._entries.get(key)
        return None

    def entries(self, category: Optional[str] = None) -> Tuple[ModelEntry, ...]:
        return tuple(
            entry for entry in self._entries.values()
            if category is None or entry.category == category
        )

    def ids(self, category: Optional[str] = None) -> Tuple[str, ...]:
        return tuple(entry.id for entry in self.entries(category))

    def categories(self) -> List[str]:
        present = {entry.category for entry in self._entries.values()}
        return [category for category in CATEGORY_ORDER if category in present]


model_manifest = ModelManifest()


__all__ = [
    "BOOT_BLOCKED",
    "BOOT_DEFERRED",
    "BOOT_PENDING",
    "BOOT_READY",
    "BootVerdict",
    "CATEGORY_AI_IMAGE",
    "CATEGORY_AI_TEXT",
    "CATEGORY_LIBRARY",
    "CATEGORY_LLM",
    "CATEGORY_OCR",
    "CATEGORY_ORDER",
    "CATEGORY_STT",
    "CATEGORY_TRANSLATE",
    "CATEGORY_TTS",
    "LIVE_QWEN_QUEUE",
    "LIVE_WORD_BATCH",
    "ModelEntry",
    "ModelManifest",
    "RUNTIME_CLOUD",
    "RUNTIME_LIBRARY",
    "RUNTIME_MODEL",
    "RUNTIME_SERVER",
    "blocked",
    "deferred",
    "model_key",
    "model_manifest",
    "normalize_model_id",
    "ready",
]
