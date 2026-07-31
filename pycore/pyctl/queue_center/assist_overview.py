# -*- coding: utf-8 -*-
"""Queue Center support slices shared by services and controllers.

Assist status/config/cycle live only in
``pycore/callmodule/services/assist_service.py``. Queue overview composition
lives only in ``pycore/callmodule/services/queue_overview_service.py``.
"""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyutils.common.endpoint_scoped_cache import EndpointScopedCache
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyctl.tts.sentence_worker_service import tts_sentence_worker_service

_ASSIST_OVERVIEW_PATH = "/api/app_qy_v1/assist/overview"
_ASSIST_OVERVIEW_TTL = 30.0
_ASSIST_OVERVIEW_STALE_MAX_S = 300.0
_ASSIST_OVERVIEW_TIMEOUT = 5.0
_ASSIST_OVERVIEW_CACHE = EndpointScopedCache(
    ttl_s=_ASSIST_OVERVIEW_TTL,
    stale_max_s=_ASSIST_OVERVIEW_STALE_MAX_S,
)


def workers_status() -> Dict[str, Any]:
    heartbeat = shared_heartbeat_system.get_stats().get("heartbeat", {}) or {}
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
        base = laravel_endpoint_manager.get_active_base_url()
        return str(base).strip().rstrip("/") if base else None
    except Exception:
        return None


def get_cached_assist_overview(base_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Read only the cache belonging to the selected Laravel endpoint."""
    base = str(base_url or _assist_overview_base() or "").strip().rstrip("/")
    return _ASSIST_OVERVIEW_CACHE.get_stale(base)


def fetch_assist_overview() -> Dict[str, Any]:
    """Fetch Laravel overview with a TTL cache partitioned by endpoint."""
    base = _assist_overview_base()
    fallback_data: Dict[str, Any] = {
        "success": False,
        "categories": [],
        "workers": [],
        "source": "pycore_fallback",
        "degraded": True,
        "stale": False,
        "age_s": None,
        "observed_at": None,
        "laravel_endpoint": base,
    }
    if not base:
        fallback_data["error"] = "No Laravel endpoint configured"
        return fallback_data

    cached = _ASSIST_OVERVIEW_CACHE.get_fresh(base)
    if cached is not None:
        return cached

    diagnostics: Dict[str, Any] = {
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
        response = laravel_client.get(
            _ASSIST_OVERVIEW_PATH,
            base_url=base,
            timeout=_ASSIST_OVERVIEW_TIMEOUT,
        )
        diagnostics["response_time_ms"] = int((time.monotonic() - start_time) * 1000)
        diagnostics["http_status"] = response.status_code
        if response.status_code == 404:
            fallback_data["error"] = "404 Route not found"
        elif response.status_code in (401, 403):
            fallback_data["error"] = f"{response.status_code} Authentication failed"
        elif response.status_code >= 500:
            fallback_data["error"] = f"{response.status_code} Laravel exception"
        else:
            data = response.json()
            diagnostics["data_type"] = type(data).__name__
            if isinstance(data, dict):
                diagnostics["response_body_keys"] = list(data.keys())
                if data.get("success") is True and isinstance(data.get("categories"), list):
                    diagnostics["success"] = True
                    result = dict(data)
                    result.update({
                        "source": "laravel",
                        "degraded": False,
                        "stale": False,
                        "age_s": 0.0,
                        "observed_at": data.get("generated_at"),
                        "diagnostics": diagnostics,
                        "http_status": diagnostics["http_status"],
                        "laravel_endpoint": base,
                    })
                    return _ASSIST_OVERVIEW_CACHE.store(base, result)
                fallback_data["error"] = data.get("error", "Invalid Laravel overview contract")
            else:
                fallback_data["error"] = "Invalid structure: response is not a JSON object"
    except Exception as exc:  # noqa: BLE001
        diagnostics["response_time_ms"] = int((time.monotonic() - start_time) * 1000)
        fallback_data["error"] = f"Connection failed: {exc}"

    ColorPrint.yellow(f"[AssistOverview] Diagnostics: {diagnostics}")
    fallback_data.update({
        "diagnostics": diagnostics,
        "http_status": diagnostics["http_status"],
    })
    stale_cache = _ASSIST_OVERVIEW_CACHE.get_stale(base)
    if stale_cache is not None:
        stale = dict(stale_cache)
        stale.update({
            "degraded": True,
            "stale": True,
            "source": "pycore_fallback_stale_cache",
            "error": fallback_data.get("error"),
            "diagnostics": diagnostics,
            "http_status": diagnostics["http_status"],
            "laravel_endpoint": base,
        })
        return stale
    return fallback_data


def request_assist_overview_refresh() -> None:
    """Start at most one remote refresh without blocking a status RPC."""
    base = _assist_overview_base()
    if not base:
        return
    _ASSIST_OVERVIEW_CACHE.get_or_refresh(base, fetch_assist_overview)


def get_assist_overview_snapshot() -> Dict[str, Any]:
    """Return cached/local state immediately and refresh Laravel in the background."""
    base = _assist_overview_base()
    fresh = _ASSIST_OVERVIEW_CACHE.get_fresh(base)
    if fresh is not None:
        return fresh
    stale = _ASSIST_OVERVIEW_CACHE.get_stale(base)
    request_assist_overview_refresh()
    if stale is not None:
        result = dict(stale)
        result.update({
            "degraded": True,
            "stale": True,
            "source": "pycore_fallback_stale_cache",
            "refreshing": True,
            "laravel_endpoint": base,
        })
        return result
    return {
        "success": False,
        "categories": [],
        "workers": [],
        "source": "pycore_fallback",
        "degraded": True,
        "stale": False,
        "refreshing": bool(base),
        "age_s": None,
        "observed_at": None,
        "laravel_endpoint": base,
        "error": "Overview refresh pending" if base else "No Laravel endpoint configured",
    }


_fetch_assist_overview = fetch_assist_overview


def queue_snapshot() -> Dict[str, Any]:
    return {"success": True, **(tts_sentence_worker_service.get_status() or {})}


__all__ = [
    "_fetch_assist_overview",
    "fetch_assist_overview",
    "get_assist_overview_snapshot",
    "get_cached_assist_overview",
    "request_assist_overview_refresh",
    "queue_snapshot",
    "workers_status",
]
