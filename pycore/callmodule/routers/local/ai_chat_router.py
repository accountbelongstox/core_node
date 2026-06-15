# -*- coding: utf-8 -*-
"""
AI chat router — the HTTP face of the unified AI gateway.

Endpoints (prefix /api/local/ai):
  POST /chat     -> explicit provider: chat_once(); provider omitted or "auto":
                    gateway generate_text() (smart dispatch + fallback)
  GET  /gateway  -> gateway_status(): per-provider tier / quota / usage /
                    cooldown + the recent task records (which AI handled what)

This complements /probe (which only lists models). Endpoints are plain ``def``
so FastAPI runs the blocking provider SDK calls in its threadpool instead of
the event loop. The returned JSON matches the unified contract in
pycore.pyctl.ai (UI depends on it).
"""

from typing import List, Optional

import fastapi
from pydantic import BaseModel

from pycore.pyctl.ai import chat_once, generate_text, gateway_status
from pycore.pyctl.ai.ai_rate_limits import rate_status
from pycore.pyctl.ai.ai_usage_log import usage_log

router = fastapi.APIRouter(prefix="/api/local/ai", tags=["Local Processing - AI"])


class ChatMessage(BaseModel):
    role: str = "user"
    content: str


class ChatRequest(BaseModel):
    # Omitted / "auto" -> the gateway picks a provider (smart dispatch).
    provider: Optional[str] = None
    # Either a single `message` (convenience) or a full `messages` history.
    message: Optional[str] = None
    messages: Optional[List[ChatMessage]] = None
    model: Optional[str] = None
    # Optional task label shown in the gateway records ("compose", "explain"…).
    source: Optional[str] = None


@router.post("/chat")
def chat(req: ChatRequest):
    """
    Send one chat turn to an AI provider and return its reply.

    Body: { provider?, message? | messages?, model?, source? }
    provider omitted or "auto" -> gateway smart dispatch with fallback.
    Returns the unified contract: { success, provider, model, text, latency_ms, error }.
    """
    msgs = (
        [{"role": m.role, "content": m.content} for m in req.messages]
        if req.messages
        else []
    )
    if not msgs and req.message:
        msgs = [{"role": "user", "content": req.message}]

    provider = (req.provider or "").strip().lower()
    if not provider or provider == "auto":
        return generate_text(messages=msgs, model=req.model, source=req.source or "chat")
    return chat_once(provider, msgs, req.model, source=req.source or "chat")


@router.get("/gateway")
def gateway():
    """
    Gateway snapshot for the UI: per-provider tier (free/balance/paid), quota
    (OpenRouter key usage, DeepSeek balance, static notes elsewhere), usage
    counters, cooldown seconds, and the recent per-task records.
    """
    return gateway_status()


@router.get("/rate-limits")
def rate_limits(provider: Optional[str] = None):
    """Local RPM/RPD usage vs encoded free-tier limits (persisted in user data dir)."""
    return rate_status(provider)


@router.get("/usage")
def usage(limit: int = 100, kind: Optional[str] = None):
    """
    Shared cross-runtime AI USAGE log — text / vision / probe records (newest
    first) plus a per-provider/kind rollup. The SAME store the Laravel side
    writes (<core_node>/.ai_state/ai_usage_records.json), so this shows what BOTH
    runtimes ran. Image generations live in the image history (/image/history).
    """
    return usage_log(limit, kind)
