# -*- coding: utf-8 -*-
"""HTTP Routes for system_resources."""


from pycore.pyctl.desktop.video_extract_service import video_extract_service
from pycore.callmodule.rpc_routes.route_names import UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES


def register_local_system_resources_routes(server):
    server.post(
        path=UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES,
        handler=video_extract_service.system_resources,
    )

