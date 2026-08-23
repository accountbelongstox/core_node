# -*- coding: utf-8 -*-
"""Agent History workflows exposed to the Pycore UI."""

import base64
from datetime import datetime, timezone
from typing import Any, Dict, List

import pycore.pyutils.agent_history.article_records as article_record_store
import pycore.pyctl.agent_history.agent_history_txt as agent_history_txt
from pycore.pyctl.agent_history.agent_history_service import agent_history_service
from pycore.pyctl.agent_history.heartbeat import set_agent_history_callbacks_enabled
from pycore.pyctl.agent_history.pipeline.config import (
    SUPPORTED_TOOLS,
    get_config,
    get_tool_backfill_target,
    get_tool_cursor,
    get_tool_live_cursor,
    get_status as get_pipeline_status,
    list_articles,
    save_config,
)
from pycore.pyctl.agent_history.pipeline import audio_rebuild
from pycore.pyctl.agent_history.tick_service import agent_history_tick_service
from pycore.pyctl.ai.ai_rate_limits import rate_status
from pycore.pyctl.ai.ai_usage_log import usage_log, usage_revision
from pycore.pyutils.common.operation_service import operation_service
from pycore.pyutils.common.status_snapshot_cache import status_snapshot_cache
from pycore.pyutils.common.usage_rollup import usage_rollup
from pycore.pyutils.common.ai_request_failures import classify_ai_failure
import pycore.pyutils.tts.qwen.engine as qwen_engine


_AI_USAGE_SOURCES = {"agent_history_article", "agent_history_translate"}
_AI_USAGE_CACHE_KEY = "agent_history.ai_usage_dashboard"
_AI_USAGE_RETAINED_LIMIT = 5000
_AI_USAGE_VISIBLE_LIMIT = 400
_QWEN_RUNTIME_CACHE_KEY = "tts.engine.qwen3tts.agent_history_runtime"
_QWEN_RUNTIME_CACHE_SECONDS = 1.0


def _decorate_ai_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    row = dict(entry)
    failure = classify_ai_failure(row.get("error"))
    provider_reached = row.get("provider_reached")
    if provider_reached is None:
        provider_reached = bool(row.get("success")) or bool(failure["provider_reached"])
    quota_counted = row.get("quota_counted")
    if quota_counted is None:
        quota_counted = provider_reached
    row["error_code"] = row.get("error_code") or (None if row.get("success") else failure["code"])
    row["retriable"] = False if row.get("success") else bool(failure["retriable"])
    row["provider_reached"] = bool(provider_reached)
    row["quota_counted"] = bool(quota_counted)
    return row


