# -*- coding: utf-8 -*-
"""Laravel media ingestion and enrichment workflows."""

import os
from typing import Any, Dict, List

from pycore.pyctl.laravel.sync.media_sync import sync_book_source
from pycore.pyutils.document_processing.book_processor import iter_books
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager


def _expand_targets(targets: List[str]) -> List[str]:
    expanded = []
    for target in targets:
        if os.path.isdir(target):
            expanded.extend(str(path) for path in iter_books(target))
        else:
            expanded.append(target)
    return expanded or targets

def sync_book(params: Dict[str, Any]) -> Dict[str, Any]:
    language = params.get("language") or "en"
    languages = params.get("languages")
    source_type = params.get("source_type") or "book"
    paths = params.get("paths")
    source_path = params.get("source_path")
    targets = [
        str(path)
        for path in (paths or ([source_path] if source_path else []))
        if path and str(path).strip()
    ]
    if not targets:
        return {"success": False, "error": "source_path (or paths) required"}
    targets = _expand_targets(targets)
    results = [
        sync_book_source(
            target,
            language,
            None,
            None,
            None,
            None,
            languages,
            3,
            source_type,
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

def enrich(params: Dict[str, Any]) -> Dict[str, Any]:
    body = {}
    if params.get("limit") is not None:
        body["limit"] = params.get("limit")
    if params.get("language"):
        body["language"] = params.get("language")
    base_url = laravel_endpoint_manager.resolve()
    path = "/api/app_qy_v1/media/enrich"
    response = laravel_client.post(
        path,
        base_url=base_url,
        json=body,
        timeout=120,
    )
    url = f"{base_url}{path}"
    if response.status_code not in (200, 201):
        return {
            "success": False,
            "error": f"HTTP {response.status_code}: {response.text[:200]}",
            "url": url,
        }
    content_type = str(response.headers.get("content-type") or "").lower()
    if "json" in content_type:
        return response.json()
    return {
        "success": True,
        "status": response.status_code,
        "text": response.text[:500],
    }


__all__ = ["sync_book", "enrich"]
