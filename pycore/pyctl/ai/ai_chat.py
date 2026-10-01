# -*- coding: utf-8 -*-
"""
Unified AI chat: one real chat turn against one provider, dispatched on the
registry ``client`` kind (ai_keys.PROVIDERS). Chat uses the same rotation key
the probe validated.

Contract (UI depends on this shape):
    {success, provider, model, nickname, text, latency_ms, error,
     retry_after_s, attempted, error_code, retriable, provider_reached,
     quota_counted}
"""

import time
from typing import Any, Callable, Dict, List, Optional

from pycore.pyctl.ai.ai_keys import client_kind, compat_client, default_model, first_secret, is_configured
from pycore.pyctl.ai.ai_manifest import provider_block_reason
from pycore.pyctl.ai.ai_rate_limits import acquire_rate_limit, chat_nickname, finalize_rate_limit
from pycore.pyctl.ai.ai_usage_log import begin_call, end_call, record_usage
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.ai_cluster.anthropic.anthropic_client import AnthropicClient
from pycore.pyutils.ai_cluster.gemini.gemini_client import GeminiClient, gemini_errors
from pycore.pyutils.common.ai_request_failures import classify_ai_failure

_VALID_ROLES = ("system", "user", "assistant")
AUTO_PICK_TIMEOUT_S = 15.0
ERROR_NO_TEXT = "Empty response from provider"
ERROR_UNKNOWN_PROVIDER = "Unknown provider: {provider!r}"
ERROR_NO_MESSAGE = "No message provided"
ERROR_BLOCKED = "Provider blocked: {reason}"
ERROR_NO_KEY = "No API key configured"


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


def messages_to_prompt(messages: List[Dict[str, str]]) -> str:
    """Flatten a message list into a transcript prompt (single-prompt APIs)."""
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
        "attempted": False,
        "error_code": None,
        "retriable": False,
        "provider_reached": None,
        "quota_counted": False,
    }


def _chat_compat(provider: str, messages, model, key, out):
    client = compat_client(provider, key)
    if not model:
        listed, _error = client.list_models(AUTO_PICK_TIMEOUT_S) if client.profile.free_first else ([], None)
        model = listed[0] if listed else default_model(provider)
    out["model"] = model
    res = client.chat(messages, model)
    out["text"] = res["text"]
    out["success"] = res["success"]
    out["error"] = res["error"]
    out["provider_reached"] = res["provider_reached"]
    return out


def _chat_gemini(provider: str, messages, model, key, out):
    model = model or default_model(provider)
    out["model"] = model
    try:
        res = GeminiClient(api_key=key, default_model=model).generate_content(
            prompt=messages_to_prompt(messages), model=model,
        )
    except gemini_errors() as exc:
        ColorPrint.yellow(f"[ai_chat] gemini chat failed model={model}: {exc}")
        out["error"] = str(exc)
        return out
    out["text"] = res.get("text", "") if res.get("success") else ""
    out["success"] = bool(out["text"])
    out["error"] = None if out["success"] else (res.get("error") or ERROR_NO_TEXT)
    return out


def _chat_anthropic(provider: str, messages, model, key, out):
    model = model or default_model(provider)
    out["model"] = model
    system = "\n".join(m["content"] for m in messages if m["role"] == "system") or None
    turns = [m for m in messages if m["role"] in ("user", "assistant")]
    if not turns:
        turns = [{"role": "user", "content": messages_to_prompt(messages)}]
    res = AnthropicClient(key).messages(turns, model, system=system)
    out["text"] = res["text"]
    out["success"] = res["success"]
    out["error"] = res["error"]
    out["provider_reached"] = res["provider_reached"]
    return out


_DISPATCH: Dict[str, Callable[..., Dict[str, Any]]] = {
    "openai_compat": _chat_compat,
    "gemini": _chat_gemini,
    "anthropic": _chat_anthropic,
}