def _ai_entry_summary(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    failures: Dict[str, Dict[str, Any]] = {}
    provider_reached = 0
    quota_counted = 0
    for entry in entries:
        provider_reached += int(bool(entry.get("provider_reached")))
        quota_counted += int(bool(entry.get("quota_counted")))
        if entry.get("success"):
            continue
        code = str(entry.get("error_code") or "unknown")
        group = failures.setdefault(
            code,
            {
                "code": code,
                "count": 0,
                "provider_reached": 0,
                "quota_counted": 0,
                "last_at": entry.get("iso"),
                "last_error": entry.get("error"),
            },
        )
        group["count"] += 1
        group["provider_reached"] += int(bool(entry.get("provider_reached")))
        group["quota_counted"] += int(bool(entry.get("quota_counted")))
    return {
        "attempts": len(entries),
        "provider_reached": provider_reached,
        "quota_counted": quota_counted,
        "pre_dispatch_failures": len(entries) - provider_reached,
        "failure_breakdown": sorted(failures.values(), key=lambda item: int(item["count"]), reverse=True),
    }


def _agent_history_ai_usage_snapshot(day: str) -> Dict[str, Any]:
    usage_data = usage_log(_AI_USAGE_RETAINED_LIMIT, "text", "openrouter", list(_AI_USAGE_SOURCES))
    entries = [_decorate_ai_entry(entry) for entry in usage_data.get("entries", [])]
    today_entries = [
        entry for entry in entries if str(entry.get("iso") or "").startswith(day)
    ]
    source_stats = usage_data.get("source_stats") or {}
    today_summary = usage_rollup.summarize(source_stats, _AI_USAGE_SOURCES, day)
    history_summary = usage_rollup.summarize(source_stats, _AI_USAGE_SOURCES)
    return {
        "usage": {
            "today": {**today_summary, **_ai_entry_summary(today_entries)},
            "history": {**history_summary, **_ai_entry_summary(entries)},
            "retained_limit": _AI_USAGE_RETAINED_LIMIT,
        },
        "tasks": entries[:_AI_USAGE_VISIBLE_LIMIT],
        "task_total": int(history_summary["requests"]),
        "today_task_total": int(today_summary["requests"]),
        "retained_task_total": len(entries),
        "retained_today_task_total": len(today_entries),
        "visible_task_limit": _AI_USAGE_VISIBLE_LIMIT,
    }


def _agent_history_ai_dashboard(config: Dict[str, Any]) -> Dict[str, Any]:
    day = datetime.now(timezone.utc).date().isoformat()
    usage_snapshot = status_snapshot_cache.get(
        _AI_USAGE_CACHE_KEY,
        lambda: _agent_history_ai_usage_snapshot(day),
        ttl_seconds=float("inf"),
        version=f"{day}:{usage_revision()}",
    )
    return {
        "provider": "openrouter",
        "model": str(config.get("openrouter_model") or "openrouter/free"),
        "day": day,
        "rate": rate_status("openrouter").get("status") or {},
        **usage_snapshot,
    }


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


def _id_list(request: Dict[str, Any]) -> Any:
    ids = request.get("ids")
    if isinstance(ids, list):
        return [str(item) for item in ids]
    return []


def session_id_pages(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    args = _id_page_args(request)
    data = agent_history_service.read_session_id_pages(
        args["tool"], args["user"], args["q"], args["page"], args["page_size"], args["since_revision"],
    )
    return {"success": True, "data": data}


def session_page(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    return {"success": True, "data": agent_history_service.read_session_page(_id_list(request))}


def prompt_id_pages(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    args = _id_page_args(request)
    data = agent_history_service.read_prompt_id_pages(
        args["tool"], args["user"], args["q"], args["tools"], args["page"], args["page_size"], args["since_revision"],
    )
    return {"success": True, "data": data}


def prompt_page(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    return {"success": True, "data": agent_history_service.read_prompt_page(_id_list(request))}

def refresh(_params: Any, _request_id: str) -> Dict[str, Any]:
    return {"success": True, "data": agent_history_tick_service.request_extract(force=True)}

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

def status(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    tool = str(request.get("tool") or "").strip().lower()
    raw_tools = request.get("tools") or []
    requested_tools = [str(item).strip().lower() for item in raw_tools] if isinstance(raw_tools, list) else []
    if tool and tool not in requested_tools:
        requested_tools.append(tool)
    unknown_tools = [item for item in requested_tools if item not in SUPPORTED_TOOLS]
    if unknown_tools:
        return {"success": False, "error": "unknown tool"}
    tools = [item for item in SUPPORTED_TOOLS if item in set(requested_tools)]
    data: Dict[str, Any] = {
        "tick": agent_history_tick_service.get_status_snapshot(),
        "store": agent_history_service.get_status(),
        "article": get_pipeline_status(),
    }
    if tools:
        config = get_config()
        histories = _tool_history_snapshot(config, tools)
        data["tool_histories"] = histories
        if tool and len(histories) == 1:
            data["tool_history"] = histories[0]
    return {
        "success": True,
        "data": data,
    }

def runtime_get(_params: Any, _request_id: str) -> Dict[str, Any]:
    """One combined UI bootstrap exchange for config, load, and operation state."""
    config = get_config()
    operation = operation_service.get_snapshot(
        scope="agent_history",
        include_items=False,
        include_results=False,
    )
    summary = article_record_store.summarize_records()
    tools = [
        str(item)
        for item in (config.get("enabled_tools") or [])
        if str(item) in SUPPORTED_TOOLS
    ]
    histories = _tool_history_snapshot(config, tools)
    history_records = sum(int(item.get("history_records") or 0) for item in histories)
    history_content_records = sum(int(item.get("content_records") or 0) for item in histories)
    history_replies = sum(int(item.get("replies") or 0) for item in histories)
    history_processed = sum(int(item.get("processed") or 0) for item in histories)
    history_pending = sum(int(item.get("pending") or 0) for item in histories)
    # Independent counters for local multi-sentence regeneration and
    # published legacy audio awaiting network replacement.
    summary["rebuild_pending"] = audio_rebuild.pending_rebuild_count()
    summary["history_records"] = history_records
    summary["history_content_records"] = history_content_records
    summary["history_replies"] = history_replies
    summary["history_processed"] = history_processed
    summary["history_pending"] = history_pending
    summary["total_pending"] = int(summary["rebuild_pending"]) + history_pending
    summary["tool_histories"] = histories
    summary["qwen"] = status_snapshot_cache.get(
        _QWEN_RUNTIME_CACHE_KEY,
        lambda: qwen_engine.get_status() or {"ok": False},
        ttl_seconds=_QWEN_RUNTIME_CACHE_SECONDS,
    )
    return {
        "success": True,
        "data": {
            "article_config": config,
            "article_summary": summary,
            "operation_snapshot": operation,
            "ai_dashboard": _agent_history_ai_dashboard(config),
        },
    }


def _tool_history_snapshot(
    config: Dict[str, Any],
    tools: List[str],
) -> List[Dict[str, Any]]:
    cursors: Dict[str, Dict[str, Any]] = {}
    for item in tools:
        cursor = get_tool_cursor(config, item)
        target = get_tool_backfill_target(config, item)
        live_cursor = get_tool_live_cursor(config, item)
        cursors[item] = {
            "after_ts": int(cursor.get("after_ts") or 0),
            "after_fragment_id": str(cursor.get("after_fragment_id") or ""),
            "backfill_target_ts": int(target.get("after_ts") or 0),
            "backfill_target_fragment_id": str(
                target.get("after_fragment_id") or ""
            ),
            "live_after_ts": int(live_cursor.get("after_ts") or 0),
            "live_after_fragment_id": str(
                live_cursor.get("after_fragment_id") or ""
            ),
            "lane_aware": bool(target) and bool(live_cursor),
        }
    return agent_history_service.read_tool_statistics_many(cursors)

def article_config_post(params: Any, request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    config = save_config(request)
    pipeline_enabled = bool(config.get("enabled"))
    set_agent_history_callbacks_enabled(pipeline_enabled)
    return {
        "success": True,
        "data": config,
        "operation_id": f"op_config_{request_id}",
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

def article_record_id_pages(params: Any, _request_id: str) -> Dict[str, Any]:
    """DIFF ID page table: record IDs + status metadata only (no text bodies)."""
    request = params if isinstance(params, dict) else {}
    page_size = max(1, min(int(request.get("page_size") or request.get("pageSize") or 50), 500))
    revision = article_record_store.records_revision()
    since_revision = str(request.get("since_revision") or request.get("sinceRevision") or "")
    if since_revision and since_revision == revision:
        return {
            "success": True,
            "data": {"revision": revision, "unchanged": True},
        }
    page_data = article_record_store.record_metadata_page(
        int(request.get("page") or 1),
        page_size,
    )
    data: Dict[str, Any] = {
        "revision": revision,
        "total": page_data["total"],
        "page": page_data["page"],
        "page_count": page_data["page_count"],
    }
    data["items"] = page_data["items"]
    return {"success": True, "data": data}

def article_record_page(params: Any, _request_id: str) -> Dict[str, Any]:
    """Lazily materialize full records (bodies included) for the given IDs."""
    request = params if isinstance(params, dict) else {}
    rows = article_record_store.get_records(_id_list(request))
    return {"success": True, "data": {"items": rows, "total": len(rows)}}

def article_video_media(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    record_id = str(request.get("id") or "")
    content = article_record_store.read_video(record_id)
    if content is None:
        return {"success": False, "error": "video not found"}
    return {
        "success": True,
        "data": {
            "media_type": "video/mp4",
            "content_base64": base64.b64encode(content).decode("ascii"),
            "bytes": len(content),
        },
    }

def test_extract(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    tool = str(request.get("tool") or "")
    if not tool:
        return {"success": False, "error": "missing tool"}
    return {"success": True, "data": agent_history_service.test_extract(tool)}


__all__ = ["index", "prompts", "session_detail", "session_id_pages", "session_page", "prompt_id_pages", "prompt_page", "refresh", "update_prompt", "status", "runtime_get", "article_config_post", "article_list", "article_logs", "article_records", "article_record_id_pages", "article_record_page", "article_video_media", "test_extract"]
