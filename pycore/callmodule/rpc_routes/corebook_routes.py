# -*- coding: utf-8 -*-
"""
CoreBook RPC Routes

WebSocket RPC handler for the Books page one-click pipeline:
- corebook.autoflow: convert → AI-translate → TTS → submit to Laravel
"""

import os

from pycore import ColorPrint
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.pyfoundations.text_parsing import normalize_language_codes
from pycore.callmodule.controllers.local_processing.corebook_controller import CoreBookController
from pycore.callmodule.rpc_routes.route_names import COREBOOK_AUTOFLOW

_controller = CoreBookController()


def register_corebook_routes(server):
    """Register the corebook.autoflow WS RPC handler."""

    async def corebook_autoflow(params, request_id, context):
        """Run the full CoreBook pipeline for one document path.

        params: { path, languages?:[...], source_type?:'book'|'document' }.
        Progress streams over the ``corebook_autoflow`` THREAD_BUS event.
        """
        params = params or {}
        path = (params.get("path") or "").strip()
        languages = normalize_language_codes(params.get("languages"))
        source_type = params.get("source_type") or "book"
        if not path:
            return {"success": False, "errors": ["path is required"]}
        if not languages:
            return {"success": False, "errors": ["languages must include at least one code"]}
        if not os.path.isfile(os.path.abspath(path)):
            return {"success": False, "errors": [f"file not found: {path}"]}
        try:
            return await await_bus_task(
                _controller.autoflow, path, languages, source_type)
        except Exception as exc:
            ColorPrint.red(f"[ConfigBuilder] corebook.autoflow failed: {exc}")
            return {"success": False, "errors": [str(exc)]}

    server.route(
        name=COREBOOK_AUTOFLOW,
        handler=corebook_autoflow,
        sync=False,
        description="CoreBook one-click pipeline: convert, translate, TTS, submit",
    )

    ColorPrint.green("[ConfigBuilder] Registered corebook.autoflow RPC route")


__all__ = ["register_corebook_routes"]
