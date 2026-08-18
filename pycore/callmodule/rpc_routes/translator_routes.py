# -*- coding: utf-8 -*-
"""Register stable non-UI translator controllers on HTTP API."""

from pycore.callmodule.rpc_routes.route_names import (
    TRANSLATOR_DETECT_LANGUAGE,
    TRANSLATOR_TRANSLATE_BATCH,
    TRANSLATOR_TRANSLATE_SINGLE,
)
import pycore.pyctl.translation.manual_translation_service as manual_translation_service


def register_translator_routes(server) -> None:
    """Register stable translator routes backed by the manual translation service."""

    server.post(path=TRANSLATOR_TRANSLATE_SINGLE, handler=manual_translation_service.translate_single)
    server.post(path=TRANSLATOR_TRANSLATE_BATCH, handler=manual_translation_service.translate_batch)
    server.post(path=TRANSLATOR_DETECT_LANGUAGE, handler=manual_translation_service.detect_language)
