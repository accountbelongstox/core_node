# -*- coding: utf-8 -*-
"""Register subtitle-search HTTP controllers."""

from __future__ import annotations

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
from pycore.pyctl.subtitle_search.service import subtitle_search_service


def register_local_subtitle_search_routes(server):
    """Register HTTP controllers."""

    def provider_test_handler(params, request_id, context):
        return subtitle_search_service.provider_test((params or {}).get("name"))

    def search_handler(params, request_id, context):
        return subtitle_search_service.search((params or {}).get("query"))

    routes = (
        (UI_SUBTITLE_SEARCH_STATUS, subtitle_search_service.status),
        (UI_SUBTITLE_SEARCH_PROBE, subtitle_search_service.probe),
        (UI_SUBTITLE_SEARCH_PROVIDERS, subtitle_search_service.providers),
        (UI_SUBTITLE_SEARCH_PROVIDER_TEST, provider_test_handler),
        (UI_SUBTITLE_SEARCH_CACHE, subtitle_search_service.cache),
        (UI_SUBTITLE_SEARCH_CACHE_CLEAR, subtitle_search_service.clear_cache),
        (UI_SUBTITLE_SEARCH_SEARCH, search_handler),
        (UI_SUBTITLE_SEARCH_DOWNLOAD, subtitle_search_service.download),
        (UI_SUBTITLE_SEARCH_HISTORY, subtitle_search_service.history),
        (UI_SUBTITLE_SEARCH_HISTORY_DELETE, subtitle_search_service.delete_history),
        (UI_SUBTITLE_SEARCH_HISTORY_CLEAR, subtitle_search_service.clear_history),
    )
    server.register_routes(routes, group="subtitle_search")
