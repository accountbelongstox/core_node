# -*- coding: utf-8 -*-
"""Preset pipeline prompt templates (code fallback).

User-edited copies live in the user data store (``agent_history_article``
section, keys ``prompt_article_cn`` / ``prompt_translate_en``); a non-empty
user value wins over these built-in defaults. Tokens are substituted with
``str.replace`` so templates may freely contain JSON braces.
"""

from typing import Any, Dict

from pycore.pyutils.laravel.article_contract import TITLE_PROMPT_MAX

CONFIG_KEY_ARTICLE_CN = "prompt_article_cn"
CONFIG_KEY_TRANSLATE_EN = "prompt_translate_en"

DEFAULT_ARTICLE_CN_PROMPT = (
    "You are a language-learning editor. Reference language: {ref}.\n"
    "Using ONLY the RAW material below, write one coherent short article in fluent Chinese.\n"
    "Rules:\n"
    "1. Preserve factual meaning from the raw fragments; do not invent unrelated topics.\n"
    "2. The Chinese article body goes in reference_cn (at least 150 characters).\n"
    "3. title_cn is a concise title of at most {title_max} characters.\n"
    "Return ONLY JSON (no markdown) shaped exactly:\n"
    '{"title_cn": string, "reference_cn": string}\n\n'
    "RAW:\n{raw}"
)

DEFAULT_TRANSLATE_EN_PROMPT = (
    "Translate the following Chinese article into fluent English.\n"
    "Rules:\n"
    "1. The English article in article_en must be at least 180 words.\n"
    "2. Preserve the factual meaning; do not add unrelated content.\n"
    "3. title_en is a concise English title of at most {title_max} characters.\n"
    "Return ONLY JSON (no markdown) shaped exactly:\n"
    '{"title_en": string, "article_en": string}\n\n'
    "TITLE_CN: {title_cn}\n"
    "ARTICLE_CN:\n{article_cn}"
)


def prompt_defaults() -> Dict[str, str]:
    """The built-in fallback templates, keyed by their config keys."""
    return {
        CONFIG_KEY_ARTICLE_CN: DEFAULT_ARTICLE_CN_PROMPT,
        CONFIG_KEY_TRANSLATE_EN: DEFAULT_TRANSLATE_EN_PROMPT,
    }


def resolve_prompt(config: Dict[str, Any], key: str) -> str:
    """User-saved template when present, else the built-in fallback."""
    custom = str((config or {}).get(key) or "").strip()
    if custom:
        return custom
    return prompt_defaults().get(key, "")


def render_article_cn_prompt(config: Dict[str, Any], ref: str, raw_text: str) -> str:
    template = resolve_prompt(config, CONFIG_KEY_ARTICLE_CN)
    return (
        template
        .replace("{ref}", str(ref))
        .replace("{title_max}", str(TITLE_PROMPT_MAX))
        .replace("{raw}", raw_text)
    )


def render_translate_en_prompt(config: Dict[str, Any], title_cn: str, article_cn: str) -> str:
    template = resolve_prompt(config, CONFIG_KEY_TRANSLATE_EN)
    return (
        template
        .replace("{title_max}", str(TITLE_PROMPT_MAX))
        .replace("{title_cn}", title_cn)
        .replace("{article_cn}", article_cn)
    )
