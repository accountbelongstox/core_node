# -*- coding: utf-8 -*-
"""RPC Routes for heartbeat_workers."""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_HEARTBEAT_WORKERS_STATUS,
    UI_HEARTBEAT_WORKERS_CONFIG,
)
import pycore.pyctl.assist.heartbeat_workers_service as hb


def register_local_heartbeat_workers_routes(server):
    server.route(name=UI_HEARTBEAT_WORKERS_STATUS, handler=hb.status)

    def config_handler(params, request_id, context):
        params = params or {}
        if "enabled" not in params:
            return {"success": False, "error": "enabled is required"}
        return hb.config(
            str(params.get("callback_name") or ""),
            bool(params["enabled"]),
        )

    server.route(name=UI_HEARTBEAT_WORKERS_CONFIG, handler=config_handler)
    ColorPrint.green("[ConfigBuilder] Registered heartbeat_workers HTTP controllers")

