# -*- coding: utf-8 -*-
"""
Local OpenAI-compatible chat client (Ollama / LM Studio / llama.cpp).

Backward-compatible facade over the LLM orchestrator
(pycore/pyutils/llm/llm_orchestrator.py): without an explicit ``base`` the call
walks the local engine priority chain (ollama -> lmstudio -> llamacpp, env
LLM_ENGINE_PRIORITY) with managed auto-start; an explicit ``base`` is honored
as a direct override (legacy hand-typed URL behavior). Never raises: failures
return {"success": False, "error": ...} so callers can fall back to a cloud
provider.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pycore.pyutils.llm.llm_engines import chat_completion_raw

DEFAULT_BASE = "http://127.0.0.1:11434/v1"
DEFAULT_MODEL = "qwen2.5:7b"
DEFAULT_TIMEOUT = 120


def chat_completion(
    messages: List[Dict[str, Any]],
    *,
    base: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.2,
    timeout: int = DEFAULT_TIMEOUT,
) -> Dict[str, Any]:
    """One chat completion against a local OpenAI-compatible server.

    Explicit ``base`` -> direct call to that server (override). Otherwise ->
    orchestrator priority chain with managed lifecycle; the result gains an
    ``engine`` key naming the server that answered."""
    use_base = str(base or "").strip().rstrip("/")
    if use_base:
        use_model = str(model or "").strip() or DEFAULT_MODEL
        return chat_completion_raw(
            messages, base=use_base, model=use_model,
            temperature=temperature, timeout=timeout,
        )
    # Lazy import: keeps this legacy module import-light for headless callers.
    from pycore.pyutils.llm.llm_orchestrator import chat as orchestrator_chat

    res = orchestrator_chat(messages, model=model, temperature=temperature)
    return {
        "success": bool(res.get("success")),
        "provider": "local",
        "engine": res.get("engine"),
        "model": res.get("model") or (str(model or "").strip() or DEFAULT_MODEL),
        "text": res.get("text") or "",
        "error": res.get("error"),
    }
