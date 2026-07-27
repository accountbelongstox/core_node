# -*- coding: utf-8 -*-
"""RPC Routes for image_search."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_IMAGE_SEARCH_CLEAR_HISTORY,
    UI_IMAGE_SEARCH_COMPARE,
    UI_IMAGE_SEARCH_DELETE_HISTORY,
    UI_IMAGE_SEARCH_HISTORY,
    UI_IMAGE_SEARCH_SEARCH_AI,
    UI_IMAGE_SEARCH_STATUS,
)
from pycore.callmodule.services import image_search_service as img


def register_local_image_search_routes(server):
    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(img.status)

    server.route(name=UI_IMAGE_SEARCH_STATUS, handler=status_handler, sync=False)

    async def search_ai_handler(params, request_id, context):
        return await asyncio.to_thread(img.search_ai, params or {})

    server.route(name=UI_IMAGE_SEARCH_SEARCH_AI, handler=search_ai_handler, sync=False)

    async def compare_handler(params, request_id, context):
        return await asyncio.to_thread(img.compare, params or {})

    server.route(name=UI_IMAGE_SEARCH_COMPARE, handler=compare_handler, sync=False)

    async def history_handler(params, request_id, context):
        return await asyncio.to_thread(img.history, int((params or {}).get("limit") or 50))

    server.route(name=UI_IMAGE_SEARCH_HISTORY, handler=history_handler, sync=False)

    async def delete_history_handler(params, request_id, context):
        return await asyncio.to_thread(img.delete_history, str((params or {}).get("entry_id") or ""))

    server.route(name=UI_IMAGE_SEARCH_DELETE_HISTORY, handler=delete_history_handler, sync=False)

    async def clear_history_handler(params, request_id, context):
        return await asyncio.to_thread(img.clear_history)

    server.route(name=UI_IMAGE_SEARCH_CLEAR_HISTORY, handler=clear_history_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered image_search RPC routes")


__all__ = ["register_local_image_search_routes"]
