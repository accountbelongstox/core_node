# -*- coding: utf-8 -*-
"""Shared read service for Laravel media data.

Browser code calls this service only through RPC v2. This module owns the
allowed pycore-to-Laravel HTTP hop through the shared LaravelClient.
"""

from typing import Any, Dict
from urllib.parse import quote

from pycore.pyutils.laravel.client import laravel_client

_MEDIA_PREFIX = "/api/app_qy_v1/media"
_MEDIA_PATHS = {"movie": "subtitles", "book": "books"}
_QUERY_TIMEOUT_S = 8.0


def _request(path: str, params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    try:
        response = laravel_client.get(
            path,
            params=params or None,
            timeout=_QUERY_TIMEOUT_S,
        )
        body = response.json() if response.status_code == 200 else None
        if isinstance(body, dict):
            return body
        return {
            "success": False,
            "error": f"Laravel media query returned HTTP {response.status_code}",
        }
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc)}


def list_media(kind: str, page: int = 1, per_page: int = 8) -> Dict[str, Any]:
    resource = _MEDIA_PATHS.get(str(kind))
    if resource is None:
        return {"success": False, "error": f"Unsupported media kind: {kind}"}
    return _request(
        f"{_MEDIA_PREFIX}/{resource}",
        {
            "page": max(1, int(page or 1)),
            "per_page": min(200, max(1, int(per_page or 8))),
        },
    )


def get_media_detail(kind: str, source_key: str, grain: str = "sentence") -> Dict[str, Any]:
    resource = _MEDIA_PATHS.get(str(kind))
    normalized_key = str(source_key or "").strip()
    if resource is None:
        return {"success": False, "error": f"Unsupported media kind: {kind}"}
    if not normalized_key:
        return {"success": False, "error": "source_key is required"}
    params = {"grain": grain} if kind == "movie" else None
    return _request(
        f"{_MEDIA_PREFIX}/{resource}/{quote(normalized_key, safe='')}",
        params,
    )


__all__ = ["get_media_detail", "list_media"]
