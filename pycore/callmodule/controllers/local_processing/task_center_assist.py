# -*- coding: utf-8 -*-
"""
Assist / overview helpers for Task Center (FIX S1 split).
"""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

from pydantic import BaseModel

from pycore import ColorPrint
from pycore.pyctl.assist import load_assist_settings, save_assist_settings
from pycore.pyheartbeat import get_heartbeat_system
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.callmodule.services.sync.laravel_endpoint_manager import get_laravel_endpoint_manager
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services.assist_capability_sync import apply_assist_runtime
from pycore.callmodule.services.task_history_store import query_records
from pycore.callmodule.services.tts_sentence_worker_service import get_tts_sentence_worker_service

_ASSIST_OVERVIEW_PATH = "/api/app_qy_v1/assist/overview"
_ASSIST_OVERVIEW_TTL = 4.0
_ASSIST_OVERVIEW_TIMEOUT = 8.0
_ASSIST_OVERVIEW_CACHE_SIGNAL = "callmodule.queue_overview.assist_cache"
THREAD_BUS.signal(_ASSIST_OVERVIEW_CACHE_SIGNAL, {"ts": 0.0, "data": None, "error": None})


class ConfigRequest(BaseModel):
    enabled: Optional[bool] = None
    capabilities: Optional[Dict[str, bool]] = None


def assist_status(include_laravel: bool = True) -> Dict[str, Any]:
    settings = load_assist_settings()
    return {
        "success": True,
        **settings,
        "running": bool(settings.get("enabled")),
    }


def assist_config(req: ConfigRequest) -> Dict[str, Any]:
    settings = load_assist_settings()
    if req.enabled is not None:
        settings["enabled"] = bool(req.enabled)
    if req.capabilities is not None:
        capabilities = dict(settings.get("capabilities") or {})
        capabilities.update(req.capabilities)
        settings["capabilities"] = capabilities
    saved = save_assist_settings(settings)
    runtime = apply_assist_runtime(saved)
    errors = list(runtime.get("errors") or []) if isinstance(runtime, dict) else []
    ok = bool(runtime.get("ok", True)) if isinstance(runtime, dict) else True
    payload: Dict[str, Any] = {"success": ok, **saved}
    if errors:
        payload["errors"] = errors
        payload["error"] = "; ".join(errors)
    return payload


def workers_status() -> Dict[str, Any]:
    heartbeat = get_heartbeat_system().get_stats().get("heartbeat", {}) or {}
    callbacks = heartbeat.get("callbacks", {}) or {}
    return {
        "success": True,
        "running": bool(heartbeat.get("running")),
        "callbacks": [
            {"name": name, **info}
            for name, info in callbacks.items()
            if isinstance(info, dict)
        ],
    }


def _assist_overview_base() -> Optional[str]:
    try:
        base = get_laravel_endpoint_manager().get_active_base_url()
        return str(base).rstrip("/") if base else None
    except Exception:
        return None


def get_cached_assist_overview() -> Optional[Dict[str, Any]]:
    """Read the last assist/overview snapshot from THREAD_BUS only (no network I/O)."""
    cache_state = THREAD_BUS.get_signal(
        _ASSIST_OVERVIEW_CACHE_SIGNAL,
        {"ts": 0.0, "data": None, "error": None},
    )
    cached = cache_state.get("data")
    if isinstance(cached, dict):
        return dict(cached)
    return None


