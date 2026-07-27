# -*- coding: utf-8 -*-
"""
Agent history HTTP router — LEGACY / bak only.

The live UI path is native RPC v2:
  front-end callRpc(ui.agent_history.*)
  → local_agent_history_routes.py
  → AgentHistory services

Do not re-register this router on the RPC v2 FastAPI app for the manager UI.
Kept for compatibility / reference only (routers_bak).
"""

from __future__ import annotations

from typing import Optional

import fastapi

from pycore.pyheartbeat import get_heartbeat_system
from pycore.pyctl.agent_history.agent_history_service import get_agent_history_service
import pycore.callmodule.services.agent_history_article_records as records
from pycore.callmodule.services.agent_history_tick_service import get_agent_history_tick_service
from pycore.callmodule.services.agent_history_article_service import get_agent_history_article_service

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
    article = get_agent_history_article_service()
    return {
        "success": True,
        "data": {
            "tick": tick.get_status(),
            "store": svc.get_status(),
            "article": article.get_status(),
        },
    }


@router.get("/article/config")
def article_config_get():
    svc = get_agent_history_article_service()
    return {"success": True, "data": svc.get_config()}


@router.post("/article/config")
def article_config_post(body: dict):
    svc = get_agent_history_article_service()
    cfg = svc.save_config(body or {})
    if cfg.get("enabled"):
        get_heartbeat_system().enable_callback("agent_history_extraction")
    else:
        get_heartbeat_system().disable_callback("agent_history_extraction")
    # No inline extract here: AgentHistoryTickService already extracts every
    # heartbeat (~10s), so enabling the toggle returns immediately instead of
    # blocking the request on a full user-dir scan.
    return {"success": True, "data": cfg}


@router.post("/article/start")
def article_start():
    svc = get_agent_history_article_service()
    get_heartbeat_system().enable_callback("agent_history_extraction")
    return {"success": True, "data": svc.start_backfill()}


@router.get("/articles")
def article_list(limit: int = 50):
    svc = get_agent_history_article_service()
    return {"success": True, "data": {"items": svc.list_articles(limit=limit)}}


@router.get("/article/logs")
def article_logs():
    svc = get_agent_history_article_service()
    data = svc.get_logs()
    data["tick"] = get_agent_history_tick_service().get_status()
    return {"success": True, "data": data}


@router.get("/article/records")
def article_records(limit: int = 100):
    """Cached article records (newest first) with audio/upload flags."""
    return {"success": True, "data": {"records": records.list_records(limit=limit)}}


@router.get("/article/audio/{record_id}")
def article_audio(record_id: str):
    """Stream the cached TTS mp3 for one record (id validated against the index)."""
    path = records.audio_path(record_id)
    if path is None:
        return fastapi.responses.JSONResponse({"success": False, "error": "not found"}, status_code=404)
    return fastapi.responses.FileResponse(str(path), media_type="audio/mpeg")
