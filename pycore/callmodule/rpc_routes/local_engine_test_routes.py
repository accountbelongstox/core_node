# -*- coding: utf-8 -*-
"""Register local engine test and status controllers on RPC v2."""

from pycore.callmodule.rpc_routes.route_names import (
    LOCAL_AI_IMAGE_TEST,
    LOCAL_AI_STATUS,
    LOCAL_OCR_STATUS,
    LOCAL_OCR_TEST,
    LOCAL_STT_STATUS,
    LOCAL_STT_TEST,
    LOCAL_TTS_STATUS,
    LOCAL_TTS_TEST,
)
import pycore.pyctl.runtime.local_engine_service as local_engine_service
from pycore.pyctl.ai.ai_gateway import gateway_status
from pycore.pyctl.tts.status_service import status as tts_status
from pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator import ocr_status
from pycore.pyutils.stt.stt_orchestrator import stt_status


def register_local_engine_test_routes(server) -> None:
    """Register thin local engine controller adapters."""

    def tts_status_handler(params, _request_id, _context):
        return tts_status(refresh=int((params or {}).get("refresh") or 0))

    routes = (
        (LOCAL_TTS_TEST, local_engine_service.test_tts, "Live TTS synthesis test"),
        (LOCAL_STT_TEST, local_engine_service.test_stt, "Live STT round-trip test"),
        (LOCAL_OCR_TEST, local_engine_service.test_ocr, "Live OCR recognition test"),
        (LOCAL_AI_IMAGE_TEST, local_engine_service.test_ai_image, "Live AI image test"),
        (LOCAL_TTS_STATUS, tts_status_handler, "TTS engine status"),
        (LOCAL_STT_STATUS, stt_status, "STT engine status"),
        (LOCAL_OCR_STATUS, ocr_status, "OCR engine status"),
        (LOCAL_AI_STATUS, gateway_status, "AI gateway status"),
    )
    server.register_routes(routes, group="local_engine")