def chat_once(provider: str, messages: List[Dict[str, Any]], model: Optional[str] = None,
              source: str = "", context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Send one chat turn to ``provider`` and return the unified contract.

    Args:
        provider: a registry provider name (ai_keys.PROVIDERS).
        messages: list of {role, content} dicts (system/user/assistant).
        model:    optional model id; falls back to the provider default.
        source:   task label recorded in the shared usage log ("chat", "compose"...).
    """
    provider = (provider or "").strip().lower()
    # Pass the caller's model through as-is (None = let the handler resolve a
    # live/default model). out["model"] is filled in by the handler.
    requested_model = (model or "").strip() or None
    out = _result(provider, requested_model or "")

    handler = _DISPATCH.get(client_kind(provider))
    if handler is None:
        out["error"] = ERROR_UNKNOWN_PROVIDER.format(provider=provider)
        return out

    msgs = _normalize_messages(messages)
    if not msgs:
        out["error"] = ERROR_NO_MESSAGE
        return out

    block_reason = provider_block_reason(provider)
    if block_reason:
        out["error"] = ERROR_BLOCKED.format(reason=block_reason)
        return out

    key = first_secret(provider)
    if not is_configured(provider):
        out["error"] = ERROR_NO_KEY
        return out

    use_model = requested_model or default_model(provider)
    rate = acquire_rate_limit(provider, use_model)
    if not rate.allowed:
        out["error"] = rate.message
        out["retry_after_s"] = rate.retry_after_s
        out["model"] = use_model
        out["nickname"] = chat_nickname(provider, use_model)
        failure = classify_ai_failure(rate.message)
        out["error_code"] = failure["code"]
        out["retriable"] = failure["retriable"]
        return out

    start = time.time()
    out["attempted"] = True
    prompt_text = "\n\n".join(f"{m['role']}: {m['content']}" for m in msgs)
    call_id = begin_call({
        "kind": "text",
        "provider": provider,
        "model": use_model,
        "source": source,
        "runtime": "pycore",
    })
    try:
        handler(provider, msgs, requested_model, key, out)
    except Exception as e:  # noqa: BLE001 - provider SDK boundary: surface any failure to the UI
        out["error"] = str(e)
        ColorPrint.yellow(f"[ai_chat] {provider} chat failed: {e}")
    finally:
        end_call(call_id)
    if not out["model"]:
        out["model"] = default_model(provider)
    out["nickname"] = chat_nickname(provider, out["model"])
    out["latency_ms"] = round((time.time() - start) * 1000, 1)
    failure = classify_ai_failure(out.get("error"))
    out["error_code"] = None if out.get("success") else failure["code"]
    if getattr(out.get("error"), "params", None):
        out["error_params"] = dict(out["error"].params)
    out["retriable"] = False if out.get("success") else bool(failure["retriable"])
    reached_value = out.get("provider_reached")
    provider_reached = bool(out.get("success")) or (
        bool(failure["provider_reached"])
        if reached_value is None
        else bool(reached_value)
    )
    settlement = finalize_rate_limit(
        provider,
        rate.reservation_id,
        provider_reached,
        str(out.get("error_code") or ""),
        out.get("retry_after_s"),
    )
    out["provider_reached"] = bool(settlement.get("provider_reached"))
    out["quota_counted"] = bool(settlement.get("quota_counted"))
    if out.get("retriable"):
        out["retry_after_s"] = max(
            float(out.get("retry_after_s") or 0.0),
            float(settlement.get("retry_after_s") or 0.0),
        )
    record_usage(
        "text",
        provider,
        out["model"],
        bool(out.get("success")),
        out["latency_ms"],
        source,
        out.get("error"),
        error_code=str(out.get("error_code") or ""),
        provider_reached=out["provider_reached"],
        quota_counted=out["quota_counted"],
        context=context,
        prompt=prompt_text,
        response=str(out.get("text") or "") or None,
    )
    return out


__all__ = ["chat_once", "messages_to_prompt"]
