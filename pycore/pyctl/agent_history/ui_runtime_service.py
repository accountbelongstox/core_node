# -*- coding: utf-8 -*-
"""Agent History runtime, status, AI dashboard, tool fragment and article
config routes for the Pycore UI."""

from typing import Any, Dict, List

import pycore.pyutils.agent_history.article_records as article_record_store
from pycore.pyctl.agent_history.agent_history_service import agent_history_service
from pycore.pyctl.agent_history.agent_history_statistics import agent_history_statistics
from pycore.pyctl.agent_history.ai_sources import OPENROUTER_ATTEMPT_SOURCES
from pycore.pyctl.agent_history.heartbeat import (
    pipeline_env_override,
    set_agent_history_callbacks_enabled,
)
from pycore.pyctl.agent_history.pipeline.config import (
    RUNTIME_CACHE_KEY,
    SUPPORTED_TOOLS,
    get_config,
    get_tool_backfill_target,
    get_tool_cursor,
    get_tool_live_cursor,
    get_status as get_pipeline_status,
    save_config,
)
from pycore.pyctl.agent_history.pipeline import audio_rebuild
from pycore.pyctl.agent_history.pipeline.prompt_templates import prompt_defaults
from pycore.pyctl.agent_history.root_spool import spool_status, uncovered_unreadable_homes
from pycore.pyctl.agent_history.tick_service import agent_history_tick_service
from pycore.pyctl.agent_history.ui_requests import id_list
from pycore.pyctl.ai.ai_rate_limits import rate_status
from pycore.pyctl.ai.ai_usage_log import usage_log, usage_revision
from pycore.pyctl.ai.prompt_derive import (
    CONFIG_KEY_PROMPT_DERIVE_EN,
    CONFIG_KEY_PROMPT_REWRITE_EN,
    DEFAULT_PROMPT_DERIVE_EN_PROMPT,
    DEFAULT_PROMPT_REWRITE_EN_PROMPT,
)
from pycore.pyfoundations.agent_paths import AGENT_HISTORY_OFFICIAL_HOME_MARKERS
from pycore.pyfoundations.time_utils import utc_now
from pycore.pyutils.common.ai_request_failures import classify_ai_failure
from pycore.pyutils.common.operation_service import operation_service
from pycore.pyutils.common.status_snapshot_cache import status_snapshot_cache
from pycore.pyutils.common.usage_rollup import usage_rollup
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyutils.tts.qwen.engine import qwen_engine
import pycore.pyutils.tts.qwen.live as qwen_live


_AI_USAGE_SOURCES = set(OPENROUTER_ATTEMPT_SOURCES)
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
    day = utc_now().date().isoformat()
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
        "sources": list(OPENROUTER_ATTEMPT_SOURCES),
        "rate": rate_status("openrouter").get("status") or {},
        **usage_snapshot,
    }


def _fragment_cursor(config: Dict[str, Any], tool: str) -> Dict[str, Any]:
    cursor = get_tool_cursor(config, tool)
    target = get_tool_backfill_target(config, tool)
    live_cursor = get_tool_live_cursor(config, tool)
    return {
        "after_ts": int(cursor.get("after_ts") or 0),
        "after_fragment_id": str(cursor.get("after_fragment_id") or ""),
        "backfill_target_ts": int(target.get("after_ts") or 0),
        "backfill_target_fragment_id": str(target.get("after_fragment_id") or ""),
        "live_after_ts": int(live_cursor.get("after_ts") or 0),
        "live_after_fragment_id": str(live_cursor.get("after_fragment_id") or ""),
        "lane_aware": bool(target) and bool(live_cursor),
    }


def tool_fragment_id_pages(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    tool = str(request.get("tool") or "").strip().lower()
    if tool not in SUPPORTED_TOOLS:
        return {"success": False, "error": "unknown tool"}
    kind = str(request.get("kind") or "prompts").strip().lower()
    cursor = _fragment_cursor(get_config(), tool)
    data = agent_history_statistics.read_fragment_id_pages(
        tool,
        kind,
        cursor,
        int(request.get("page") or 1),
        int(request.get("page_size") or request.get("pageSize") or 50),
        str(request.get("since_revision") or request.get("sinceRevision") or ""),
    )
    return {"success": True, "data": data}


def tool_fragment_page(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    tool = str(request.get("tool") or "").strip().lower()
    if tool not in SUPPORTED_TOOLS:
        return {"success": False, "error": "unknown tool"}
    kind = str(request.get("kind") or "prompts").strip().lower()
    cursor = _fragment_cursor(get_config(), tool)
    data = agent_history_statistics.read_fragment_page(tool, kind, cursor, id_list(request))
    return {"success": True, "data": data}

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
        "tick": agent_history_tick_service.status_snapshot(),
        "store": agent_history_service.status(),
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
    result = status_snapshot_cache.get_background(
        RUNTIME_CACHE_KEY, _build_runtime, ttl_seconds=3.0,
    )
    return {**(result["snapshot"] or {"success": True, "data": {}}), "refreshing": result["refreshing"]}


def _build_runtime() -> Dict[str, Any]:
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
        lambda: qwen_live.decorate_status(qwen_engine.status_snapshot()),
        ttl_seconds=_QWEN_RUNTIME_CACHE_SECONDS,
    )
    return {
        "success": True,
        "data": {
            "article_config": config,
            "article_config_storage_path": str(user_data_store.path),
            "pipeline_env_override": pipeline_env_override(),
            "supported_tools": list(SUPPORTED_TOOLS),
            "tool_support": {
                tool: {
                    "platforms": list(AGENT_HISTORY_OFFICIAL_HOME_MARKERS[tool].get("platforms") or ()),
                    "verified": str(AGENT_HISTORY_OFFICIAL_HOME_MARKERS[tool].get("verified") or ""),
                }
                for tool in SUPPORTED_TOOLS
            },
            "unreadable_homes": uncovered_unreadable_homes(),
            "root_spool": spool_status(),
            "monitor": agent_history_tick_service.status_snapshot().get("monitor") or {},
            "article_prompt_defaults": {
                **prompt_defaults(),
                CONFIG_KEY_PROMPT_DERIVE_EN: DEFAULT_PROMPT_DERIVE_EN_PROMPT,
                CONFIG_KEY_PROMPT_REWRITE_EN: DEFAULT_PROMPT_REWRITE_EN_PROMPT,
            },
            "article_summary": summary,
            "operation_snapshot": operation,
            "ai_dashboard": _agent_history_ai_dashboard(config),
        },
    }


def _tool_history_snapshot(
    config: Dict[str, Any],
    tools: List[str],
) -> List[Dict[str, Any]]:
    cursors = {item: _fragment_cursor(config, item) for item in tools}
    return agent_history_statistics.read_many(cursors)

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


__all__ = [
    "article_config_post",
    "runtime_get",
    "status",
    "tool_fragment_id_pages",
    "tool_fragment_page",
]
