"""Translate a (possibly non-English) prompt into fluent English.

Shapes the AI-gateway prompt, masks code so it is never translated, asks for a
strict-JSON answer carrying the English translation, a cleaned-up sentence, and 3
fluent variants, then restores code. The provider call is the shared AI gateway
(pycore.pyctl.ai.generate_text); this module only shapes the prompt + parses,
mirroring callmodule/services/ai_batch_translate.py.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from pycore.pyctl.ai.ai_gateway import generate_text

from pycore.pyutils.translator.code_filter import mask_code, unmask_code

# Marker the AI gateway returns when every provider is rate-limited / keyless.
_EXHAUSTED_MARKERS = ("no ai provider available", "rate limit", "quota")
_JSON_OBJ_RE = re.compile(r"\{.*\}", re.DOTALL)


def _build_prompt(masked: str, src: str) -> str:
    src_label = "the source language (auto-detect)" if (src or "auto") in ("", "auto") else src
    return (
        "You are a translator. Translate the TEXT below from "
        f"{src_label} into natural, fluent English.\n"
        "Rules:\n"
        "1. Any token of the form [[CODE_n]] is a placeholder for source code — keep "
        "every such token EXACTLY as written; never translate, reorder, or alter it.\n"
        "2. Clean up the sentence so it reads as fluent, well-formed English.\n"
        "3. Provide exactly 3 distinct fluent English variants of the meaning.\n"
        "Return ONLY a JSON object, no markdown or code fences, shaped exactly:\n"
        '{"english": <faithful translation>, "cleaned": <fluent cleaned sentence>, '
        '"variants": [<variant1>, <variant2>, <variant3>]}\n\n'
        f"TEXT:\n{masked}"
    )


def _parse(answer: str) -> Dict[str, Any]:
    if not answer:
        return {}
    match = _JSON_OBJ_RE.search(answer)
    blob = match.group(0) if match else answer
    try:
        data = json.loads(blob)
    except (ValueError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


def _is_exhausted(error: str) -> bool:
    low = (error or "").lower()
    return any(m in low for m in _EXHAUSTED_MARKERS)


def translate_prompt(text: str, src: str = "auto", source: str = "prompt_translate_worker") -> Dict[str, Any]:
    """Translate one prompt. Returns:

    { success: bool, exhausted: bool, english: str, cleaned: str,
      variants: List[str], provider: str|None, error: str|None }
    """
    out: Dict[str, Any] = {
        "success": False, "exhausted": False, "english": "", "cleaned": "",
        "variants": [], "provider": None, "error": None,
    }
    text = (text or "").strip()
    if not text:
        out["error"] = "empty text"
        return out

    masked, segments = mask_code(text)
    res = generate_text(prompt=_build_prompt(masked, src), source=source) or {}
    out["provider"] = res.get("provider")

    if not res.get("success"):
        err = str(res.get("error") or "translate failed")
        out["error"] = err
        out["exhausted"] = _is_exhausted(err)
        return out

    data = _parse(res.get("text") or "")
    english = unmask_code(str(data.get("english") or "").strip(), segments)
    cleaned = unmask_code(str(data.get("cleaned") or english).strip(), segments)
    variants_raw = data.get("variants") if isinstance(data.get("variants"), list) else []
    variants: List[str] = []
    for v in variants_raw[:3]:
        if isinstance(v, str) and v.strip():
            variants.append(unmask_code(v.strip(), segments))

    if not english:
        out["error"] = "model returned no english translation"
        return out

    out.update({"success": True, "english": english, "cleaned": cleaned, "variants": variants})
    return out
