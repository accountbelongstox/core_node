# -*- coding: utf-8 -*-
"""
Agent history router — local AI session/prompt extraction (no auth required).

Mirrors Laravel ``/api/dev-history/*`` but reads the pycore txt store under
``<core_node>/.data/.ai_state/agent_history/``. The heartbeat tick keeps it fresh.

Endpoints (prefix /api/local/agent-history):
  GET  /index
  GET  /prompts
  GET  /sessions/{id}
  POST /refresh
  POST /prompts/update
  GET  /status
"""

from __future__ import annotations

from typing import Optional

import fastapi

from pycore.pyctl.agent_history import get_agent_history_service
from pycore.callmodule.services.agent_history_tick_service import get_agent_history_tick_service

router = fastapi.APIRouter(prefix="/api/local/agent-history", tags=["Local Processing - Agent History"])


@router.get("/index")
def index():
    svc = get_agent_history_service()
    return {"success": True, "data": svc.read_index()}


@router.get("/prompts")
def prompts(
    tool: Optional[str] = None,
    user: Optional[str] = None,
    q: Optional[str] = None,
    lang: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    page: int = 0,
    pageSize: int = 0,
):
    svc = get_agent_history_service()
    if page > 0:
        lim = pageSize if pageSize > 0 else limit
        offset = (page - 1) * max(1, lim)
        limit = lim
    data = svc.read_prompts(tool, user, limit, offset, q, lang)
    return {"success": True, "data": data}


@router.get("/sessions/{session_id}")
def session_detail(session_id: str):
    svc = get_agent_history_service()
    detail = svc.read_session(session_id)
    if detail is None:
        return fastapi.responses.JSONResponse({"success": False, "error": "not found"}, status_code=404)
    return {"success": True, "data": detail}


@router.post("/refresh")
def refresh():
    svc = get_agent_history_service()
    result = svc.extract(force=True)
    return {"success": True, "data": result}


@router.post("/prompts/update")
def update_prompt(body: dict):
    prompt_id = str(body.get("id") or "")
    text = str(body.get("text") or "")
    if not prompt_id:
        return fastapi.responses.JSONResponse({"success": False, "error": "missing id"}, status_code=422)
    svc = get_agent_history_service()
    result = svc.update_prompt(prompt_id, text)
    if result is None:
        return fastapi.responses.JSONResponse({"success": False, "error": "invalid id"}, status_code=422)
    return {"success": True, "data": result}


@router.get("/status")
def status():
    tick = get_agent_history_tick_service()
    svc = get_agent_history_service()
    return {"success": True, "data": {"tick": tick.get_status(), "store": svc.get_status()}}
