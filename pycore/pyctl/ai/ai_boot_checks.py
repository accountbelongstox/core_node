# -*- coding: utf-8 -*-
"""Boot verification of the cloud AI providers: the required secrets are present."""

from typing import Callable

import pycore.pyctl.ai.ai_keys as ai_keys
import pycore.pyctl.ai.ai_manifest as ai_manifest
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_manifest import (
    CATEGORY_AI_IMAGE,
    CATEGORY_AI_TEXT,
    BootVerdict,
    blocked,
    ready,
)
from pycore.pyutils.common.model_reasons import MODEL_REASON_SECRET_MISSING, model_reason


def _required_secrets(provider: str) -> str:
    meta = ai_keys.PROVIDERS[provider]
    names = [str(meta.get("key_base") or "")]
    names.extend(str(extra) for extra in meta.get("extra_required", ()))
    if provider == "cloudflare":
        names.append(str(meta.get("extra_secret") or ""))
    return ", ".join(dict.fromkeys(name for name in names if name))


def _provider_check(provider: str) -> Callable[[], BootVerdict]:
    def check() -> BootVerdict:
        if ai_keys.is_configured(provider):
            return ready()
        return blocked(model_reason(
            MODEL_REASON_SECRET_MISSING, secrets=_required_secrets(provider),
        ))

    return check


for _category in (CATEGORY_AI_TEXT, CATEGORY_AI_IMAGE):
    model_boot.register_checks(_category, tuple(
        (entry.id, _provider_check(entry.id))
        for entry in ai_manifest.AI_PROVIDER_ENTRIES
        if entry.category == _category
    ))
