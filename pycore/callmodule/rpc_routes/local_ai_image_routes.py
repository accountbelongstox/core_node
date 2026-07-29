# -*- coding: utf-8 -*-
"""RPC Routes for ai_image."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_IMAGE_IMAGE,
    UI_AI_IMAGE_IMAGE_HISTORY,
    UI_AI_IMAGE_IMAGE_HISTORY_CLEAR,
    UI_AI_IMAGE_IMAGE_HISTORY_DELETE,
    UI_AI_IMAGE_IMAGE_HISTORY_FILE,
    UI_AI_IMAGE_IMAGE_HISTORY_REVEAL,
    UI_AI_IMAGE_IMAGE_TEST,
)
import pycore.callmodule.services.ai_image_service as ai


def register_local_ai_image_routes(server):
    async def image_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image, params or {})

    server.route(name=UI_AI_IMAGE_IMAGE, handler=image_handler, sync=False)

    async def image_test_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_test, params or {})

    server.route(name=UI_AI_IMAGE_IMAGE_TEST, handler=image_test_handler, sync=False)

    async def image_history_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_history, int((params or {}).get("limit") or 50))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY, handler=image_history_handler, sync=False)

    async def image_history_file_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_history_file, str((params or {}).get("image_id") or ""))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_FILE, handler=image_history_file_handler, sync=False)

    async def image_history_reveal_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_history_reveal, str((params or {}).get("image_id") or ""))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_REVEAL, handler=image_history_reveal_handler, sync=False)

    async def image_history_delete_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_history_delete, str((params or {}).get("image_id") or ""))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_DELETE, handler=image_history_delete_handler, sync=False)

    async def image_history_clear_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_history_clear)

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_CLEAR, handler=image_history_clear_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered ai_image RPC routes")


__all__ = ["register_local_ai_image_routes"]
