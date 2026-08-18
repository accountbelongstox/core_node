# -*- coding: utf-8 -*-
"""HTTP Routes for engines_load_status."""


from pycore.callmodule.rpc_routes.route_names import UI_ENGINES_LOAD_STATUS_LOAD_STATUS
from pycore.pyctl.runtime.engines_load_status_service import get_load_status


def register_local_engines_load_status_routes(server):
    server.post(path=UI_ENGINES_LOAD_STATUS_LOAD_STATUS, handler=get_load_status)

