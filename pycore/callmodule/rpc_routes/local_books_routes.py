# -*- coding: utf-8 -*-
"""Register Books page controllers on HTTP API."""

import base64
from typing import Any

from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.corebook.books_service import books_service


def _response(value: Any):
    if hasattr(value, "model_dump"):
        value = value.model_dump()
    elif hasattr(value, "dict"):
        value = value.dict()
    return {"success": True, "data": value}


def register_local_books_routes(server) -> None:
    """Register thin Books controller adapters."""

    def supported_formats(params, _request_id, _context):
        return _response(books_service.supported_formats())

    def scan(params, _request_id, _context):
        request = params
        return _response(books_service.scan(request.get("path"), request.get("formats")))

    def analyze(params, _request_id, _context):
        request = dict(params)
        request.setdefault("max_files", 50)
        return _response(books_service.analyze(
            request.get("path"),
            request.get("formats"),
            request.get("language"),
            request.get("preview_chars", 800),
            request.get("max_files"),
            request.get("persist", False),
            request.get("languages"),
        ))

    def get_state(params, _request_id, _context):
        return _response(books_service.get_state())

    def state_add(params, _request_id, _context):
        request = params
        return _response(books_service.add_source(
            request.get("path"),
            request.get("mode"),
            request.get("language"),
        ))

    def state_remove(params, _request_id, _context):
        return _response(books_service.remove_source(params.get("path")))

    def submit(params, _request_id, _context):
        request = dict(params)
        request.setdefault("source_type", "book")
        return _response(books_service.submit(
            request.get("paths"),
            request.get("language"),
            request.get("languages"),
            request.get("source_type"),
        ))

    def list_items(params, _request_id, _context):
        request = dict(params)
        request.setdefault("limit", 50)
        request.setdefault("max_files", 50)
        return _response(books_service.list_items(
            request.get("path"),
            request.get("kind"),
            request.get("start", 0),
            request.get("limit", 50),
            request.get("formats"),
            request.get("language"),
            request.get("refresh", False),
            request.get("max_files", 50),
            request.get("chapter_index"),
            request.get("languages"),
            request.get("grain"),
            request.get("sort_order"),
            request.get("query"),
            request.get("view_language"),
        ))

    def analyze_upload(params, _request_id, _context):
        request = params
        uploads = [
            (
                item.get("name") or "book",
                base64.b64decode(item.get("data_b64") or "", validate=False),
            )
            for item in request.get("files") or []
        ]
        return _response(books_service.analyze_upload(
            uploads,
            request.get("language"),
            max(0, min(20000, int(request.get("preview_chars", 800)))),
            request.get("persist", False),
            request.get("languages"),
            request.get("source_type", "book"),
        ))

    server.post(path=route_names.UI_BOOKS_SUPPORTED_FORMATS, handler=supported_formats)
    server.post(path=route_names.UI_BOOKS_SCAN, handler=scan)
    server.post(path=route_names.UI_BOOKS_ANALYZE, handler=analyze)
    server.post(path=route_names.UI_BOOKS_STATE, handler=get_state)
    server.post(path=route_names.UI_BOOKS_STATE_ADD, handler=state_add)
    server.post(path=route_names.UI_BOOKS_STATE_REMOVE, handler=state_remove)
    server.post(path=route_names.UI_BOOKS_SUBMIT, handler=submit)
    server.post(path=route_names.UI_BOOKS_LIST, handler=list_items)
    server.post(path=route_names.UI_BOOKS_ANALYZE_UPLOAD, handler=analyze_upload)

