# -*- coding: utf-8 -*-
"""RPC Routes for engines_load_status."""


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_ENGINES_LOAD_STATUS_LOAD_STATUS
from pycore.pyctl.runtime.engines_load_status_service import get_load_status


def register_local_engines_load_status_routes(server):
    server.route(name=UI_ENGINES_LOAD_STATUS_LOAD_STATUS, handler=get_load_status)
    ColorPrint.green("[ConfigBuilder] Registered engines_load_status RPC routes")

