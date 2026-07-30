# -*- coding: utf-8 -*-
"""Register manual translation controllers on RPC v2."""

from pycore.callmodule.rpc_routes.route_names import (
    UI_TRANSLATE_AI,
    UI_TRANSLATE_HISTORY,
    UI_TRANSLATE_HISTORY_CLEAR,
    UI_TRANSLATE_HISTORY_DELETE,
    UI_TRANSLATE_STATUS,
    UI_TRANSLATE_TRANSLATE,
)
import pycore.pyctl.translation.manual_translation_service as manual_translation_service
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def register_local_translate_routes(server) -> None:
    """Register thin manual translation controller adapters."""

    server.route(name=UI_TRANSLATE_STATUS, handler=manual_translation_service.status)
    server.route(name=UI_TRANSLATE_TRANSLATE, handler=manual_translation_service.translate_google)
    server.route(name=UI_TRANSLATE_AI, handler=manual_translation_service.translate_ai)
    server.route(name=UI_TRANSLATE_HISTORY, handler=manual_translation_service.history)
    server.route(name=UI_TRANSLATE_HISTORY_DELETE, handler=manual_translation_service.history_delete)
    server.route(name=UI_TRANSLATE_HISTORY_CLEAR, handler=manual_translation_service.history_clear)
    ColorPrint.green("[ConfigBuilder] Registered translate RPC routes")

