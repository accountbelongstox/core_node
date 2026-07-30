# -*- coding: utf-8 -*-
"""RPC Routes for stt_status."""


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_STT_STATUS_STATUS, UI_STT_STATUS_TEST
import pycore.pyctl.stt.status_service as stt
from pycore.pyutils.stt.stt_orchestrator import stt_status


def register_local_stt_status_routes(server):
    server.route(name=UI_STT_STATUS_STATUS, handler=stt_status)

    server.route(name=UI_STT_STATUS_TEST, handler=stt.test)
    ColorPrint.green("[ConfigBuilder] Registered stt_status RPC routes")

