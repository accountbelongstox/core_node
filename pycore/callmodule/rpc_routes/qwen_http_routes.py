# -*- coding: utf-8 -*-
"""Register Qwen3TTS controllers and event wiring on HTTP API."""

from pycore.callmodule.rpc_routes import route_names
import pycore.pyctl.tts.qwen.ui_service as qwen_ui_service


def register_qwen_http_routes(server) -> None:
    """Register thin Qwen3TTS controller adapters."""
    qwen_ui_service.register_event_bridge()
    routes = (
        (route_names.UI_QWEN_HEALTH, qwen_ui_service.health),
        (route_names.UI_QWEN_CAPABILITIES, qwen_ui_service.capabilities),
        (route_names.UI_QWEN_MODEL_LOAD, qwen_ui_service.model_load),
        (route_names.UI_QWEN_MODEL_STATUS, qwen_ui_service.model_status),
        (route_names.UI_QWEN_SYNTHESIS_SUBMIT, qwen_ui_service.synthesis_submit),
        (route_names.UI_QWEN_SYNTHESIS_STATUS, qwen_ui_service.synthesis_status),
        (route_names.UI_QWEN_SYNTHESIS_CANCEL, qwen_ui_service.synthesis_cancel),
        (route_names.UI_QWEN_OPERATION_SNAPSHOT, qwen_ui_service.operation_snapshot),
        (route_names.UI_QWEN_OPERATION_EVENTS, qwen_ui_service.operation_events),
    )
    server.register_routes(routes, group="qwen3tts")

