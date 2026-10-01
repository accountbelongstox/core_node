# -*- coding: utf-8 -*-
"""Local LLM status and control application service."""

import time
from typing import Any, Dict, Optional

from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_LLM_KEY,
    status_snapshot_cache,
)
from pycore.pyutils.llm.llm_orchestrator import chat, llm_status
from pycore.pyutils.llm.llm_service_manager import llm_service_facade


def _invalidate(_engine: str = "") -> None:
    status_snapshot_cache.invalidate(STATUS_SNAPSHOT_LLM_KEY)


def status(params: Optional[Dict[str, Any]] = None):
    """LLM engine availability panel."""
    return status_snapshot_cache.get(
        STATUS_SNAPSHOT_LLM_KEY,
        llm_status,
        refresh=bool((params or {}).get("refresh")),
    )


def test(params: Optional[Dict[str, Any]] = None):
    """Live chat test for ONE engine (or the best available)."""
    request = params or {}
    prompt = str(request.get("text") or "").strip() or "Reply with the single word: ok"
    started = time.monotonic()
    result = chat(
        [{"role": "user", "content": prompt}],
        engine=str(request.get("engine") or "").strip() or None,
        model=str(request.get("model") or "").strip() or None,
    )
    result["latency_ms"] = int((time.monotonic() - started) * 1000)
    result["text"] = (result.get("text") or "")[:500]
    _invalidate()
    return result


def get_settings(params: Optional[Dict[str, Any]] = None):
    """Current managed local LLM server options."""
    return {"success": True, **llm_service_facade.settings_view()}


def post_settings(params: Optional[Dict[str, Any]] = None):
    """Update and persist managed local LLM server options."""
    view = llm_service_facade.update_settings(params)
    _invalidate()
    return {"success": True, **view}


def post_server_action(params: Optional[Dict[str, Any]] = None):
    """Enable/disable or start/stop ONE managed local LLM server engine."""
    return llm_service_facade.server_action(params, "LLM", on_changed=_invalidate)
