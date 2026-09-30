# -*- coding: utf-8 -*-
"""Cloud AI provider declarations, derived from the single provider registry."""

from typing import Optional, Tuple

from pycore.pyctl.ai.ai_keys import PROVIDER_ORDER, PROVIDERS, is_image_only
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_manifest import (
    CATEGORY_AI_IMAGE,
    CATEGORY_AI_TEXT,
    RUNTIME_CLOUD,
    ModelEntry,
    model_manifest,
)


def _capabilities(meta: dict) -> Tuple[str, ...]:
    capabilities = [] if meta.get("image_only") else ["text"]
    if meta.get("vision"):
        capabilities.append("vision")
    if meta.get("image"):
        capabilities.append("image")
    return tuple(capabilities)


def _entry(name: str) -> ModelEntry:
    meta = PROVIDERS[name]
    return ModelEntry(
        name,
        CATEGORY_AI_IMAGE if meta.get("image_only") else CATEGORY_AI_TEXT,
        RUNTIME_CLOUD,
        note=str(meta.get("limits", "")),
        concurrency="cloud",
        cloud=True,
        capabilities=_capabilities(meta),
        dispatch_tier=str(meta.get("tier") or "") or None,
    )


AI_PROVIDER_ENTRIES = tuple(
    _entry(name)
    for name in tuple(PROVIDER_ORDER) + tuple(n for n in PROVIDERS if n not in PROVIDER_ORDER)
    if name in PROVIDERS
)

model_manifest.register(AI_PROVIDER_ENTRIES)


def provider_category(provider: str) -> str:
    return CATEGORY_AI_IMAGE if is_image_only(provider) else CATEGORY_AI_TEXT


def provider_block_reason(provider: str) -> Optional[str]:
    """The boot reason masking a provider, or None when it is not blocked."""
    return model_boot.reason(provider, provider_category(provider))
