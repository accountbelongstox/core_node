#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified AI provider probe.

Loads each provider's API key via the COMMON secret reader
(``pycore.pyfoundations.secret_manager.get_secret_key``), instantiates the
matching client, and runs a MINIMAL live availability check (prefer a cheap
"list models" call). Returns a stable contract consumed by the desktop UI and
the /api/local/ai/probe route.

Providers:
  - openrouter : OpenRouter (OpenAI-compatible router)         key: OPENROUTER_API_KEY_1 / _2
  - gemini     : Google Gemini == Google's generative AI       key: GOOGLE_API_KEY_1 / _2
  - groq       : Groq (very fast inference)                    key: GROQ_API_KEY_1 / _2
  - mistral    : Mistral AI (European LLMs)                    key: MISTRAL_API_KEY_1 / _2
  - cohere     : Cohere (LLM platform)                         key: COHERE_API_KEY_1 / _2
  - nvidia     : NVIDIA NIM (accelerated inference)            key: NVIDIA_API_KEY_1 / _2
  - huggingface: HuggingFace Inference API                    key: HF_TOKEN_1 / _2
  - zhipuai    : Zhipu AI / BigModel.cn (Chinese LLMs)         key: ZHIPUAI_API_KEY_1 / _2
  - deepseek   : DeepSeek (OpenAI-compatible, api.deepseek.com) key: DEEPSEEK_API_KEY_1 / DEEPSEEK_API_KEY
  - openai     : OpenAI (ChatGPT)                              key: OPENAI_API_KEY_1 / _2
  - anthropic  : Anthropic (Claude)                            key: ANTHROPIC_API_KEY_1 / _2

Note on "Google AI": Gemini IS Google's generative AI. The ``google-genai`` SDK
and GOOGLE_API_KEY are the single Google generative-AI surface here, so there is
no separate "google-ai" provider entry — it is the ``gemini`` entry.

Contract (UI depends on this EXACT shape):
    {
      "providers": [
        {
          "name": str,
          "configured": bool,           # key present
          "available": bool,            # live call succeeded
          "image": bool,                # provider CAN generate images (registry flag)
          "image_ready": bool,          # image-capable AND key present (no live call;
                                        # consumers gate image work on THIS, not on
                                        # the volatile live `available`)
          "image_model": str,           # the bound image model id (UI display);
                                        # "" when the provider can't generate images
          "key_masked": str | None,     # first4 + "…" + last4 (never the full key)
          "models": [str],              # a couple of model ids (truncated)
          "error": str | None,
          "latency_ms": number | None
        }, ...
      ]
    }
