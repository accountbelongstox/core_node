# -*- coding: utf-8 -*-
"""Agent History store, scan, prompt feed and probe routes for the Pycore UI."""

from typing import Any, Dict

import pycore.pyctl.agent_history.agent_history_txt as agent_history_txt
from pycore.pyctl.agent_history.agent_history_store import agent_history_store
from pycore.pyctl.agent_history.extract_probe import extract_probe
from pycore.pyctl.agent_history.prompt_records import FEED_DERIVED, FEED_REWRITTEN, prompt_records
from pycore.pyctl.agent_history.snapshot_cache import agent_history_snapshot_cache
from pycore.pyctl.agent_history.tick_service import agent_history_tick_service
from pycore.pyctl.agent_history.ui_requests import id_list
from pycore.pyutils.common.status_snapshot_cache import status_snapshot_cache


def index(_params: Any, _request_id: str) -> Dict[str, Any]:
    return {"success": True, "data": agent_history_store.read_index()}

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
    data = agent_history_store.read_prompts(
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


def _id_page_args(request: Dict[str, Any]) -> Dict[str, Any]:
    raw_tools = request.get("tools") or []
    return {
        "tool": request.get("tool") or None,
        "user": request.get("user") or None,
        "q": request.get("q") or None,
        "tools": [str(item) for item in raw_tools] if isinstance(raw_tools, list) else [],
        "page": int(request.get("page") or 1),
        "page_size": int(request.get("page_size") or request.get("pageSize") or 50),
        "since_revision": str(request.get("since_revision") or request.get("sinceRevision") or ""),
    }


def session_id_pages(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    args = _id_page_args(request)
    data = agent_history_store.read_session_id_pages(
        args["tool"], args["user"], args["q"], args["page"], args["page_size"], args["since_revision"],
    )
    return {"success": True, "data": data}


def session_page(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    return {"success": True, "data": agent_history_store.read_session_page(id_list(request))}


def prompt_id_pages(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    args = _id_page_args(request)
    data = agent_history_store.read_prompt_id_pages(
        args["tool"], args["user"], args["q"], args["tools"], args["page"], args["page_size"], args["since_revision"],
    )
    return {"success": True, "data": data}


def prompt_page(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    return {"success": True, "data": agent_history_store.read_prompt_page(id_list(request))}

def refresh(_params: Any, _request_id: str) -> Dict[str, Any]:
    """Manual rescan: force-extract all agents + drop every cached snapshot."""
    invalidated = invalidate_agent_history_caches()
    result = agent_history_tick_service.request_extract(force=True)
    return {"success": True, "data": {**result, "cache_invalidated": invalidated}}


def invalidate_agent_history_caches() -> bool:
    """Drop pycore-side read caches so the next reads reparse from disk."""
    agent_history_snapshot_cache.invalidate_prefix("agent_history.")
    status_snapshot_cache.invalidate_prefix("agent_history.")
    return True


def live_scan(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    raw_tools = request.get("tools") or []
    tools = [str(item) for item in raw_tools] if isinstance(raw_tools, list) else []
    # `enabled` persists the live_prompt_monitor switch; every poll renews the
    # UI presence lease; `release` (page unmount) ends presence immediately.
    enabled = request.get("enabled")
    if enabled is not None:
        enabled = bool(enabled)
    data = agent_history_tick_service.request_live_scan(
        tools,
        enabled=enabled,
        release=bool(request.get("release")),
    )
    return {"success": True, "data": data}


def _feed_page_args(params: Any) -> Dict[str, int]:
    request = params if isinstance(params, dict) else {}
    return {
        "page": int(request.get("page") or 1),
        "page_size": int(request.get("page_size") or request.get("pageSize") or 50),
    }


def prompt_cache(params: Any, _request_id: str) -> Dict[str, Any]:
    """Paginated read over the ``new`` prompt record feed (written only
    during extraction, never read back by it)."""
    request = params if isinstance(params, dict) else {}
    tool = str(request.get("tool") or "").strip().lower() or None
    return {"success": True, "data": prompt_records.new_page(tool, **_feed_page_args(params))}


def prompt_derived(params: Any, _request_id: str) -> Dict[str, Any]:
    """Paginated read over the Linux AI-derived English prompt feed."""
    return {"success": True, "data": prompt_records.transformed_page(FEED_DERIVED, **_feed_page_args(params))}


def prompt_rewritten(params: Any, _request_id: str) -> Dict[str, Any]:
    """Paginated read over the AI-rewritten English prompt feed."""
    return {"success": True, "data": prompt_records.transformed_page(FEED_REWRITTEN, **_feed_page_args(params))}


def update_prompt(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    prompt_id = str(request.get("id") or "")
    if not prompt_id:
        return {"success": False, "error": "missing id"}
    result = agent_history_store.update_prompt(
        prompt_id,
        str(request.get("text") or ""),
    )
    if result is None:
        return {"success": False, "error": "invalid id"}
    return {"success": True, "data": result}

def test_extract(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    tool = str(request.get("tool") or "")
    if not tool:
        return {"success": False, "error": "missing tool"}
    return {"success": True, "data": extract_probe.test_extract(tool)}


__all__ = [
    "index",
    "invalidate_agent_history_caches",
    "live_scan",
    "prompt_cache",
    "prompt_derived",
    "prompt_id_pages",
    "prompt_page",
    "prompt_rewritten",
    "prompts",
    "refresh",
    "session_detail",
    "session_id_pages",
    "session_page",
    "test_extract",
    "update_prompt",
]
