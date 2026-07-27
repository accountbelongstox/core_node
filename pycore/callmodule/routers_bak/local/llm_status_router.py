# -*- coding: utf-8 -*-
"""
LLM status router.

Endpoints (prefix /api/local/llm):
  GET  /status   -> multi-engine orchestrator priority/availability snapshot.
  POST /test     -> live one-line chat round-trip for ONE engine (or best).
  GET  /settings -> managed local LLM server options.
  POST /settings -> persist managed local LLM server options.
  POST /server   -> enable/disable or start/stop ONE local LLM server engine.

Mirrors tts_status_router.py: the orchestrator owns priority, managed_services
owns lifecycle (auto_manage / single_active / idle shutdown), this router only
reads status and persists `llm_*` settings.
"""

import time

import fastapi
from typing import Any, Dict, Optional
from pydantic import BaseModel

from pycore.pyutils.llm.llm_orchestrator import chat as orchestrator_chat
from pycore.pyutils.llm.llm_orchestrator import llm_status as orchestrator_status
from pycore.pyutils.llm.llm_service_manager import (
    apply_server_settings,
    get_server_settings,
    is_llm_engine,
    set_engine_enabled,
    start_server,
    stop_server,
)

router = fastapi.APIRouter(prefix="/api/local/llm", tags=["Local Processing - LLM"])


@router.get("/status")
def status():
    """
    LLM status: the multi-engine orchestrator's priority/availability
    (ollama -> lmstudio -> llamacpp) with per-engine base_url/default_model
    and managed server runtime state.

    Returns:
        { success, best, active, available_count,
          engines: [ {name, priority, available, installed, note, base_url,
                      default_model, server_engine, server_running, ...} ] }
    """
    return orchestrator_status()


class _LlmTestReq(BaseModel):
    engine: Optional[str] = None
    model: Optional[str] = None
    text: Optional[str] = None


@router.post("/test")
def test(req: _LlmTestReq):
    """Live chat test for ONE engine (or the best available): actually runs a
    one-line chat round-trip and reports {success, engine, model, latency_ms,
    text, error}."""
    prompt = (req.text or "").strip() or "Reply with the single word: ok"
    started = time.monotonic()
    result = orchestrator_chat(
        [{"role": "user", "content": prompt}],
        engine=(req.engine or "").strip() or None,
        model=(req.model or "").strip() or None,
    )
    result["latency_ms"] = int((time.monotonic() - started) * 1000)
    result["text"] = (result.get("text") or "")[:500]
    return result


class _LlmSettingsPatch(BaseModel):
    llm_auto_manage: Optional[bool] = None
    llm_single_active: Optional[bool] = None
    llm_idle_shutdown_s: Optional[int] = None
    llm_enabled: Optional[Dict[str, bool]] = None


class _LlmServerAction(BaseModel):
    engine: str
    enabled: Optional[bool] = None
    start: Optional[bool] = None


@router.get("/settings")
def get_settings():
    """Current managed local LLM server options."""
    srv = get_server_settings()
    return {
        "success": True,
        "llm_auto_manage": srv.get("llm_auto_manage"),
        "llm_single_active": srv.get("llm_single_active"),
        "llm_idle_shutdown_s": srv.get("llm_idle_shutdown_s"),
        "llm_enabled": srv.get("llm_enabled"),
    }


@router.post("/settings")
def post_settings(req: _LlmSettingsPatch):
    """Update + persist managed local LLM server options."""
    server_patch: Dict[str, Any] = {}
    if req.llm_auto_manage is not None:
        server_patch["llm_auto_manage"] = req.llm_auto_manage
    if req.llm_single_active is not None:
        server_patch["llm_single_active"] = req.llm_single_active
    if req.llm_idle_shutdown_s is not None:
        server_patch["llm_idle_shutdown_s"] = req.llm_idle_shutdown_s
    if req.llm_enabled is not None:
        server_patch["llm_enabled"] = req.llm_enabled
    srv = apply_server_settings(server_patch) if server_patch else get_server_settings()
    return {
        "success": True,
        "llm_auto_manage": srv.get("llm_auto_manage"),
        "llm_single_active": srv.get("llm_single_active"),
        "llm_idle_shutdown_s": srv.get("llm_idle_shutdown_s"),
        "llm_enabled": srv.get("llm_enabled"),
    }


@router.post("/server")
def post_server_action(req: _LlmServerAction):
    """Enable/disable or start/stop ONE managed local LLM server engine.
    Only ollama has a managed start command; lmstudio/llamacpp are external
    servers (start them manually) and only honor enable/disable + stop."""
    engine = (req.engine or "").strip().lower()
    if not is_llm_engine(engine):
        return {"success": False, "error": f"Unknown LLM engine: {req.engine}"}
    try:
        if req.enabled is not None:
            return set_engine_enabled(engine, bool(req.enabled), start_now=bool(req.start))
        if req.start is True:
            return start_server(engine)
        if req.start is False:
            return stop_server(engine)
        return get_server_settings()
    except Exception as e:  # noqa: BLE001
        return {"success": False, "error": str(e)}
