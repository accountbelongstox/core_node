# -*- coding: utf-8 -*-
"""Agent History article record and video routes for the Pycore UI."""

import base64
from typing import Any, Dict

import pycore.pyutils.agent_history.article_records as article_record_store
from pycore.pyctl.agent_history.pipeline.config import list_articles
from pycore.pyctl.agent_history.ui_requests import id_list


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
    rows = article_record_store.get_records(id_list(request))
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

def article_video_logs(params: Any, _request_id: str) -> Dict[str, Any]:
    request = params if isinstance(params, dict) else {}
    revision = article_record_store.video_records_revision()
    since_revision = str(request.get("since_revision") or request.get("sinceRevision") or "")
    if since_revision and since_revision == revision:
        return {"success": True, "data": {"revision": revision, "unchanged": True}}
    jobs = article_record_store.list_video_jobs(int(request.get("limit") or 100))
    return {
        "success": True,
        "data": {
            "revision": revision,
            "unchanged": False,
            "jobs": jobs,
            "summary": article_record_store.summarize_records(),
        },
    }


__all__ = [
    "article_list",
    "article_logs",
    "article_record_id_pages",
    "article_record_page",
    "article_records",
    "article_video_logs",
    "article_video_media",
]
