# -*- coding: utf-8 -*-
"""Register manual translation controllers on HTTP API."""

from pycore.callmodule.rpc_routes.route_names import (
    UI_TRANSLATE_AI,
    UI_TRANSLATE_HISTORY,
    UI_TRANSLATE_HISTORY_CLEAR,
    UI_TRANSLATE_HISTORY_DELETE,
    UI_TRANSLATE_STATUS,
    UI_TRANSLATE_TRANSLATE,
)
import pycore.pyctl.translation.manual_translation_service as manual_translation_service


def register_local_translate_routes(server) -> None:
    """Register thin manual translation controller adapters."""

    server.post(path=UI_TRANSLATE_STATUS, handler=manual_translation_service.status)
    server.post(path=UI_TRANSLATE_TRANSLATE, handler=manual_translation_service.translate_google)
    server.post(path=UI_TRANSLATE_AI, handler=manual_translation_service.translate_ai)
    server.post(path=UI_TRANSLATE_HISTORY, handler=manual_translation_service.history)
    server.post(path=UI_TRANSLATE_HISTORY_DELETE, handler=manual_translation_service.history_delete)
    server.post(path=UI_TRANSLATE_HISTORY_CLEAR, handler=manual_translation_service.history_clear)

