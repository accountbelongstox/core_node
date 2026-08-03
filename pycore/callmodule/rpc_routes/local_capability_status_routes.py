# -*- coding: utf-8 -*-
"""HTTP Routes for capability_status — native UI path (no router.invoke)."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_CAPABILITY_STATUS_STATUS,
    UI_CAPABILITY_STATUS_INFO,
    UI_CAPABILITY_STATUS_OPEN_DIRECTORY,
    UI_CAPABILITY_STATUS_GET_CAPABILITY_SETTINGS,
    UI_CAPABILITY_STATUS_POST_CAPABILITY_SETTINGS,
)
import pycore.pyctl.desktop.capability_service as cap
from pycore.pyctl.capabilities import system_info


def register_local_capability_status_routes(server):
    """Register HTTP controllers."""

    def status_handler(params, _request_id, _context):
        return cap.get_capability_status(bool(params.get("refresh")))

    def info_handler(params, _request_id, _context):
        return system_info(bool(params.get("refresh")))

    def settings_handler(params, _request_id, _context):
        return cap.get_capability_settings(bool(params.get("refresh")))

    server.post(path=UI_CAPABILITY_STATUS_STATUS, handler=status_handler)
    server.post(path=UI_CAPABILITY_STATUS_INFO, handler=info_handler)

    def open_directory_handler(params, request_id, context):
        return cap.open_directory(str(params.get("key") or ""))

    server.post(
        path=UI_CAPABILITY_STATUS_OPEN_DIRECTORY,
        handler=open_directory_handler,
    )

    server.post(
        path=UI_CAPABILITY_STATUS_GET_CAPABILITY_SETTINGS,
        handler=settings_handler,
    )

    def post_capability_settings_handler(params, request_id, context):
        return cap.post_capability_settings(str(params.get("capability") or ""), params.get("priority"), params.get("options"))

    server.post(
        path=UI_CAPABILITY_STATUS_POST_CAPABILITY_SETTINGS,
        handler=post_capability_settings_handler,
    )


