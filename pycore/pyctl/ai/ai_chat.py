#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified AI chat — minimal "does it actually answer?" confirmation.

Sibling of :mod:`pycore.pyctl.ai.ai_probe`. The probe only proves a key can
*list models*; this module sends a real chat message to a provider and returns
the assistant's reply, so the desktop UI can confirm a provider truly works by
clicking it and chatting.

It loads each provider's key with the SAME key-name precedence as ai_probe (so
chat uses the exact key the probe validated), instantiates the matching pyutils
client directly (never the shared singleton, to avoid a stale key), and runs one
blocking completion. Gemini has no multi-turn message API here, so the message
list is flattened into a transcript prompt.

Contract (UI depends on this shape):
    {
      "success": bool,
      "provider": str,
      "model": str,
      "nickname": str,                # provider/model display label
      "text": str,
      "latency_ms": number | None,
      "error": str | None,
      "retry_after_s": number | None  # local rate-limit backoff hint
    }
"""

import time
from functools import partial
from typing import Dict, Any, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyctl.ai.ai_keys import PROVIDERS, first_secret, default_model, OPENAI_COMPAT_PROVIDERS, is_configured
from pycore.pyctl.ai.ai_rate_limits import check_rate_limit, record_request, chat_nickname
from pycore.pyctl.ai.ai_compat_helpers import chat_openai_compat, chat_cloudflare, chat_spark
from pycore.pyctl.ai.ai_usage_log import record_usage

from pycore.pyutils.ai_cluster.openrouter.openrouter_client import OpenRouterClient
from pycore.pyutils.ai_cluster.gemini.gemini_client import GeminiClient
from pycore.pyutils.ai_cluster.deepseek.deepseek_client import get_deepseek_client
from pycore.pyutils.ai_cluster.groq.groq_client import GroqClient
from pycore.pyutils.ai_cluster.mistral.mistral_client import MistralClient
from pycore.pyutils.ai_cluster.cohere.cohere_client import CohereClient
from pycore.pyutils.ai_cluster.nvidia.nvidia_client import NVIDIAClient
from pycore.pyutils.ai_cluster.huggingface.hf_client import HuggingFaceClient
from pycore.pyutils.ai_cluster.cerebras.cerebras_client import CerebrasClient
from pycore.pyutils.ai_cluster.github.github_client import GitHubModelsClient
from pycore.pyutils.ai_cluster.zhipuai.zhipuai_client import ZhipuAIClient


_VALID_ROLES = ("system", "user", "assistant")


def _normalize_messages(messages: Optional[List[Dict[str, Any]]]) -> List[Dict[str, str]]:
    """Coerce arbitrary message dicts into clean {role, content} pairs."""
    out: List[Dict[str, str]] = []
    for m in messages or []:
        if not isinstance(m, dict):
            continue
        content = m.get("content")
        if content is None:
            continue
        role = str(m.get("role") or "user").strip().lower()
        if role not in _VALID_ROLES:
            role = "user"
        out.append({"role": role, "content": str(content)})
    return out


def _messages_to_prompt(messages: List[Dict[str, str]]) -> str:
    """Flatten a message list into a transcript prompt (for Gemini)."""
    parts: List[str] = []
    for m in messages:
        if m["role"] == "system":
            parts.append(m["content"])
        elif m["role"] == "assistant":
            parts.append(f"Assistant: {m['content']}")
        else:
            parts.append(f"User: {m['content']}")
    return "\n".join(parts).strip()


def _result(provider: str, model: str) -> Dict[str, Any]:
    return {
        "success": False,
        "provider": provider,
        "model": model,
        "nickname": chat_nickname(provider, model),
        "text": "",
        "latency_ms": None,
        "error": None,
        "retry_after_s": None,
    }


def _openrouter_first_model(key: str) -> Optional[str]:
    """Pick a currently-live OpenRouter model (prefer a free one) for no-model calls.

    OpenRouter's catalog changes, so a hardcoded default can 404. The UI always
    sends a probed model (fast path); this is only used when a caller omits one.
    """
    try:
        requests = get_third_package_requests()
        resp = requests.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        for m in data:
            mid = m.get("id", "")
            if mid == "openrouter/free":
                return mid
        for m in data:
            mid = m.get("id", "")
            if mid.endswith(":free"):
                return mid
        return data[0].get("id") if data else None
    except Exception:
        return None


def _chat_openrouter(messages, model, key, out):
    client = OpenRouterClient(api_key=key)
    if not model:
        model = _openrouter_first_model(key) or default_model("openrouter")
    out["model"] = model
    resp = client.chat_completion(messages=messages, model=model)
    if isinstance(resp, dict) and resp.get("error"):
        out["error"] = str(resp["error"])
        return out
    message = (resp.get("choices") or [{}])[0].get("message", {}) if isinstance(resp, dict) else {}
    out["text"] = client._extract_message_content(message)
    out["success"] = bool(out["text"])
    if not out["success"]:
        out["error"] = "Empty response from provider"
    return out


def _chat_gemini(messages, model, key, out):
    model = model or default_model("gemini")
    out["model"] = model
    client = GeminiClient(api_key=key, default_model=model)
    res = client.generate_content(prompt=_messages_to_prompt(messages), model=model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _chat_deepseek(messages, model, key, out):
    model = model or default_model("deepseek")
    out["model"] = model
    client = get_deepseek_client(api_key=key)
    res = client.chat_completion(messages=messages, model=model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _chat_openai(messages, model, key, out):
    """ChatGPT via the OpenAI chat-completions REST API (no SDK dependency)."""
    requests = get_third_package_requests()
    model = model or default_model("openai")
    out["model"] = model
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": model, "messages": messages},
        timeout=60,
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


def _chat_anthropic(messages, model, key, out):
    """Claude via the Anthropic Messages REST API (system goes in its own field)."""
    requests = get_third_package_requests()
    model = model or default_model("anthropic")
    out["model"] = model
    system = "\n".join(m["content"] for m in messages if m["role"] == "system") or None
    turns = [m for m in messages if m["role"] in ("user", "assistant")]
    if not turns:
        turns = [{"role": "user", "content": _messages_to_prompt(messages)}]
    body = {"model": model, "max_tokens": 1024, "messages": turns}
    if system:
        body["system"] = system
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=60,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:300]}"
        return out
    data = resp.json()
    out["text"] = "".join(
        b.get("text", "") for b in (data.get("content") or []) if b.get("type") == "text"
    )
    out["success"] = bool(out["text"])
    if not out["success"]:
        out["error"] = "Empty response from provider"
    return out


def _chat_groq(messages, model, key, out):
    """Groq via its OpenAI-compatible API."""
    model = model or default_model("groq")
    out["model"] = model
    client = GroqClient(api_key=key, default_model=model)
    res = client.chat_completion(messages=messages, model=model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _chat_mistral(messages, model, key, out):
    """Mistral AI via its chat completions API."""
    model = model or default_model("mistral")
    out["model"] = model
    client = MistralClient(api_key=key, default_model=model)
    res = client.chat_completion(messages=messages, model=model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _chat_cohere(messages, model, key, out):
    """Cohere via its chat API."""
    model = model or default_model("cohere")
    out["model"] = model
    client = CohereClient(api_key=key, default_model=model)
    res = client.chat_completion(messages=messages, model=model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _chat_nvidia(messages, model, key, out):
    """NVIDIA NIM via its OpenAI-compatible API."""
    model = model or default_model("nvidia")
    out["model"] = model
    client = NVIDIAClient(api_key=key, default_model=model)
    res = client.chat_completion(messages=messages, model=model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _chat_huggingface(messages, model, key, out):
    """HuggingFace Inference API via its client."""
    model = model or default_model("huggingface")
    out["model"] = model
    client = HuggingFaceClient(api_key=key, default_model=model)
    res = client.chat_completion(messages=messages, model=model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _chat_cerebras(messages, model, key, out):
    model = model or default_model("cerebras")
    out["model"] = model
    client = CerebrasClient(api_key=key, default_model=model)
    res = client.chat_completion(messages=messages, model=model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _chat_github(messages, model, key, out):
    model = model or default_model("github")
    out["model"] = model
    client = GitHubModelsClient(api_key=key, default_model=model)
    res = client.chat_completion(messages=messages, model=model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _chat_zhipuai(messages, model, key, out):
    """Zhipu AI (BigModel.cn) via its OpenAI-compatible API."""
    model = model or default_model("zhipuai")
    out["model"] = model
    client = ZhipuAIClient(api_key=key, default_model=model)
    res = client.chat_completion(messages=messages, model=model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


_DISPATCH = {
    "openrouter": _chat_openrouter,
    "gemini": _chat_gemini,
    "groq": _chat_groq,
    "cerebras": _chat_cerebras,
    "mistral": _chat_mistral,
    "cohere": _chat_cohere,
    "nvidia": _chat_nvidia,
    "huggingface": _chat_huggingface,
    "github": _chat_github,
    "cloudflare": chat_cloudflare,
    "spark": chat_spark,
    "zhipuai": _chat_zhipuai,
    "deepseek": _chat_deepseek,
    "openai": _chat_openai,
    "anthropic": _chat_anthropic,
}
for _pname in OPENAI_COMPAT_PROVIDERS:
    _DISPATCH[_pname] = partial(chat_openai_compat, _pname)


def chat_once(provider: str, messages: List[Dict[str, Any]], model: Optional[str] = None,
              source: str = "") -> Dict[str, Any]:
    """
    Send one chat turn to ``provider`` and return the unified contract.

    Args:
        provider: one of 'openrouter' | 'gemini' | 'deepseek'.
        messages: list of {role, content} dicts (system/user/assistant).
        model:    optional model id; falls back to the provider default.
        source:   task label recorded in the shared usage log ("chat", "compose"…).
    """
    provider = (provider or "").strip().lower()
    # Pass the caller's model through as-is (None = let the handler resolve a
    # live/default model). out["model"] is filled in by the handler.
    requested_model = (model or "").strip() or None
    out = _result(provider, requested_model or "")

    handler = _DISPATCH.get(provider)
    if handler is None:
        out["error"] = f"Unknown provider: {provider!r}"
        return out

    msgs = _normalize_messages(messages)
    if not msgs:
        out["error"] = "No message provided"
        return out

    key = first_secret(provider)
    if not is_configured(provider):
        out["error"] = "No API key configured"
        return out

    use_model = requested_model or default_model(provider)
    rate = check_rate_limit(provider, use_model)
    if not rate.allowed:
        out["error"] = rate.message
        out["retry_after_s"] = rate.retry_after_s
        out["model"] = use_model
        out["nickname"] = chat_nickname(provider, use_model)
        record_usage("text", provider, use_model, False, None, source, rate.message)
        return out

    start = time.time()
    try:
        handler(msgs, requested_model, key, out)
    except Exception as e:  # noqa: BLE001 — surface any SDK failure to the UI
        out["error"] = str(e)
        ColorPrint.yellow(f"[ai_chat] {provider} chat failed: {e}")
    if not out["model"]:
        out["model"] = default_model(provider)
    out["nickname"] = chat_nickname(provider, out["model"])
    out["latency_ms"] = round((time.time() - start) * 1000, 1)
    if out.get("success"):
        record_request(provider)
    record_usage("text", provider, out["model"], bool(out.get("success")),
                 out["latency_ms"], source, out.get("error"))
    return out


__all__ = ["chat_once"]
