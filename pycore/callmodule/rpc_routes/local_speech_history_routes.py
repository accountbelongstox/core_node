# -*- coding: utf-8 -*-
"""HTTP Routes for speech_history."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_SPEECH_HISTORY_HISTORY,
    UI_SPEECH_HISTORY_HISTORY_FILE,
    UI_SPEECH_HISTORY_HISTORY_REVEAL,
    UI_SPEECH_HISTORY_HISTORY_DELETE,
    UI_SPEECH_HISTORY_HISTORY_CLEAR,
)
import pycore.pyctl.ai.speech_history_service as hist


def register_local_speech_history_routes(server):
    def history_handler(params, request_id, context):
        return hist.history(int(params.get("limit") or 50))

    server.post(path=UI_SPEECH_HISTORY_HISTORY, handler=history_handler)

    def history_file_handler(params, request_id, context):
        return hist.history_file(str(params.get("audio_id") or ""))

    server.post(path=UI_SPEECH_HISTORY_HISTORY_FILE, handler=history_file_handler)

    def history_reveal_handler(params, request_id, context):
        return hist.history_reveal(str(params.get("audio_id") or ""))

    server.post(path=UI_SPEECH_HISTORY_HISTORY_REVEAL, handler=history_reveal_handler)

    def history_delete_handler(params, request_id, context):
        return hist.history_delete(str(params.get("audio_id") or ""))

    server.post(path=UI_SPEECH_HISTORY_HISTORY_DELETE, handler=history_delete_handler)

    server.post(path=UI_SPEECH_HISTORY_HISTORY_CLEAR, handler=hist.history_clear)

