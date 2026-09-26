# -*- coding: utf-8 -*-
"""Derive a raw agent prompt into standard English.

Given one raw prompt (any language, possibly mixed with DEBUG/log code
noise), ask the free-tier OpenRouter lane to derive the precise underlying
prompt in standard English: debug/logging code fragments are dropped, the
remaining intent is rewritten as one clean English prompt, and ONLY that
derived prompt comes back.

The provider call goes through the shared free-text base library
(:mod:`pycore.pyctl.ai.ai_free_text`) so this feature shares the same quota
budgets, key rotation, and usage recording as every other free-tier caller.
The preset template is user-editable (config key ``prompt_derive_en``);
``{prompt}`` is substituted with ``str.replace`` so templates may freely
contain JSON braces.

The second transform, ``rewrite_prompt_en``, sends a preset SYSTEM prompt
(config key ``prompt_rewrite_en``) plus the raw prompt as the user message:
the prompt is rewritten into standard English and every code block/snippet
is replaced by a short plain-language description of that code. Both
transforms share one call/normalize path (``_transform``).
"""
from __future__ import annotations

from typing import Any, Callable, Dict, List

from pycore.pyctl.ai.ai_free_text import free_text_chat, resolve_free_text_model
from pycore.pyctl.ai.ai_gateway_state import EXHAUSTED_ERROR_MARKERS, is_exhausted_error

CONFIG_KEY_PROMPT_DERIVE_EN = "prompt_derive_en"

DEFAULT_PROMPT_DERIVE_EN_PROMPT = (
    "You are a prompt engineer. Derive the PROMPT below into standard, precise English.\n"
    "Rules:\n"
    "1. Remove any DEBUG code, logging statements, stack traces, or diagnostic code\n"
    "   fragments embedded in the content; keep only the actual prompt intent.\n"
    "2. Rewrite the intent as ONE clear, standard-English prompt, preserving the\n"
    "   exact meaning and constraints of the original.\n"
    "3. If the prompt is already standard English, return it unchanged.\n"
    "Return ONLY the derived prompt text - no explanations, no markdown fences.\n\n"
    "PROMPT:\n{prompt}"
)

CONFIG_KEY_PROMPT_REWRITE_EN = "prompt_rewrite_en"

DEFAULT_PROMPT_REWRITE_EN_PROMPT = (
    "You rewrite software-development prompts written for an AI coding agent.\n"
    "Rewrite the user's message into clear, standard, natural English.\n"
    "Rules:\n"
    "1. Preserve the exact intent, requirements, constraints, names, paths, and order.\n"
    "2. Remove every code block and inline code snippet (source code, logs, stack\n"
    "   traces, command output, JSON/config dumps). Replace each one with ONE short\n"
    "   plain-language sentence describing what that code is, e.g. \"(A Python function\n"
    "   that parses the config file.)\".\n"
    "3. Write complete sentences that read naturally aloud; no markdown, lists of\n"
    "   symbols, or code formatting.\n"
    "4. If the message is already standard English without code, return it unchanged.\n"
    "Return ONLY the rewritten text - no explanations, no preface, no code fences."
)

_EXHAUSTED_MARKERS = EXHAUSTED_ERROR_MARKERS


def render_prompt_derive_en(config: Dict[str, Any], prompt_text: str) -> str:
    """User-saved template when present, else the built-in preset."""
    custom = str((config or {}).get(CONFIG_KEY_PROMPT_DERIVE_EN) or "").strip()
    template = custom or DEFAULT_PROMPT_DERIVE_EN_PROMPT
    return template.replace("{prompt}", str(prompt_text or ""))


def render_prompt_rewrite_en(config: Dict[str, Any]) -> str:
    """User-saved rewrite system prompt when present, else the built-in preset."""
    custom = str((config or {}).get(CONFIG_KEY_PROMPT_REWRITE_EN) or "").strip()
    return custom or DEFAULT_PROMPT_REWRITE_EN_PROMPT


def _transform(
    text: str,
    build_messages: Callable[[Dict[str, Any], str], List[Dict[str, Any]]],
    config: Dict[str, Any] | None,
    source: str,
) -> Dict[str, Any]:
    """One free-tier transform call. Returns:

    { success, exhausted, derived, provider, model, error }
    """
    out: Dict[str, Any] = {
        "success": False,
        "exhausted": False,
        "derived": "",
        "provider": None,
        "model": "",
        "error": None,
    }
    text = (text or "").strip()
    if not text:
        out["error"] = "empty text"
        return out

    cfg = config or {}
    model = resolve_free_text_model(cfg.get("openrouter_model"))
    res = free_text_chat(build_messages(cfg, text), model=model, source=source)
    out["provider"] = res.get("provider")
    out["model"] = str(res.get("model") or model)

    if not res.get("success"):
        err = str(res.get("error") or "prompt transform failed")
        out["error"] = err
        out["exhausted"] = is_exhausted_error(err)
        return out

    derived = str(res.get("text") or "").strip()
    # Strip a single wrapping code fence when the model ignores the rules.
    if derived.startswith("```") and derived.endswith("```"):
        lines = derived.splitlines()
        derived = "\n".join(lines[1:-1]).strip()
    if not derived:
        out["error"] = "model returned no text"
        return out

    out.update({"success": True, "derived": derived})
    return out


def derive_prompt_en(
    text: str,
    config: Dict[str, Any] | None = None,
    source: str = "prompt_derive_en",
) -> Dict[str, Any]:
    """Derive one raw prompt into standard English (single user message)."""
    return _transform(
        text,
        lambda cfg, body: [{"role": "user", "content": render_prompt_derive_en(cfg, body)}],
        config,
        source,
    )


def rewrite_prompt_en(
    text: str,
    config: Dict[str, Any] | None = None,
    source: str = "prompt_rewrite_en",
) -> Dict[str, Any]:
    """Rewrite one raw prompt into standard English, code replaced by short
    descriptions (preset system prompt + raw prompt as the user message)."""
    return _transform(
        text,
        lambda cfg, body: [
            {"role": "system", "content": render_prompt_rewrite_en(cfg)},
            {"role": "user", "content": body},
        ],
        config,
        source,
    )


__all__ = [
    "CONFIG_KEY_PROMPT_DERIVE_EN",
    "CONFIG_KEY_PROMPT_REWRITE_EN",
    "DEFAULT_PROMPT_DERIVE_EN_PROMPT",
    "DEFAULT_PROMPT_REWRITE_EN_PROMPT",
    "derive_prompt_en",
    "is_exhausted_error",
    "render_prompt_derive_en",
    "render_prompt_rewrite_en",
    "rewrite_prompt_en",
]
