# -*- coding: utf-8 -*-
"""
AI control package (pyctl layer) — the unified AI exit.

Orchestrates the provider clients (openrouter / gemini / deepseek / openai /
anthropic — registry in ai_keys.PROVIDERS) behind one probe (ai_probe), one
single-provider chat (ai_chat) and the smart-dispatch gateway (ai_gateway:
generate_text / describe_image / generate_image with quota awareness, cooldowns
and per-task records). All AI calls in pycore go through this package; routes expose it at
/api/local/ai/* and the desktop pipelines receive it via
pycore.pyctl.desktop.ai_hooks (composed at the app layer).
"""

from pycore.pyctl.ai.ai_probe import probe_all, probe_one, catalog, mask_key
from pycore.pyctl.ai.ai_chat import chat_once
from pycore.pyctl.ai.ai_keys import PROVIDERS, PROVIDER_ORDER
from pycore.pyctl.ai.ai_gateway import (
    generate_text,
    describe_image,
    generate_image,
    available_providers,
    get_quota,
    gateway_status,
    invalidate_probe_cache,
    clear_expired_cooldowns,
)
from pycore.pyctl.ai.ai_rate_limits import prune_expired, rate_status

__all__ = [
    "probe_all", "probe_one", "catalog", "mask_key", "chat_once",
    "prune_expired", "rate_status", "clear_expired_cooldowns",
    "PROVIDERS", "PROVIDER_ORDER",
    "generate_text", "describe_image", "generate_image", "available_providers",
    "get_quota", "gateway_status", "invalidate_probe_cache",
]
