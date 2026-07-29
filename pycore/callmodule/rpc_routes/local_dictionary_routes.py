# -*- coding: utf-8 -*-
"""RPC Routes for dictionary."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_DICTIONARY_DICTIONARY_STATUS,
    UI_DICTIONARY_DICTIONARY_LOOKUP,
)
from pycore.pyutils.translator.dictionary import get_dictionary_service


def register_local_dictionary_routes(server):
    async def dictionary_status_handler(params, request_id, context):
        def _run():
            status = get_dictionary_service().status()
            return {"success": True, **status}

        return await asyncio.to_thread(_run)

    server.route(name=UI_DICTIONARY_DICTIONARY_STATUS, handler=dictionary_status_handler, sync=False)

    async def dictionary_lookup_handler(params, request_id, context):
        params = params or {}

        def _run():
            svc = get_dictionary_service()
            word = str(params.get("word") or "").strip()
            target = str(params.get("target") or "zh")
            if not word:
                return {"success": False, "error": "word is required", "found": False}
            entry = svc.lookup(word)
            entry["success"] = True
            entry["target"] = target
            entry["target_translation"] = svc.translate(word, target)
            return entry

        return await asyncio.to_thread(_run)

    server.route(name=UI_DICTIONARY_DICTIONARY_LOOKUP, handler=dictionary_lookup_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered dictionary RPC routes")


__all__ = ["register_local_dictionary_routes"]
