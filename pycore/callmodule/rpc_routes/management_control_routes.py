# -*- coding: utf-8 -*-
"""HTTP Routes for control (autostart) — native UI path (no router.invoke)."""


import pycore.pyctl.runtime.autostart_service as autostart_service
from pycore.callmodule.rpc_routes.route_names import (
    UI_CONTROL_GET_AUTOSTART,
    UI_CONTROL_SET_AUTOSTART,
)


def register_management_control_routes(server):
    """Register HTTP controllers."""

    server.post(name=UI_CONTROL_GET_AUTOSTART, handler=autostart_service.get_status)

    def set_autostart_handler(params, request_id, context):
        params = params or {}
        enabled = bool(params.get("enabled"))
        target = params.get("target")
        mechanism = params.get("mechanism")
        return autostart_service.set_enabled(enabled, target, mechanism)

    server.post(name=UI_CONTROL_SET_AUTOSTART, handler=set_autostart_handler)