def fetch_assist_overview() -> Dict[str, Any]:
    now = time.monotonic()
    cache_state = THREAD_BUS.get_signal(
        _ASSIST_OVERVIEW_CACHE_SIGNAL,
        {"ts": 0.0, "data": None, "error": None},
    )
    cached = cache_state.get("data")
    if cached is not None and (now - cache_state["ts"]) < _ASSIST_OVERVIEW_TTL:
        return cached

    base = _assist_overview_base()
    fallback_data = {
        "success": False,
        "categories": [],
        "workers": [],
        "source": "pycore_fallback",
        "degraded": True,
    }

    if not base:
        fallback_data["error"] = "No Laravel endpoint configured"
        return fallback_data

    diagnostics = {
        "laravel_base_url": base,
        "resolved_url": f"{base}{_ASSIST_OVERVIEW_PATH}",
        "http_status": None,
        "response_time_ms": None,
        "response_body_keys": [],
        "success": False,
        "data_type": None,
    }

    start_time = time.monotonic()
    try:
        resp = get_laravel_client().get(
            _ASSIST_OVERVIEW_PATH, base_url=base, timeout=_ASSIST_OVERVIEW_TIMEOUT
        )
        diagnostics["response_time_ms"] = int((time.monotonic() - start_time) * 1000)
        diagnostics["http_status"] = resp.status_code

        if resp.status_code == 404:
            fallback_data["error"] = "404 Route not found"
        elif resp.status_code in (401, 403):
            fallback_data["error"] = f"{resp.status_code} Authentication failed"
        elif resp.status_code >= 500:
            fallback_data["error"] = f"{resp.status_code} Laravel exception"
        else:
            try:
                data = resp.json()
                diagnostics["data_type"] = type(data).__name__
                if isinstance(data, dict):
                    diagnostics["response_body_keys"] = list(data.keys())
                    if data.get("success") is True:
                        categories = data.get("categories")
                        if isinstance(categories, list):
                            diagnostics["success"] = True
                            result = dict(data)
                            result["source"] = "laravel"
                            result["degraded"] = False
                            result["diagnostics"] = diagnostics
                            result["http_status"] = diagnostics["http_status"]
                            result["laravel_endpoint"] = base
                            THREAD_BUS.signal(
                                _ASSIST_OVERVIEW_CACHE_SIGNAL,
                                {"ts": now, "data": result, "error": None},
                            )
                            return result
                        fallback_data["error"] = "Invalid structure: categories is not a list"
                    else:
                        fallback_data["error"] = data.get("error", "success=false returned by Laravel")
                else:
                    fallback_data["error"] = "Invalid structure: response is not a JSON object"
            except Exception as exc:
                fallback_data["error"] = f"JSON parse error: {exc}"
    except Exception as exc:
        diagnostics["response_time_ms"] = int((time.monotonic() - start_time) * 1000)
        fallback_data["error"] = f"Connection failed: {exc}"

    ColorPrint.yellow(f"[AssistOverview] Diagnostics: {diagnostics}")
    fallback_data["diagnostics"] = diagnostics
    fallback_data["http_status"] = diagnostics["http_status"]
    fallback_data["laravel_endpoint"] = base

    if cached is not None:
        stale_cached = dict(cached)
        stale_cached["degraded"] = True
        stale_cached["source"] = "pycore_fallback_stale_cache"
        stale_cached["error"] = fallback_data.get("error")
        stale_cached["diagnostics"] = diagnostics
        stale_cached["http_status"] = diagnostics["http_status"]
        stale_cached["laravel_endpoint"] = base
        return stale_cached

    return fallback_data


_fetch_assist_overview = fetch_assist_overview


def get_queue_overview() -> Dict[str, Any]:
    return fetch_assist_overview()


def queue_snapshot() -> Dict[str, Any]:
    return {
        "success": True,
        **(get_tts_sentence_worker_service().get_status() or {}),
    }


def get_recent_tasks(limit: int = 200) -> Dict[str, Any]:
    return {"success": True, **query_records(limit=limit)}


def tts_status(refresh: int = 0) -> Dict[str, Any]:
    callbacks = workers_status().get("callbacks", [])
    return {
        "success": True,
        "workers": [
            callback
            for callback in callbacks
            if str(callback.get("name", "")).startswith("tts_")
        ],
    }


__all__ = [
    "ConfigRequest",
    "assist_status",
    "assist_config",
    "workers_status",
    "fetch_assist_overview",
    "get_cached_assist_overview",
    "_fetch_assist_overview",
    "get_queue_overview",
    "queue_snapshot",
    "get_recent_tasks",
    "tts_status",
]
