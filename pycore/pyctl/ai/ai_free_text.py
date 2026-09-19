# -*- coding: utf-8 -*-
"""Shared OpenRouter free-tier text helper.

The single general-purpose entry for "call OpenRouter on the free quota".
This logic used to be embedded inside the agent-history article pipeline
(``article_stages.ensure_openrouter_available`` plus inline ``chat_once``
wiring); it is now a shared base library so ANY feature (agent-history
pipeline, prompt EN derivation, future tools) reuses the same quota stack:

- ``ai_rate_limits.check_rate_limit`` — local free-tier minute/day budgets
- ``ai_chat.chat_once`` — provider call + shared usage-log recording
- ``ai_request_failures`` — unified failure classification / AiRequestError

Callers pass a ``source`` label so the UI usage dashboards can attribute
every call to the feature that made it.
"""

from typing import Any, Dict, List, Optional

from pycore.pyctl.ai.ai_chat import chat_once
from pycore.pyctl.ai.ai_rate_limits import check_rate_limit
from pycore.pyutils.common.ai_request_failures import AiRequestError, classify_ai_failure

FREE_TEXT_PROVIDER = "openrouter"
FREE_TEXT_DEFAULT_MODEL = "openrouter/free"
FREE_TEXT_QUOTA_EXHAUSTED = "openrouter daily request limit reached"


def resolve_free_text_model(config_model: Any = "") -> str:
    """Caller-configured model wins; otherwise the free router."""
    return str(config_model or "").strip() or FREE_TEXT_DEFAULT_MODEL


def ensure_free_text_available() -> None:
    """Raise AiRequestError when the local free-tier budget is exhausted.

    Pre-dispatch guard: a provider over its local minute/day budget must not
    be hit at all (the request would burn provider-side quota and 429).
    """
    rate = check_rate_limit(FREE_TEXT_PROVIDER)
    if rate.allowed:
        return
    msg = rate.message or "openrouter rate limit"
    failure = classify_ai_failure(msg)
    if "requests/day" in msg.lower() or "day exceeded" in msg.lower():
        msg = FREE_TEXT_QUOTA_EXHAUSTED
    raise AiRequestError(
        msg,
        code=str(failure["code"]),
        retriable=bool(failure["retriable"]),
        provider_reached=False,
        retry_after_s=rate.retry_after_s,
    )


def free_text_chat(
    messages: List[Dict[str, Any]],
    model: Optional[str] = None,
    source: str = "",
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """One free-tier OpenRouter chat turn with the shared quota guard.

    Returns the unified chat_once contract:
    ``{success, provider, model, text, latency_ms, error, ...}``.
    """
    ensure_free_text_available()
    return chat_once(
        FREE_TEXT_PROVIDER,
        messages,
        resolve_free_text_model(model),
        source=source,
        context=context,
    ) or {}


def free_text_prompt(
    prompt: str,
    model: Optional[str] = None,
    source: str = "",
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Single-user-message convenience wrapper over free_text_chat."""
    return free_text_chat(
        [{"role": "user", "content": str(prompt or "")}],
        model=model,
        source=source,
        context=context,
    )


__all__ = [
    "FREE_TEXT_DEFAULT_MODEL",
    "FREE_TEXT_PROVIDER",
    "FREE_TEXT_QUOTA_EXHAUSTED",
    "ensure_free_text_available",
    "free_text_chat",
    "free_text_prompt",
    "resolve_free_text_model",
]
