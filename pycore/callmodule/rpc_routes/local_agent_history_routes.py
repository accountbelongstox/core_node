# -*- coding: utf-8 -*-
"""
Native RPC v2 routes for Agent History (sessions, prompts, article pipeline).

Front-end calls these via callRpc(PYCORE_RPC_ROUTES.agentHistory*) — no
pycore.router.invoke / FastAPI HTTP bridge required.
"""

from __future__ import annotations

import asyncio
import base64
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.agent_history.agent_history_service import get_agent_history_service
import pycore.callmodule.services.agent_history_article_records as records
from pycore.callmodule.services.agent_history_tick_service import get_agent_history_tick_service
from pycore.callmodule.services.agent_history_pipeline.config import get_config, save_config, get_status as get_pipeline_status, list_articles
from pycore.callmodule.services.agent_history_pipeline.worker import start_backfill, recover_nonterminal_operations
from pycore.callmodule.services.heartbeat_agent_history import set_agent_history_callbacks_enabled
from pycore.callmodule.rpc_routes.route_names import (
    UI_AGENT_HISTORY_INDEX,
    UI_AGENT_HISTORY_PROMPTS,
    UI_AGENT_HISTORY_SESSION_DETAIL,
    UI_AGENT_HISTORY_REFRESH,
    UI_AGENT_HISTORY_UPDATE_PROMPT,
    UI_AGENT_HISTORY_STATUS,
    UI_AGENT_HISTORY_ARTICLE_CONFIG_GET,
    UI_AGENT_HISTORY_ARTICLE_CONFIG_POST,
    UI_AGENT_HISTORY_ARTICLE_START,
    UI_AGENT_HISTORY_ARTICLE_LIST,
    UI_AGENT_HISTORY_ARTICLE_LOGS,
    UI_AGENT_HISTORY_ARTICLE_RECORDS,
    UI_AGENT_HISTORY_ARTICLE_AUDIO,
    UI_AGENT_HISTORY_TEST_EXTRACT,
)


def _params(raw: Any) -> Dict[str, Any]:
    return raw if isinstance(raw, dict) else {}


async def _run(fn, *args, **kwargs):
    """Run a blocking service call off the uvicorn event loop."""
    if kwargs:
        return await asyncio.to_thread(lambda: fn(*args, **kwargs))
    return await asyncio.to_thread(fn, *args)


