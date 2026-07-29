# -*- coding: utf-8 -*-
"""Native RPC v2 routes for subtitle search (OpenSubtitles client not yet ported).

Handlers return UI-compatible shapes so the page loads; search/download report
a clear not-implemented error until an OpenSubtitles client is added.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_SUBTITLE_SEARCH_STATUS,
    UI_SUBTITLE_SEARCH_PROBE,
    UI_SUBTITLE_SEARCH_PROVIDERS,
    UI_SUBTITLE_SEARCH_PROVIDER_TEST,
    UI_SUBTITLE_SEARCH_CACHE,
    UI_SUBTITLE_SEARCH_CACHE_CLEAR,
    UI_SUBTITLE_SEARCH_SEARCH,
    UI_SUBTITLE_SEARCH_DOWNLOAD,
    UI_SUBTITLE_SEARCH_HISTORY,
    UI_SUBTITLE_SEARCH_HISTORY_DELETE,
    UI_SUBTITLE_SEARCH_HISTORY_CLEAR,
)

_NOT_IMPL = "subtitle_search: OpenSubtitles client not implemented"


def _status() -> Dict[str, Any]:
    return {
        "available": False,
        "provider": "opensubtitles",
        "service_url": "",
        "key_name": "OPENSUBTITLES_API_KEY",
        "authenticated": False,
        "history_count": 0,
        "default_languages": ["en"],
        "max_results": 50,
    }


def _probe() -> Dict[str, Any]:
    return {
        "configured": False,
        "available": False,
        "latency_ms": None,
        "error": _NOT_IMPL,
        "languages_count": 0,
    }


def _providers() -> Dict[str, Any]:
    return {
        "success": True,
        "providers": [
            {
                "name": "opensubtitles",
                "label": "OpenSubtitles",
                "order": 1,
                "available": False,
                "configured": False,
                "needs": "OpenSubtitles client not implemented in pycore",
                "fallback": False,
                "note": _NOT_IMPL,
            },
        ],
    }


def register_local_subtitle_search_routes(server):
    """Register WS RPC handlers."""

    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(_status)

    server.route(name=UI_SUBTITLE_SEARCH_STATUS, handler=status_handler, sync=False)

    async def probe_handler(params, request_id, context):
        return await asyncio.to_thread(_probe)

    server.route(name=UI_SUBTITLE_SEARCH_PROBE, handler=probe_handler, sync=False)

    async def providers_handler(params, request_id, context):
        return await asyncio.to_thread(_providers)

    server.route(name=UI_SUBTITLE_SEARCH_PROVIDERS, handler=providers_handler, sync=False)

    async def provider_test_handler(params, request_id, context):
        params = params or {}
        name = str(params.get("name") or "opensubtitles")
        return {
            "name": name,
            "label": name,
            "available": False,
            "latency_ms": None,
            "error": _NOT_IMPL,
        }

    server.route(name=UI_SUBTITLE_SEARCH_PROVIDER_TEST, handler=provider_test_handler, sync=False)

    async def cache_handler(params, request_id, context):
        return {
            "success": True,
            "dir": "",
            "downloads": 0,
            "fetches": 0,
            "bytes": 0,
        }

    server.route(name=UI_SUBTITLE_SEARCH_CACHE, handler=cache_handler, sync=False)

    async def cache_clear_handler(params, request_id, context):
        return {"success": True, "removed": 0}

    server.route(name=UI_SUBTITLE_SEARCH_CACHE_CLEAR, handler=cache_clear_handler, sync=False)

    async def search_handler(params, request_id, context):
        params = params or {}
        return {
            "provider": "opensubtitles",
            "query": str(params.get("query") or ""),
            "count": 0,
            "results": [],
            "error": _NOT_IMPL,
        }

    server.route(name=UI_SUBTITLE_SEARCH_SEARCH, handler=search_handler, sync=False)

    async def download_handler(params, request_id, context):
        return {"success": False, "error": _NOT_IMPL}

    server.route(name=UI_SUBTITLE_SEARCH_DOWNLOAD, handler=download_handler, sync=False)

    async def history_handler(params, request_id, context):
        return {"success": True, "entries": []}

    server.route(name=UI_SUBTITLE_SEARCH_HISTORY, handler=history_handler, sync=False)

    async def history_delete_handler(params, request_id, context):
        return {"success": False}

    server.route(name=UI_SUBTITLE_SEARCH_HISTORY_DELETE, handler=history_delete_handler, sync=False)

    async def history_clear_handler(params, request_id, context):
        return {"success": True, "removed": 0}

    server.route(name=UI_SUBTITLE_SEARCH_HISTORY_CLEAR, handler=history_clear_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered subtitle_search RPC routes")


__all__ = ["register_local_subtitle_search_routes"]
