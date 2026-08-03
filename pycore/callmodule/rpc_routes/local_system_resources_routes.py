# -*- coding: utf-8 -*-
"""HTTP Routes for system_resources."""


from pycore.pyctl.desktop.video_extract_service import video_extract_service
from pycore.callmodule.rpc_routes.route_names import UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES


def register_local_system_resources_routes(server):
    def system_resources_handler(params, _request_id, _context):
        return video_extract_service.system_resources(bool(params.get("refresh")))

    server.post(
        path=UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES,
        handler=system_resources_handler,
    )