"""

import time
from typing import Dict, Any, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key
from pycore.pyfoundations.third_party import get_third_package_requests
from functools import partial

from pycore.pyctl.ai.ai_keys import (
    PROVIDERS,
    PROVIDER_ORDER,
    OPENAI_COMPAT_PROVIDERS,
    catalog_models,
    first_secret as _provider_secret,
    has_image_key,
    is_configured,
)
from pycore.pyctl.ai.ai_compat_helpers import probe_openai_compat, probe_cloudflare, probe_spark
from pycore.pyctl.ai.ai_rate_limits import rate_status
from pycore.pyctl.ai.ai_usage_log import record_usage

# Maximum model ids returned per provider (keep the payload small for the UI).
_MAX_MODELS = 5


def mask_key(key: Optional[str]) -> Optional[str]:
    """
    Mask a secret for display: first 4 + "…" + last 4 chars only.

    Returns None when there is no key. Very short keys are fully ellipsized so we
    never leak the whole value.
    """
    if not key:
        return None
    key = key.strip()
    if len(key) <= 8:
        return "…"
    return f"{key[:4]}…{key[-4:]}"


def _first_secret(*names: str) -> str:
    """Return the first non-empty secret among the given key names (or '')."""
    for name in names:
        val = get_secret_key(name)
        if val:
            return val
    return ""


def _probe_openrouter() -> Dict[str, Any]:
    """Probe OpenRouter via its /models endpoint (OpenAI-compatible router)."""
    name = "openrouter"
    key = _provider_secret("openrouter")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.openrouter.openrouter_client import OpenRouterClient
        client = OpenRouterClient(api_key=key)
        models = client.list_models()
        if models:
            result["available"] = True
            result["models"] = models[:_MAX_MODELS]
        else:
            result["error"] = "No models returned"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_gemini() -> Dict[str, Any]:
    """Probe Google Gemini (== Google generative AI) via the google-genai SDK."""
    name = "gemini"
    key = _provider_secret("gemini")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.gemini.gemini_client import GeminiClient
        client = GeminiClient(api_key=key)
        models = client.list_models()
        result["available"] = True
        result["models"] = models[:_MAX_MODELS]
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_deepseek() -> Dict[str, Any]:
    """Probe DeepSeek via its OpenAI-compatible /models endpoint."""
    name = "deepseek"
    key = _provider_secret("deepseek")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.deepseek import get_deepseek_client
        client = get_deepseek_client(api_key=key)
        listed = client.list_models()
        if listed.get("success"):
            result["available"] = True
            result["models"] = listed.get("models", [])[:_MAX_MODELS]
        else:
            result["error"] = listed.get("error") or "list_models failed"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_openai() -> Dict[str, Any]:
    """Probe OpenAI (ChatGPT) via GET /v1/models (cheap key validation)."""
    name = "openai"
    key = _provider_secret("openai")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        requests = get_third_package_requests()
        resp = requests.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        # Surface chat-capable gpt models first so models[0] is usable for chat.
        ids = [m.get("id", "") for m in data if m.get("id", "").startswith("gpt-")]
        result["available"] = True
        result["models"] = (ids or [m.get("id", "") for m in data])[:_MAX_MODELS]
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_anthropic() -> Dict[str, Any]:
    """Probe Anthropic (Claude) via GET /v1/models (cheap key validation)."""
    name = "anthropic"
    key = _provider_secret("anthropic")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        requests = get_third_package_requests()
        resp = requests.get(
            "https://api.anthropic.com/v1/models",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        result["available"] = True
        result["models"] = [m.get("id", "") for m in data[:_MAX_MODELS] if m.get("id")]
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_groq() -> Dict[str, Any]:
    """Probe Groq via its OpenAI-compatible /models endpoint."""
    name = "groq"
    key = _provider_secret("groq")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.groq.groq_client import GroqClient
        client = GroqClient(api_key=key)
        models = client.list_models()
        if models:
            result["available"] = True
            result["models"] = models[:_MAX_MODELS]
        else:
            result["error"] = "No models returned"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_mistral() -> Dict[str, Any]:
    """Probe Mistral AI via its /v1/models endpoint."""
    name = "mistral"
    key = _provider_secret("mistral")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.mistral.mistral_client import MistralClient
        client = MistralClient(api_key=key)
        models = client.list_models()
        if models:
            result["available"] = True
            result["models"] = models[:_MAX_MODELS]
        else:
            result["error"] = "No models returned"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_cohere() -> Dict[str, Any]:
    """Probe Cohere via GET /v1/models (key validation)."""
    name = "cohere"
    key = _provider_secret("cohere")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.cohere.cohere_client import CohereClient
        client = CohereClient(api_key=key)
        models = client.list_models()
        if models:
            result["available"] = True
            result["models"] = models[:_MAX_MODELS]
        else:
            result["error"] = "Key invalid or models endpoint unreachable"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_nvidia() -> Dict[str, Any]:
    """Probe NVIDIA NIM via its OpenAI-compatible /models endpoint."""
    name = "nvidia"
    key = _provider_secret("nvidia")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.nvidia.nvidia_client import NVIDIAClient
        client = NVIDIAClient(api_key=key)
        models = client.list_models()
        if models:
            result["available"] = True
            result["models"] = models[:_MAX_MODELS]
        else:
            result["error"] = "No models returned"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_huggingface() -> Dict[str, Any]:
    """Probe HuggingFace via whoami-v2 (token validation, no inference spend)."""
    name = "huggingface"
    key = _provider_secret("huggingface")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.huggingface.hf_client import HuggingFaceClient
        client = HuggingFaceClient(api_key=key)
        if client.validate_token():
            result["available"] = True
            result["models"] = catalog_models(name, _MAX_MODELS)
        else:
            result["error"] = "Invalid HF token or HuggingFace unreachable"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_zhipuai() -> Dict[str, Any]:
    """Probe Zhipu AI via GET /models (key validation)."""
    name = "zhipuai"
    key = _provider_secret("zhipuai")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.zhipuai.zhipuai_client import ZhipuAIClient
        client = ZhipuAIClient(api_key=key)
        models = client.list_models()
        if models:
            result["available"] = True
            result["models"] = models[:_MAX_MODELS]
        else:
            result["error"] = "Key invalid or Zhipu API unreachable"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _blank(name: str, key: Optional[str]) -> Dict[str, Any]:
    """Build the default per-provider record (configured iff a key is present)."""
    meta = PROVIDERS.get(name, {})
    configured = is_configured(name)
    return {
        "name": name,
        "configured": configured,
        "available": False,
        "tier": meta.get("tier", "paid"),
        "limits": meta.get("limits", ""),
        "vision": meta.get("vision", False),
        "image": meta.get("image", False),
        "image_ready": bool(meta.get("image", False)) and has_image_key(name),
        "image_model": meta.get("image_model", "") if meta.get("image") else "",
        "key_masked": mask_key(key) if key else (mask_key(_provider_secret(name)) if configured else None),
        "models": [],
        "error": None if configured else "No API key configured",
        "latency_ms": None,
    }


def _finalize(result: Dict[str, Any]) -> Dict[str, Any]:
    """Attach registry metadata and catalog model fallback (single source: ai_keys)."""
    name = result.get("name", "")
    meta = PROVIDERS.get(name, {})
    result["tier"] = meta.get("tier", "paid")
    result["limits"] = meta.get("limits", "")
    result["vision"] = meta.get("vision", False)
    result["image"] = meta.get("image", False)
    result["image_ready"] = bool(meta.get("image", False)) and has_image_key(name)
    result["image_model"] = meta.get("image_model", "") if meta.get("image") else ""
    if result.get("configured") and not result.get("models"):
        result["models"] = catalog_models(name, _MAX_MODELS)
    return result


def _sort_key(p: Dict[str, Any]) -> tuple:
    """Available first, then configured-but-down, then unconfigured; registry order within."""
    name = p.get("name", "")
    order = PROVIDER_ORDER.index(name) if name in PROVIDER_ORDER else 999
    if p.get("available"):
        return (0, order)
    if p.get("configured"):
        return (1, order)
    return (2, order)


def _probe_cerebras() -> Dict[str, Any]:
    """Probe Cerebras via OpenAI-compatible /models."""
    name = "cerebras"
    key = _provider_secret("cerebras")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.cerebras.cerebras_client import CerebrasClient
        client = CerebrasClient(api_key=key, default_model=catalog_models(name)[0] if catalog_models(name) else "llama-3.3-70b")
        models = client.list_models()
        if models:
            result["available"] = True
            result["models"] = models[:_MAX_MODELS]
        else:
            result["error"] = "No models returned"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def _probe_github() -> Dict[str, Any]:
    """Probe GitHub Models via GET models.github.ai/catalog/models."""
    name = "github"
    key = _provider_secret("github")
    result = _blank(name, key)
    if not key:
        return result

    start = time.time()
    try:
        from pycore.pyutils.ai_cluster.github.github_client import GitHubModelsClient
        client = GitHubModelsClient(api_key=key)
        models = client.list_models()
        if models:
            result["available"] = True
            result["models"] = models[:_MAX_MODELS]
        else:
            result["error"] = client.last_error or "No models returned from GitHub catalog"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


# Provider probe registry (order = PROVIDER_ORDER).
_PROBE_BY_NAME = {
    "openrouter": _probe_openrouter,
    "gemini": _probe_gemini,
    "groq": _probe_groq,
    "cerebras": _probe_cerebras,
    "mistral": _probe_mistral,
    "cohere": _probe_cohere,
    "nvidia": _probe_nvidia,
    "huggingface": _probe_huggingface,
    "github": _probe_github,
    "cloudflare": lambda: probe_cloudflare(_blank, _provider_secret, _MAX_MODELS),
    "zhipuai": _probe_zhipuai,
    "deepseek": _probe_deepseek,
    "openai": _probe_openai,
    "anthropic": _probe_anthropic,
    "spark": lambda: probe_spark(_blank, _provider_secret, _MAX_MODELS),
}
for _pname in OPENAI_COMPAT_PROVIDERS:
    _PROBE_BY_NAME[_pname] = partial(probe_openai_compat, _pname, _blank, _provider_secret, _MAX_MODELS)
_PROBES = [_PROBE_BY_NAME[n] for n in PROVIDER_ORDER if n in _PROBE_BY_NAME]


def _attach_rate(result: Dict[str, Any]) -> Dict[str, Any]:
    """Attach the current local rate-limit snapshot (usage vs RPM/RPD) for the UI."""
    name = result.get("name", "")
    try:
        result["rate"] = rate_status(name).get("status")
    except Exception:
        result["rate"] = None
    return result


def catalog() -> Dict[str, Any]:
    """
    List every provider from the registry WITHOUT any network probe.

    Cheap and side-effect-free: returns configured / tier / limits / vision /
    key_masked / catalog model ids + the current rate snapshot, but NEVER calls a
    provider (no token/quota spend). The UI renders the grid from this and only
    runs a live availability test on demand (per-card "Test" / "Test all").
    """
    providers: List[Dict[str, Any]] = []
    for name in PROVIDER_ORDER:
        rec = _finalize(_blank(name, _provider_secret(name)))
        rec["tested"] = False
        _attach_rate(rec)
        providers.append(rec)
    providers.sort(key=_sort_key)
    return {"providers": providers}


def probe_one(name: str) -> Dict[str, Any]:
    """
    Run a single provider's live availability test.

    A probe is a cheap list-models *metadata* call, NOT generation, so it is
    deliberately NOT rate-gated and NOT counted against the provider's free-tier
    budget — repeatedly clicking "Test" / "Test all" can never starve real
    text/image generation (the gemini "20/20 but no image" trap). Every probe is
    still logged (kind="probe") in the shared usage log, and the record carries
    `tested: True` plus the current `rate` snapshot.
    """
    name = (name or "").strip().lower()
    fn = _PROBE_BY_NAME.get(name)
    if fn is None:
        rec = _finalize(_blank(name, _provider_secret(name)))
        rec["tested"] = True
        rec["error"] = rec.get("error") or f"Unknown provider '{name}'"
        return _attach_rate(rec)

    try:
        rec = _finalize(fn())
    except Exception as e:
        ColorPrint.yellow(f"[ai_probe] probe {name} crashed: {e}")
        rec = _finalize(_blank(name, _provider_secret(name)))
        rec["error"] = str(e)
    rec["tested"] = True
    models = rec.get("models") or []
    record_usage("probe", name, models[0] if models else "",
                 bool(rec.get("available")), rec.get("latency_ms"), "probe", rec.get("error"))
    return _attach_rate(rec)


def probe_all() -> Dict[str, Any]:
    """
    Probe every AI provider and return the unified contract (rate-aware).

    Each provider is tested independently via probe_one() (rate-gated + recorded);
    one provider failing never aborts the others. See module docstring for shape.
    """
    providers: List[Dict[str, Any]] = []
    for name in PROVIDER_ORDER:
        if name not in _PROBE_BY_NAME:
            continue
        providers.append(probe_one(name))
    providers.sort(key=_sort_key)
    return {"providers": providers}


__all__ = ["probe_all", "probe_one", "catalog", "mask_key"]
