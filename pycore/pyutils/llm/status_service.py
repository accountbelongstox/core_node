# -*- coding: utf-8 -*-
"""Shared LLM status and control service."""

import time
from typing import Any, Dict, Optional

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


def status():
    """LLM engine availability snapshot."""
    return orchestrator_status()


def test(params: Optional[Dict[str, Any]] = None):
    """Live chat test for ONE engine (or the best available)."""
    p = params or {}
    prompt = str(p.get("text") or "").strip() or "Reply with the single word: ok"
    started = time.monotonic()
    result = orchestrator_chat(
        [{"role": "user", "content": prompt}],
        engine=str(p.get("engine") or "").strip() or None,
        model=str(p.get("model") or "").strip() or None,
    )
    result["latency_ms"] = int((time.monotonic() - started) * 1000)
    result["text"] = (result.get("text") or "")[:500]
    return result


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


def post_settings(params: Optional[Dict[str, Any]] = None):
    """Update + persist managed local LLM server options."""
    req = params or {}
    server_patch: Dict[str, Any] = {}
    if req.get("llm_auto_manage") is not None:
        server_patch["llm_auto_manage"] = req["llm_auto_manage"]
    if req.get("llm_single_active") is not None:
        server_patch["llm_single_active"] = req["llm_single_active"]
    if req.get("llm_idle_shutdown_s") is not None:
        server_patch["llm_idle_shutdown_s"] = req["llm_idle_shutdown_s"]
    if req.get("llm_enabled") is not None:
        server_patch["llm_enabled"] = req["llm_enabled"]
    srv = apply_server_settings(server_patch) if server_patch else get_server_settings()
    return {
        "success": True,
        "llm_auto_manage": srv.get("llm_auto_manage"),
        "llm_single_active": srv.get("llm_single_active"),
        "llm_idle_shutdown_s": srv.get("llm_idle_shutdown_s"),
        "llm_enabled": srv.get("llm_enabled"),
    }


def post_server_action(params: Optional[Dict[str, Any]] = None):
    """Enable/disable or start/stop ONE managed local LLM server engine."""
    req = params or {}
    engine = str(req.get("engine") or "").strip().lower()
    if not is_llm_engine(engine):
        return {"success": False, "error": f"Unknown LLM engine: {req.get('engine')}"}
    try:
        if req.get("enabled") is not None:
            return set_engine_enabled(engine, bool(req["enabled"]), start_now=bool(req.get("start")))
        if req.get("start") is True:
            return start_server(engine)
        if req.get("start") is False:
            return stop_server(engine)
        return get_server_settings()
    except Exception as e:  # noqa: BLE001
        return {"success": False, "error": str(e)}
