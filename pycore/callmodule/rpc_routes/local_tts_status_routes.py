# -*- coding: utf-8 -*-
"""HTTP Routes for tts_status."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_TTS_STATUS_GET_SETTINGS,
    UI_TTS_STATUS_POST_SERVER_ACTION,
    UI_TTS_STATUS_POST_SETTINGS,
    UI_TTS_STATUS_STATUS,
    UI_TTS_STATUS_TEST,
)
import pycore.pyctl.tts.status_service as tts


def register_local_tts_status_routes(server):
    def status_handler(params, request_id, context):
        params = params or {}
        return tts.status(int(params.get("refresh") or 0))

    server.post(name=UI_TTS_STATUS_STATUS, handler=status_handler)

    server.post(name=UI_TTS_STATUS_TEST, handler=tts.test)
    server.post(name=UI_TTS_STATUS_GET_SETTINGS, handler=tts.get_settings)
    server.post(name=UI_TTS_STATUS_POST_SETTINGS, handler=tts.post_settings)
    server.post(name=UI_TTS_STATUS_POST_SERVER_ACTION, handler=tts.post_server_action)

