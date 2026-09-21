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
"""
from __future__ import annotations

from typing import Any, Dict

from pycore.pyctl.ai.ai_free_text import free_text_prompt, resolve_free_text_model

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

_EXHAUSTED_MARKERS = ("rate limit", "quota", "no ai provider available")


def is_exhausted_error(error: str) -> bool:
    low = (error or "").lower()
    return any(marker in low for marker in _EXHAUSTED_MARKERS)


def render_prompt_derive_en(config: Dict[str, Any], prompt_text: str) -> str:
    """User-saved template when present, else the built-in preset."""
    custom = str((config or {}).get(CONFIG_KEY_PROMPT_DERIVE_EN) or "").strip()
    template = custom or DEFAULT_PROMPT_DERIVE_EN_PROMPT
    return template.replace("{prompt}", str(prompt_text or ""))


def derive_prompt_en(
    text: str,
    config: Dict[str, Any] | None = None,
    source: str = "prompt_derive_en",
) -> Dict[str, Any]:
    """Derive one raw prompt into standard English. Returns:

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
    res = free_text_prompt(
        render_prompt_derive_en(cfg, text),
        model=model,
        source=source,
    )
    out["provider"] = res.get("provider")
    out["model"] = str(res.get("model") or model)

    if not res.get("success"):
        err = str(res.get("error") or "prompt derivation failed")
        out["error"] = err
        out["exhausted"] = is_exhausted_error(err)
        return out

    derived = str(res.get("text") or "").strip()
    # Strip a single wrapping code fence when the model ignores rule 3.
    if derived.startswith("```") and derived.endswith("```"):
        lines = derived.splitlines()
        derived = "\n".join(lines[1:-1]).strip()
    if not derived:
        out["error"] = "model returned no derived prompt"
        return out

    out.update({"success": True, "derived": derived})
    return out


__all__ = [
    "CONFIG_KEY_PROMPT_DERIVE_EN",
    "DEFAULT_PROMPT_DERIVE_EN_PROMPT",
    "derive_prompt_en",
    "is_exhausted_error",
    "render_prompt_derive_en",
]
