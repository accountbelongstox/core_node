# -*- coding: utf-8 -*-
"""Agent History workflows exposed to the Pycore UI."""

import base64
from typing import Any, Dict

import pycore.pyutils.agent_history.article_records as article_record_store
import pycore.pyctl.agent_history.agent_history_txt as agent_history_txt
from pycore.pyctl.agent_history.agent_history_service import agent_history_service
from pycore.pyctl.agent_history.heartbeat import set_agent_history_callbacks_enabled
from pycore.pyctl.agent_history.pipeline.config import (
    get_config,
    get_status as get_pipeline_status,
    list_articles,
    save_config,
)
from pycore.pyctl.agent_history.pipeline.worker import start_backfill
from pycore.pyctl.agent_history.tick_service import agent_history_tick_service


def index(_params: Any, _request_id: str) -> Dict[str, Any]:
    return {"success": True, "data": agent_history_service.read_index()}

def prompts(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    limit = int(request.get("limit") or 50)
    offset = int(request.get("offset") or 0)
    page = int(request.get("page") or 0)
    page_size = int(request.get("pageSize") or 0)
    raw_tools = request.get("tools") or []
    tools = [str(item) for item in raw_tools] if isinstance(raw_tools, list) else []
    if page > 0:
        limit = page_size if page_size > 0 else limit
        offset = (page - 1) * max(1, limit)
    data = agent_history_service.read_prompts(
        request.get("tool") or None,
        request.get("user") or None,
        limit,
        offset,
        request.get("q") or None,
        request.get("lang") or None,
        tools,
    )
    return {"success": True, "data": data}

def session_detail(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    session_id = str(request.get("session_id") or request.get("id") or "")
    if not session_id:
        return {"success": False, "error": "missing session_id"}
    detail = agent_history_txt.read_session(session_id)
    if detail is None:
        return {"success": False, "error": "not found"}
    return {"success": True, "data": detail}

def refresh(_params: Any, _request_id: str) -> Dict[str, Any]:
    return {"success": True, "data": agent_history_service.extract(force=True)}

def update_prompt(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    prompt_id = str(request.get("id") or "")
    if not prompt_id:
        return {"success": False, "error": "missing id"}
    result = agent_history_service.update_prompt(
        prompt_id,
        str(request.get("text") or ""),
    )
    if result is None:
        return {"success": False, "error": "invalid id"}
    return {"success": True, "data": result}

def status(_params: Any, _request_id: str) -> Dict[str, Any]:
    return {
        "success": True,
        "data": {
            "tick": agent_history_tick_service.get_status_snapshot(),
            "store": agent_history_service.get_status(),
            "article": get_pipeline_status(),
        },
    }

def article_config_get(_params: Any, _request_id: str) -> Dict[str, Any]:
    return {"success": True, "data": get_config()}

def article_config_post(params: Any, request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    config = save_config(request)
    pipeline_enabled = bool(config.get("enabled"))
    extraction_enabled = pipeline_enabled or bool(config.get("enabled_tools"))
    set_agent_history_callbacks_enabled(pipeline_enabled, extraction_enabled)
    return {
        "success": True,
        "data": config,
        "operation_id": f"op_config_{request_id}",
    }

def article_start(_params: Any, request_id: str) -> Dict[str, Any]:
    set_agent_history_callbacks_enabled(True, True)
    return {
        "success": True,
        "data": start_backfill(),
        "operation_id": f"op_start_{request_id}",
    }

def article_list(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    items = list_articles(int(request.get("limit") or 50))
    return {"success": True, "data": {"items": items}}

def article_logs(_params: Any, _request_id: str) -> Dict[str, Any]:
    return {
        "success": True,
        "data": {"events": [], "progress": {}, "ai_usage": {}, "tick": {}},
    }

def article_records(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    rows = article_record_store.list_records(int(request.get("limit") or 100))
    return {"success": True, "data": {"records": rows}}

def article_audio(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    record_id = str(request.get("record_id") or request.get("id") or "")
    if not record_id:
        return {"success": False, "error": "missing record_id"}
    audio = article_record_store.read_audio(record_id)
    if audio is None:
        return {"success": False, "error": "not found"}
    return {
        "success": True,
        "data": {
            "record_id": record_id,
            "mime": "audio/mpeg",
            "audio_base64": base64.b64encode(audio).decode("ascii"),
        },
    }

def test_extract(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    tool = str(request.get("tool") or "")
    if not tool:
        return {"success": False, "error": "missing tool"}
    return {"success": True, "data": agent_history_service.test_extract(tool)}


__all__ = ["index", "prompts", "session_detail", "refresh", "update_prompt", "status", "article_config_get", "article_config_post", "article_start", "article_list", "article_logs", "article_records", "article_audio", "test_extract"]
