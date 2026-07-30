# -*- coding: utf-8 -*-
"""Register the CoreBook autoflow controller on HTTP v2."""

import os

from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.corebook.engine import corebook_engine
from pycore.pyfoundations.text_parsing import normalize_language_codes


def register_corebook_routes(server) -> None:
    """Register CoreBook controller adapters."""

    def convert(params, _request_id, _context):
        request = params or {}
        return corebook_engine.convert(
            request.get("path"),
            request.get("language"),
            request.get("languages"),
            request.get("source_type"),
            request.get("text"),
        )

    def get(params, _request_id, _context):
        request = params or {}
        return corebook_engine.get(
            request.get("source_key"),
            request.get("start", 0),
            request.get("limit", 0),
        )

    def delete(params, _request_id, _context):
        return corebook_engine.delete((params or {}).get("source_key"))

    def add_language(params, _request_id, _context):
        request = params or {}
        return corebook_engine.add_language(
            request.get("source_key"),
            request.get("target_language"),
            request.get("source_language"),
            request.get("chunk_size"),
            request.get("grain"),
        )

    def fill_audio(params, _request_id, _context):
        request = params or {}
        return corebook_engine.fill_audio(
            request.get("source_key"),
            request.get("languages"),
            request.get("rate"),
            request.get("grain"),
        )

    def submit(params, _request_id, _context):
        request = params or {}
        return corebook_engine.submit(
            request.get("source_key"),
            request.get("upload_audio"),
            request.get("request_assist"),
            request.get("assist_items"),
        )

    def corebook_autoflow(params, _request_id, _context):
        request = params or {}
        path = str(request.get("path") or "").strip()
        languages = normalize_language_codes(request.get("languages"))
        if not path:
            return {"success": False, "errors": ["path is required"]}
        if not languages:
            return {
                "success": False,
                "errors": ["languages must include at least one code"],
            }
        if not os.path.isfile(os.path.abspath(path)):
            return {"success": False, "errors": [f"file not found: {path}"]}
        return corebook_engine.autoflow(
            path,
            languages,
            request.get("source_type") or "book",
        )

    server.post(
        name=route_names.COREBOOK_AUTOFLOW,
        handler=corebook_autoflow,
        description="CoreBook one-click pipeline",
    )
    routes = (
        (route_names.UI_COREBOOK_LIST, corebook_engine.list_books),
        (route_names.UI_COREBOOK_CONVERT, convert),
        (route_names.UI_COREBOOK_GET, get),
        (route_names.UI_COREBOOK_DELETE, delete),
        (route_names.UI_COREBOOK_ADD_LANGUAGE, add_language),
        (route_names.UI_COREBOOK_FILL_AUDIO, fill_audio),
        (route_names.UI_COREBOOK_SUBMIT, submit),
    )
    server.register_routes(routes, group="corebook")

