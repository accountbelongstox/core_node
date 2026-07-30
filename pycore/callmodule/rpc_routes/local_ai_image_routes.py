# -*- coding: utf-8 -*-
"""RPC Routes for ai_image."""


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
import pycore.pyctl.ai.image_service as ai


def register_local_ai_image_routes(server):
    server.route(name=UI_AI_IMAGE_IMAGE, handler=ai.image)
    server.route(name=UI_AI_IMAGE_IMAGE_TEST, handler=ai.image_test)

    def image_history_handler(params, request_id, context):
        return ai.image_history(int((params or {}).get("limit") or 50))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY, handler=image_history_handler)

    def image_history_file_handler(params, request_id, context):
        return ai.image_history_file(str((params or {}).get("image_id") or ""))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_FILE, handler=image_history_file_handler)

    def image_history_reveal_handler(params, request_id, context):
        return ai.image_history_reveal(str((params or {}).get("image_id") or ""))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_REVEAL, handler=image_history_reveal_handler)

    def image_history_delete_handler(params, request_id, context):
        return ai.image_history_delete(str((params or {}).get("image_id") or ""))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_DELETE, handler=image_history_delete_handler)

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_CLEAR, handler=ai.image_history_clear)
    ColorPrint.green("[ConfigBuilder] Registered ai_image RPC routes")

