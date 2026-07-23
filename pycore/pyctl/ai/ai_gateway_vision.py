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

TODO (deferred reuse batch): merge _describe_with_openai / _describe_with_anthropic
with ai_chat._chat_openai / _chat_anthropic (they share the openai/anthropic
HTTP shape); until then they stay here as the vision-specific inline calls.
"""

import base64
import time
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyutils.ai_cluster.gemini.gemini_client import GeminiClient
from pycore.pyctl.ai.ai_keys import PROVIDERS, first_secret
from pycore.pyctl.ai.ai_gateway_state import _PROBE_TTL_S

from pycore.pyutils.ai_cluster.openrouter.openrouter_client import OpenRouterClient


_GEMINI_VISION_MODEL = "gemini-2.5-flash"
_VISION_CACHE_SIGNAL = 'pyctl.ai.gateway.vision_cache'

_DEFAULT_IMAGE_PROMPT = (
    "Provide a comprehensive summary of this image, describing the main "
    "elements, scene, and any notable details."
)


def _describe_with_gemini(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    key = first_secret("gemini")
    if not key:
        out["error"] = "No API key configured"
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
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _openrouter_vision_model(key: str) -> Optional[str]:
    """Pick a live OpenRouter model that accepts image input (prefer free)."""
    cache = THREAD_BUS.get_signal(_VISION_CACHE_SIGNAL, {}) or {}
    fresh = (time.time() - float(cache.get("ts") or 0.0)) < _PROBE_TTL_S
    if fresh and cache.get("model"):
        return cache["model"]
    try:
        requests = get_third_package_requests()
        resp = requests.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        vision = [
            m.get("id", "") for m in data
            if "image" in ((m.get("architecture") or {}).get("input_modalities") or [])
        ]
        model = next((m for m in vision if m.endswith(":free")), vision[0] if vision else None)
        THREAD_BUS.signal(_VISION_CACHE_SIGNAL, {
            "ts": time.time(),
            "model": model,
        })
        return model
    except Exception as e:
        ColorPrint.yellow(f"[ai_gateway] OpenRouter vision-model scan failed: {e}")
        return None


def _image_data_url(image_path: str) -> str:
    suffix = Path(image_path).suffix.lstrip(".").lower() or "png"
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:image/{suffix};base64,{b64}"


def _describe_with_openrouter(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    key = first_secret("openrouter")
    if not key:
        out["error"] = "No API key configured"
        return out
    model = _openrouter_vision_model(key)
    if not model:
        out["error"] = "No vision-capable OpenRouter model found"
        return out
    out["model"] = model
    content = [
        {"type": "text", "text": prompt or _DEFAULT_IMAGE_PROMPT},
        {"type": "image_url", "image_url": {"url": _image_data_url(image_path)}},
    ]
    client = OpenRouterClient(api_key=key)
    resp = client.chat_completion(messages=[{"role": "user", "content": content}], model=model)
    if isinstance(resp, dict) and resp.get("error"):
        out["error"] = str(resp["error"])
        return out
    message = (resp.get("choices") or [{}])[0].get("message", {}) if isinstance(resp, dict) else {}
    out["text"] = client._extract_message_content(message)
    out["success"] = bool(out["text"])
    if not out["success"]:
        out["error"] = "Empty response from provider"
    return out


def _describe_with_openai(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    requests = get_third_package_requests()
    key = first_secret("openai")
    if not key:
        out["error"] = "No API key configured"
        return out
    model = PROVIDERS["openai"]["default_model"]
    out["model"] = model
    content = [
        {"type": "text", "text": prompt or _DEFAULT_IMAGE_PROMPT},
        {"type": "image_url", "image_url": {"url": _image_data_url(image_path)}},
    ]
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": model, "messages": [{"role": "user", "content": content}]},
        timeout=90,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:300]}"
        return out
    data = resp.json()
    out["text"] = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    out["success"] = bool(out["text"])
    if not out["success"]:
        out["error"] = "Empty response from provider"
    return out


def _describe_with_anthropic(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    requests = get_third_package_requests()
    key = first_secret("anthropic")
    if not key:
        out["error"] = "No API key configured"
        return out
    model = PROVIDERS["anthropic"]["default_model"]
    out["model"] = model
    suffix = Path(image_path).suffix.lstrip(".").lower() or "png"
    media_type = f"image/{'jpeg' if suffix in ('jpg', 'jpeg') else suffix}"
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    body = {
        "model": model,
        "max_tokens": 1024,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": prompt or _DEFAULT_IMAGE_PROMPT},
            ],
        }],
    }
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                 "Content-Type": "application/json"},
        json=body,
        timeout=90,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:300]}"
        return out
    data = resp.json()
    out["text"] = "".join(
        b.get("text", "") for b in (data.get("content") or []) if b.get("type") == "text")
    out["success"] = bool(out["text"])
    if not out["success"]:
        out["error"] = "Empty response from provider"
    return out


_VISION_DISPATCH = {
    "gemini": _describe_with_gemini,
    "openrouter": _describe_with_openrouter,
    "openai": _describe_with_openai,
    "anthropic": _describe_with_anthropic,
}
