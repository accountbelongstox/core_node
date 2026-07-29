# -*- coding: utf-8 -*-
"""
Books RPC Routes

WebSocket RPC handlers for the Books page.
"""

import base64
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.callmodule.controllers.local_processing.books_controller import BooksController
from pycore.callmodule.rpc_routes.route_names import (
    UI_BOOKS_SUPPORTED_FORMATS,
    UI_BOOKS_SCAN,
    UI_BOOKS_ANALYZE,
    UI_BOOKS_STATE,
    UI_BOOKS_STATE_ADD,
    UI_BOOKS_STATE_REMOVE,
    UI_BOOKS_SUBMIT,
    UI_BOOKS_LIST,
    UI_BOOKS_ANALYZE_UPLOAD,
)

_controller = BooksController()

def _to_dict(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    return obj

def register_local_books_routes(server):
    """Register the books WS RPC handlers."""

    async def supported_formats(params, request_id, context):
        try:
            res = _controller.supported_formats()
            return {"success": True, "data": _to_dict(res)}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def scan(params, request_id, context):
        params = params or {}
        try:
            res = await await_bus_task(_controller.scan, params.get("path"), params.get("formats"))
            return {"success": True, "data": _to_dict(res)}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def analyze(params, request_id, context):
        params = params or {}
        try:
            res = await await_bus_task(
                _controller.analyze,
                params.get("path"),
                params.get("formats"),
                params.get("language"),
                params.get("preview_chars", 800),
                params.get("max_files", 50),
                params.get("persist", False),
                params.get("languages")
            )
            return {"success": True, "data": _to_dict(res)}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def get_state(params, request_id, context):
        try:
            res = _controller.get_state()
            return {"success": True, "data": _to_dict(res)}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def state_add(params, request_id, context):
        params = params or {}
        try:
            res = _controller.add_source(params.get("path"), params.get("mode"), params.get("language"))
            return {"success": True, "data": _to_dict(res)}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def state_remove(params, request_id, context):
        params = params or {}
        try:
            res = _controller.remove_source(params.get("path"))
            return {"success": True, "data": _to_dict(res)}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def submit(params, request_id, context):
        params = params or {}
        try:
            res = await await_bus_task(
                _controller.submit,
                params.get("paths"),
                params.get("language"),
                params.get("languages"),
                params.get("source_type", "book")
            )
            return {"success": True, "data": _to_dict(res)}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def list_items(params, request_id, context):
        params = params or {}
        try:
            res = await await_bus_task(
                _controller.list_items,
                params.get("path"),
                params.get("kind"),
                params.get("start", 0),
                params.get("limit", 50),
                params.get("formats"),
                params.get("language"),
                params.get("refresh", False),
                params.get("max_files", 50),
                params.get("chapter_index"),
                params.get("languages"),
                params.get("grain"),
                params.get("sort_order"),
                params.get("query"),
                params.get("view_language")
            )
            return {"success": True, "data": _to_dict(res)}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def analyze_upload(params, request_id, context):
        params = params or {}
        files = params.get("files", [])
        uploads = []
        for f in files:
            try:
                data_b64 = f.get("data_b64", "")
                content = base64.b64decode(data_b64, validate=False) if data_b64 else b""
            except (ValueError, TypeError):
                content = b""
            uploads.append((f.get("name") or "book", content))
            
        try:
            res = await await_bus_task(
                _controller.analyze_upload,
                uploads,
                params.get("language"),
                max(0, min(20000, int(params.get("preview_chars", 800)))),
                params.get("persist", False),
                params.get("languages"),
                params.get("source_type", "book")
            )
            return {"success": True, "data": _to_dict(res)}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    server.route(name=UI_BOOKS_SUPPORTED_FORMATS, handler=supported_formats, sync=False)
    server.route(name=UI_BOOKS_SCAN, handler=scan, sync=False)
    server.route(name=UI_BOOKS_ANALYZE, handler=analyze, sync=False)
    server.route(name=UI_BOOKS_STATE, handler=get_state, sync=False)
    server.route(name=UI_BOOKS_STATE_ADD, handler=state_add, sync=False)
    server.route(name=UI_BOOKS_STATE_REMOVE, handler=state_remove, sync=False)
    server.route(name=UI_BOOKS_SUBMIT, handler=submit, sync=False)
    server.route(name=UI_BOOKS_LIST, handler=list_items, sync=False)
    server.route(name=UI_BOOKS_ANALYZE_UPLOAD, handler=analyze_upload, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered local books RPC routes")

__all__ = ["register_local_books_routes"]