def register_local_agent_history_routes(server):
    """Register WS RPC handlers."""
    try:
        recover_nonterminal_operations()
    except Exception as exc:
        ColorPrint.yellow(f"[AgentHistory] recovery skipped: {exc}")

    async def index_handler(params, request_id, context):
        data = await _run(get_agent_history_service().read_index)
        return {"success": True, "data": data}

    server.route(name=UI_AGENT_HISTORY_INDEX, handler=index_handler, sync=False)

    async def prompts_handler(params, request_id, context):
        p = _params(params)
        tool = p.get("tool") or None
        user = p.get("user") or None
        q = p.get("q") or None
        lang = p.get("lang") or None
        limit = int(p.get("limit") or 50)
        offset = int(p.get("offset") or 0)
        page = int(p.get("page") or 0)
        page_size = int(p.get("pageSize") or 0)
        if page > 0:
            lim = page_size if page_size > 0 else limit
            offset = (page - 1) * max(1, lim)
            limit = lim
        data = await _run(
            get_agent_history_service().read_prompts,
            tool, user, limit, offset, q, lang,
        )
        return {"success": True, "data": data}

    server.route(name=UI_AGENT_HISTORY_PROMPTS, handler=prompts_handler, sync=False)

    async def session_detail_handler(params, request_id, context):
        p = _params(params)
        session_id = str(p.get("session_id") or p.get("id") or "")
        if not session_id:
            return {"success": False, "error": "missing session_id"}
        detail = await _run(get_agent_history_service().read_session, session_id)
        if detail is None:
            return {"success": False, "error": "not found"}
        return {"success": True, "data": detail}

    server.route(name=UI_AGENT_HISTORY_SESSION_DETAIL, handler=session_detail_handler, sync=False)

    async def refresh_handler(params, request_id, context):
        # Force a real extraction pass; return sessions/prompts/changed counts.
        result = await _run(lambda: get_agent_history_service().extract(force=True))
        return {"success": True, "data": result}

    server.route(name=UI_AGENT_HISTORY_REFRESH, handler=refresh_handler, sync=False)

    async def update_prompt_handler(params, request_id, context):
        p = _params(params)
        prompt_id = str(p.get("id") or "")
        text = str(p.get("text") or "")
        if not prompt_id:
            return {"success": False, "error": "missing id"}
        result = await _run(get_agent_history_service().update_prompt, prompt_id, text)
        if result is None:
            return {"success": False, "error": "invalid id"}
        return {"success": True, "data": result}

    server.route(name=UI_AGENT_HISTORY_UPDATE_PROMPT, handler=update_prompt_handler, sync=False)

    async def status_handler(params, request_id, context):
        tick = await _run(get_agent_history_tick_service().get_status_snapshot)
        store = await _run(get_agent_history_service().get_status)
        article = await _run(get_pipeline_status)
        return {
            "success": True,
            "data": {"tick": tick, "store": store, "article": article},
        }

    server.route(name=UI_AGENT_HISTORY_STATUS, handler=status_handler, sync=False)

    async def article_config_get_handler(params, request_id, context):
        cfg = await _run(get_config)
        return {"success": True, "data": cfg}

    server.route(name=UI_AGENT_HISTORY_ARTICLE_CONFIG_GET, handler=article_config_get_handler, sync=False)

    async def article_config_post_handler(params, request_id, context):
        p = _params(params)
        cfg = await _run(save_config, p)
        pipeline_on = bool(cfg.get("enabled"))
        # Extraction keeps running when tools are checked even if the
        # pipeline toggle is off, so prompt history stays fresh.
        extract_on = pipeline_on or bool(cfg.get("enabled_tools"))
        await _run(set_agent_history_callbacks_enabled, pipeline_on, extract_on)
        return {"success": True, "data": cfg, "operation_id": f"op_config_{request_id}"}

    server.route(name=UI_AGENT_HISTORY_ARTICLE_CONFIG_POST, handler=article_config_post_handler, sync=False)

    async def article_start_handler(params, request_id, context):
        await _run(set_agent_history_callbacks_enabled, True, True)
        data = await _run(start_backfill)
        return {"success": True, "data": data, "operation_id": f"op_start_{request_id}"}

    server.route(name=UI_AGENT_HISTORY_ARTICLE_START, handler=article_start_handler, sync=False)

    async def article_list_handler(params, request_id, context):
        p = _params(params)
        limit = int(p.get("limit") or 50)
        items = await _run(list_articles, limit)
        return {"success": True, "data": {"items": items}}

    server.route(name=UI_AGENT_HISTORY_ARTICLE_LIST, handler=article_list_handler, sync=False)

    async def article_logs_handler(params, request_id, context):
        # Deprecated: UI should use ui.operation.snapshot instead
        return {"success": True, "data": {"events": [], "progress": {}, "ai_usage": {}, "tick": {}}}

    server.route(name=UI_AGENT_HISTORY_ARTICLE_LOGS, handler=article_logs_handler, sync=False)

    async def article_records_handler(params, request_id, context):
        p = _params(params)
        limit = int(p.get("limit") or 100)
        rows = await _run(records.list_records, limit)
        return {"success": True, "data": {"records": rows}}

    server.route(name=UI_AGENT_HISTORY_ARTICLE_RECORDS, handler=article_records_handler, sync=False)

    async def article_audio_handler(params, request_id, context):
        p = _params(params)
        record_id = str(p.get("record_id") or p.get("id") or "")
        if not record_id:
            return {"success": False, "error": "missing record_id"}
        audio = await _run(records.read_audio, record_id)
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

    server.route(name=UI_AGENT_HISTORY_ARTICLE_AUDIO, handler=article_audio_handler, sync=False)

    async def test_extract_handler(params, request_id, context):
        p = _params(params)
        tool = str(p.get("tool") or "")
        if not tool:
            return {"success": False, "error": "missing tool"}
        data = await _run(get_agent_history_service().test_extract, tool)
        return {"success": True, "data": data}

    server.route(name=UI_AGENT_HISTORY_TEST_EXTRACT, handler=test_extract_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered agent_history RPC routes")


__all__ = ["register_local_agent_history_routes"]
