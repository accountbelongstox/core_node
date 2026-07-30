# -*- coding: utf-8 -*-
"""HTTP Routes for assist."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_ASSIST_ASSIST_CONFIG,
    UI_ASSIST_ASSIST_CYCLE,
    UI_ASSIST_ASSIST_STATUS,
)
import pycore.pyctl.assist.service as assist


def register_local_assist_routes(server):
    def assist_status_handler(params, request_id, context):
        params = params or {}
        include = params.get("include_laravel", True)
        return assist.assist_status(bool(include))

    server.post(name=UI_ASSIST_ASSIST_STATUS, handler=assist_status_handler)

    server.post(name=UI_ASSIST_ASSIST_CONFIG, handler=assist.assist_config)
    server.post(name=UI_ASSIST_ASSIST_CYCLE, handler=assist.assist_cycle)

