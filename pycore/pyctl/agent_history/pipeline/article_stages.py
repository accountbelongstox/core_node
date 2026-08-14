# -*- coding: utf-8 -*-
import json
import re
from typing import Any, Dict, Tuple

from pycore.pyctl.agent_history.agent_history_fragments import sanitize_fragment_text, count_words
from pycore.pyctl.ai.ai_chat import chat_once
from pycore.pyctl.ai.ai_rate_limits import check_rate_limit
from pycore.pyctl.agent_history.pipeline.config import get_config
from pycore.pyutils.common.ai_request_failures import AiRequestError, classify_ai_failure

_JSON_OBJ_RE = re.compile(r"\{.*\}", re.DOTALL)
_QUOTA_ERROR = "openrouter daily request limit reached"

def _parse_json_obj(text: str) -> Dict[str, Any]:
    """Parse the FIRST complete JSON object from model output.

    Free-tier models sometimes emit the same JSON object twice back to back
    (or append prose after it). A greedy first-{ to last-} match then spans
    two objects and json.loads fails with "Extra data". raw_decode stops at
    the end of the first valid object instead; the greedy-regex fallback is
    kept for outputs where the object does not start at the first brace.
    """
    blob = str(text or "")
    start = blob.find("{")
    if start >= 0:
        try:
            data, _end = json.JSONDecoder().raw_decode(blob[start:])
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    match = _JSON_OBJ_RE.search(blob)
    data = json.loads(match.group(0) if match else blob)
    if not isinstance(data, dict):
        raise ValueError("model returned non-object JSON")
    return data

def ensure_openrouter_available() -> None:
    rate = check_rate_limit("openrouter")
    if rate.allowed:
        return
    msg = rate.message or "openrouter rate limit"
    failure = classify_ai_failure(msg)
    if "requests/day" in msg.lower() or "day exceeded" in msg.lower():
        msg = _QUOTA_ERROR
    raise AiRequestError(
        msg,
        code=str(failure["code"]),
        retriable=bool(failure["retriable"]),
        provider_reached=False,
        retry_after_s=rate.retry_after_s,
    )

def generate_chinese_article(
    raw_text: str,
    request_context: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Generate a Chinese article from raw fragments."""
    cfg = get_config()
    model = str(cfg.get("openrouter_model") or "openrouter/free")
    ref = str(cfg.get("reference_lang") or "CN").upper()
    
    prompt = (
        f"You are a language-learning editor. Reference language: {ref}.\n"
        "Using ONLY the RAW material below, write one coherent short article in fluent Chinese.\n"
        "Rules:\n"
        "1. Preserve factual meaning from the raw fragments; do not invent unrelated topics.\n"
        "2. The Chinese article body goes in reference_cn (at least 150 characters).\n"
        "Return ONLY JSON (no markdown) shaped exactly:\n"
        '{"title_cn": string, "reference_cn": string}\n\n'
        f"RAW:\n{raw_text}"
    )
    
    ensure_openrouter_available()
    
    res = chat_once(
        "openrouter",
        [{"role": "user", "content": prompt}],
        model,
        source="agent_history_article",
        context=request_context,
    ) or {}
    
    if not res.get("success"):
        err = str(res.get("error") or "article generation failed")
        raise AiRequestError(
            f"OpenRouter CN failed: {err}",
            code=str(res.get("error_code") or "unknown"),
            retriable=bool(res.get("retriable")),
            provider_reached=bool(res.get("provider_reached")),
            retry_after_s=res.get("retry_after_s"),
        )
        
    data = _parse_json_obj(str(res.get("text") or ""))
    reference_cn = sanitize_fragment_text(str(data.get("reference_cn") or ""))
    
    if len(reference_cn) < 80:
        raise ValueError("generated Chinese article too short")
        
    data["reference_cn"] = reference_cn
    data["title_cn"] = str(data.get("title_cn") or "").strip()
    data["used_model"] = model
    
    return data

def translate_to_english(
    article_cn: Dict[str, Any],
    request_context: Dict[str, Any] | None = None,
) -> Tuple[Dict[str, Any], str]:
    """Translate the Chinese article to English."""
    cfg = get_config()
    model = str(cfg.get("openrouter_model") or "openrouter/free")
    
    prompt = (
        "Translate the following Chinese article into fluent English.\n"
        "Rules:\n"
        "1. The English article in article_en must be at least 180 words.\n"
        "2. Preserve the factual meaning; do not add unrelated content.\n"
        "Return ONLY JSON (no markdown) shaped exactly:\n"
        '{"title_en": string, "article_en": string}\n\n'
        f"TITLE_CN: {article_cn.get('title_cn') or ''}\n"
        f"ARTICLE_CN:\n{article_cn.get('reference_cn') or ''}"
    )
    
    ensure_openrouter_available()
    
    res = chat_once(
        "openrouter",
        [{"role": "user", "content": prompt}],
        model,
        source="agent_history_translate",
        context=request_context,
    ) or {}
    
    if not res.get("success"):
        err = str(res.get("error") or "translation failed")
        raise AiRequestError(
            f"OpenRouter EN failed: {err}",
            code=str(res.get("error_code") or "unknown"),
            retriable=bool(res.get("retriable")),
            provider_reached=bool(res.get("provider_reached")),
            retry_after_s=res.get("retry_after_s"),
        )
        
    data = _parse_json_obj(str(res.get("text") or ""))
    article_en = sanitize_fragment_text(str(data.get("article_en") or ""))
    
    if count_words(article_en) < 120:
        raise ValueError("translated article too short")
        
    data["article_en"] = article_en
    # Fallback must stay English — the CN title must never leak into title_en
    # (wordnew Daily Reading renders the English version).
    title_en = str(data.get("title_en") or "").strip()
    if not title_en:
        title_en = " ".join(article_en.split()[:8]).strip() or "Untitled article"
    data["title_en"] = title_en
    
    return data, "openrouter"
