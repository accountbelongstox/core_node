# -*- coding: utf-8 -*-
"""HTTP Routes for stt_status."""


from pycore.callmodule.rpc_routes.route_names import UI_STT_STATUS_STATUS, UI_STT_STATUS_TEST
import pycore.pyctl.stt.status_service as stt
from pycore.pyutils.stt.stt_orchestrator import stt_status


def register_local_stt_status_routes(server):
    server.post(path=UI_STT_STATUS_STATUS, handler=stt_status)

    server.post(path=UI_STT_STATUS_TEST, handler=stt.test)

