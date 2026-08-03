# -*- coding: utf-8 -*-
"""HTTP Routes for tts_status."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_TTS_STATUS_GET_SETTINGS,
    UI_TTS_STATUS_POST_SERVER_ACTION,
    UI_TTS_STATUS_POST_SETTINGS,
    UI_TTS_STATUS_TEST,
)
import pycore.pyctl.tts.status_service as tts


def register_local_tts_status_routes(server):
    server.post(path=UI_TTS_STATUS_TEST, handler=tts.test)
    server.post(path=UI_TTS_STATUS_GET_SETTINGS, handler=tts.get_settings)
    server.post(path=UI_TTS_STATUS_POST_SETTINGS, handler=tts.post_settings)
    server.post(path=UI_TTS_STATUS_POST_SERVER_ACTION, handler=tts.post_server_action)
