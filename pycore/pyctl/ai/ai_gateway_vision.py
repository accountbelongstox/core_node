#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ai_gateway_vision - the image->text (vision) provider chain for the AI gateway.

Each ``_describe_with_*`` helper turns an image file + optional prompt into text
through one vision-capable provider (gemini / openrouter / openai / anthropic),
writing the unified contract into the shared ``out`` dict. The orchestrator
facade (ai_gateway.describe_image) picks + fallback-orders them via
``_VISION_DISPATCH``. The OpenRouter vision-model pick is TTL-cached in
``_vision_model_cache`` (owned by ai_gateway_state).

OpenRouter and OpenAI go through the one OpenAI-compatible client; Anthropic
through its Messages client.
"""

import base64
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.ai_cluster.anthropic.anthropic_client import AnthropicClient
from pycore.pyutils.ai_cluster.gemini.gemini_client import GeminiClient
from pycore.pyutils.ai_cluster.openai_compat.openai_compat_client import FREE_ROUTER_MODEL
from pycore.pyctl.ai.ai_keys import PROVIDERS, compat_client, first_secret
from pycore.pyctl.ai.ai_gateway_state import _PROBE_TTL_S


_GEMINI_VISION_MODEL = "gemini-2.5-flash"
_VISION_CACHE_SIGNAL = BusSignals.AI_GATEWAY_VISION_CACHE

ERROR_NO_KEY = "No API key configured"
ERROR_NO_TEXT = "Empty response from provider"
ERROR_NO_VISION_MODEL = "No vision-capable OpenRouter model found"
VISION_INPUT_MODALITY = "image"

_DEFAULT_IMAGE_PROMPT = (
    "Provide a comprehensive summary of this image, describing the main "
    "elements, scene, and any notable details."
)


def _describe_with_gemini(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    key = first_secret("gemini")
    if not key:
        out["error"] = ERROR_NO_KEY
        return out
    client = GeminiClient(api_key=key, default_model=_GEMINI_VISION_MODEL)
    out["model"] = _GEMINI_VISION_MODEL
    if prompt:
        res = client.generate_with_images(prompt=prompt, image_paths=[image_path])
        text = res.get("text", "")
    else:
        # No-prompt path keeps the ORIGINAL screenshot prompt (summarize_image
        # detail_level="medium") byte-for-byte.
        res = client.summarize_image(image_path=image_path, detail_level="medium")
        text = res.get("summary", "")
    if res.get("success") and text:
        out["success"] = True
        out["text"] = text
    else:
        out["error"] = res.get("error") or ERROR_NO_TEXT
    return out


def _openrouter_vision_model(key: str) -> Optional[str]:
    """Free vision model for OpenRouter: the openrouter/free router when listed,
    else the first free model that accepts image input; None otherwise."""
    cache = THREAD_BUS.get_signal(_VISION_CACHE_SIGNAL, {}) or {}
    fresh = (time.time() - float(cache.get("ts") or 0.0)) < _PROBE_TTL_S
    if fresh and cache.get("model"):
        return cache["model"]
    rows, error = compat_client("openrouter", key).catalog_rows()
    vision = [
        str(row.get("id") or "") for row in rows
        if VISION_INPUT_MODALITY in ((row.get("architecture") or {}).get("input_modalities") or [])
    ]
    ids = [str(row.get("id") or "") for row in rows]
    model = FREE_ROUTER_MODEL if FREE_ROUTER_MODEL in ids else next(iter(vision), None)
    if error is None:
        THREAD_BUS.signal(_VISION_CACHE_SIGNAL, {"ts": time.time(), "model": model})
    return model


def _read_image(image_path: str) -> Tuple[str, str]:
    """(base64, suffix) of an image file."""
    suffix = Path(image_path).suffix.lstrip(".").lower() or "png"
    return base64.b64encode(Path(image_path).read_bytes()).decode("ascii"), suffix


def _compat_vision_content(image_path: str, prompt: Optional[str]) -> list:
    b64, suffix = _read_image(image_path)
    return [
        {"type": "text", "text": prompt or _DEFAULT_IMAGE_PROMPT},
        {"type": "image_url", "image_url": {"url": f"data:image/{suffix};base64,{b64}"}},
    ]


def _describe_with_compat(provider: str, model: str, key: str, image_path: str,
                          prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    out["model"] = model
    res = compat_client(provider, key).chat(
        [{"role": "user", "content": _compat_vision_content(image_path, prompt)}], model,
    )
    out["text"] = res["text"]
    out["success"] = res["success"]
    out["error"] = res["error"]
    return out


def _describe_with_openrouter(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    key = first_secret("openrouter")
    if not key:
        out["error"] = ERROR_NO_KEY
        return out
    model = _openrouter_vision_model(key)
    if not model:
        out["error"] = ERROR_NO_VISION_MODEL
        return out
    return _describe_with_compat("openrouter", model, key, image_path, prompt, out)


def _describe_with_openai(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    key = first_secret("openai")
    if not key:
        out["error"] = ERROR_NO_KEY
        return out
    return _describe_with_compat(
        "openai", PROVIDERS["openai"]["default_model"], key, image_path, prompt, out,
    )


def _describe_with_anthropic(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    key = first_secret("anthropic")
    if not key:
        out["error"] = ERROR_NO_KEY
        return out
    model = PROVIDERS["anthropic"]["default_model"]
    out["model"] = model
    b64, suffix = _read_image(image_path)
    media_type = f"image/{'jpeg' if suffix in ('jpg', 'jpeg') else suffix}"
    res = AnthropicClient(key).messages([{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            {"type": "text", "text": prompt or _DEFAULT_IMAGE_PROMPT},
        ],
    }], model)
    out["text"] = res["text"]
    out["success"] = res["success"]
    out["error"] = res["error"]
    return out


_VISION_DISPATCH = {
    "gemini": _describe_with_gemini,
    "openrouter": _describe_with_openrouter,
    "openai": _describe_with_openai,
    "anthropic": _describe_with_anthropic,
}
