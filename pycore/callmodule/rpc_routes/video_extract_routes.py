# -*- coding: utf-8 -*-
"""Register video-extract synchronization controllers on HTTP API."""

from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.desktop.subtitle_language_fill_service import fill
from pycore.pyctl.laravel.sync.media_sync import (
    backend_status,
    sync_all,
    sync_source,
)
from pycore.pyutils.laravel.media_query_service import get_media_detail, list_media


def register_video_extract_routes(server) -> None:
    """Register thin video-extract controller adapters."""

    def sync_source_handler(params, _request_id, _context):
        request = params
        paths = request.get("paths")
        source_path = request.get("source_path")
        targets = [
            str(path)
            for path in (paths or ([source_path] if source_path else []))
            if path and str(path).strip()
        ]
        if not targets:
            return {"success": False, "error": "source_path (or paths) required"}
        results = [
            sync_source(
                target,
                request.get("language") or "en",
                None,
                None,
                request.get("languages"),
            )
            for target in targets
        ]
        if len(results) == 1:
            return results[0]
        return {
            "success": all(result.get("success") for result in results),
            "count": len(results),
            "results": results,
        }

    def fill_languages_handler(params, _request_id, _context):
        request = params
        return fill(
            paths=request.get("paths"),
            languages=request.get("languages"),
            strategy=str(request.get("strategy") or "api_first"),
        )

    def backend_status_handler(params, _request_id, _context):
        request = params
        return backend_status(request.get("paths"), request.get("base_url"))

    def media_list_handler(params, _request_id, _context):
        request = params
        return list_media(
            request.get("kind") or "",
            request.get("page") or 1,
            request.get("per_page") or 8,
        )

    def media_detail_handler(params, _request_id, _context):
        request = params
        return get_media_detail(
            request.get("kind") or "",
            request.get("source_key") or "",
            request.get("grain") or "sentence",
        )

    def sync_all_handler(params, _request_id, _context):
        request = params
        return sync_all(
            request.get("paths"),
            request.get("language") or "en",
            None,
            None,
            request.get("languages"),
        )

    routes = (
        (route_names.VIDEO_EXTRACT_SYNC_SOURCE, sync_source_handler),
        (route_names.VIDEO_EXTRACT_FILL_LANGUAGES, fill_languages_handler),
        (route_names.VIDEO_EXTRACT_BACKEND_STATUS, backend_status_handler),
        (route_names.VIDEO_EXTRACT_BACKEND_MEDIA_LIST, media_list_handler),
        (route_names.VIDEO_EXTRACT_BACKEND_MEDIA_DETAIL, media_detail_handler),
        (route_names.VIDEO_EXTRACT_SYNC_ALL, sync_all_handler),
    )
    server.register_routes(routes, group="video_extract")

